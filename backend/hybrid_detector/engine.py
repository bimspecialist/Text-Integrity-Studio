"""Calibrated multi-layer service with explicit abstention and segment overlays.

No hand-tuned heuristic weights are interpreted as authorship probabilities.
The only numerical estimate is generated from an independently trained,
frozen calibration artifact that satisfies release and cohort gates.
"""
from __future__ import annotations

import math
from pathlib import Path
from uuid import uuid4

from .artifacts import CalibratedArtifact, load_artifact
from .features import Extractor, FeatureResult, FEATURE_NAMES, VERSION
from .text import Span, detect_language, paragraphs, sentences, tokenize

MAX_CHARS = 120_000
MAX_SEGMENTS = 80
MIN_WORDS_DEFAULT = 180


def indicators(features: FeatureResult) -> dict:
    v = features.values
    def clean(number: float | None) -> float | None:
        return round(number, 5) if number is not None and math.isfinite(number) else None
    surprise = v["lm_mean_surprisal"]
    return {
        "perplexity": clean(math.exp(min(25.0, surprise)) if surprise is not None else None),
        "perplexity_token_nll": clean(surprise),
        "burstiness_nll_cv": clean(v["lm_sentence_burstiness"]),
        "semantic_coherence_mean_cosine": clean(v["semantic_coherence"]),
        "semantic_coherence_variance": clean(v["semantic_coherence_variance"]),
        "ngram_class_log_likelihood_ratio": clean(v["ngram_log_likelihood_ratio"]),
        "ngram_reference_coverage": clean(v["ngram_coverage"]),
        "stylometry": {
            k: clean(v[k]) for k in (
                "lexical_diversity", "character_entropy", "sentence_length_variation",
                "mean_word_length", "punctuation_ratio", "arabic_character_ratio",
                "arabic_diacritic_ratio", "function_word_ratio",
            )
        },
        "transformer_raw_logit": clean(v["transformer_raw_logit"]),
        "present_feature_count": len(features.available),
        "missing_features": features.missing,
        "note": "Descriptive signals do not individually establish AI authorship.",
    }


def signal_families(features: FeatureResult) -> list[str]:
    v = features.values
    result = ["stylometry"] if v["lexical_diversity"] is not None and v["character_entropy"] is not None else []
    if v["lm_mean_surprisal"] is not None and v["lm_sentence_burstiness"] is not None:
        result.append("language_model")
    if v["semantic_coherence"] is not None:
        result.append("semantic")
    if v["ngram_log_likelihood_ratio"] is not None and (v["ngram_coverage"] or 0) >= 0.08:
        result.append("ngram")
    if v["transformer_raw_logit"] is not None:
        result.append("transformer")
    return result


class HybridEngine:
    def __init__(
        self,
        *,
        artifact_directory: str | Path | None = None,
        allow_calibrated_results: bool = False,
        language_model=None,
        embeddings=None,
        transformer=None,
        minimum_word_count: int = MIN_WORDS_DEFAULT,
    ):
        self.allow_calibrated_results = bool(allow_calibrated_results)
        self.minimum_word_count = max(75, int(minimum_word_count))
        self.artifacts = {
            unit: {
                language: load_artifact(artifact_directory, unit, language) if artifact_directory else None
                for language in ("en", "ar", "mixed")
            }
            for unit in ("document", "paragraph", "sentence")
        }
        self.adapters = {
            "language_model": language_model,
            "embeddings": embeddings,
            "transformer": transformer,
        }

    def _extractor(self, artifact: CalibratedArtifact | None) -> Extractor:
        return Extractor(
            language_model=self.adapters["language_model"],
            embeddings=self.adapters["embeddings"],
            transformer=self.adapters["transformer"],
            ngram_reference=artifact.ngram_reference if artifact else None,
        )

    def _evaluate(
        self, span: Span, *, language: str, domain: str,
        context: str, artifact: CalibratedArtifact | None, min_words: int
    ) -> dict:
        features = self._extractor(artifact).extract(span.text)
        families = signal_families(features)
        reasons = []
        min_words = max(min_words, artifact.raw["eligibility"]["min_words"] if artifact else min_words)
        if features.word_count < min_words:
            reasons.append(f"Below calibrated minimum of {min_words} words")
        if not artifact:
            reasons.append("No trained/held-out-calibrated model artifact configured")
        elif not artifact.eligible(language, domain, context):
            reasons.append("Language, domain or writing context absent from the validated corpus")
        elif not artifact.readiness()[0]:
            reasons.extend(artifact.readiness()[1][:4])
        if not self.allow_calibrated_results:
            reasons.append("Operational release approval is disabled")
        if len(families) < 3:
            reasons.append("Insufficient independent signal families; at least three required")
        variation = features.values.get("sentence_length_variation")
        if variation is None or variation < 0.05:
            reasons.append("Insufficient within-text variation for a confident classification")
        if context in ("non_native", "formal") and (not artifact or not artifact.raw["validation"].get("group_audits_passed", False)):
            reasons.append("High false-positive-risk writing context lacks validated subgroup coverage")

        confidence = "LOW"
        probability = None
        tier = "UNASSESSED"
        color = "gray"
        if not reasons and artifact is not None:
            probability = artifact.score(features.values)
            confidence = (
                "HIGH" if features.word_count >= 400 and len(families) >= 4
                and variation is not None and variation >= 0.12
                and context == "general" else "MEDIUM"
            )
            low = artifact.raw["thresholds"]["low"]
            high = artifact.raw["thresholds"]["high"]
            if probability >= high:
                tier, color = "HIGH_AI_SIGNAL", "red"
            elif probability <= low:
                tier, color = "LOW_AI_SIGNAL", "green"
            else:
                tier, color = "UNCERTAIN_MIXED", "yellow"
        else:
            if confidence != "LOW":
                confidence = "LOW"

        return {
            "status": "CALIBRATED_ESTIMATE" if probability is not None else "INCONCLUSIVE",
            "ai_probability_percent": round(100 * probability, 1) if probability is not None else None,
            "confidence_level": confidence,
            "confidence_meaning": "Quality of applicable validation evidence; NOT certainty about document authorship",
            "tier": tier,
            "color": color,
            "model_version": artifact.version if artifact else None,
            "reasons": reasons,
            "word_count": features.word_count,
            "signal_families": families,
            "indicators": indicators(features),
        }

    def analyze(
        self,
        text: str,
        *,
        language: str = "auto",
        domain: str = "general",
        writing_context: str = "general",
        segment_by: str = "paragraph",
        include_segments: bool = True,
        request_id: str | None = None,
    ) -> dict:
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Text must not be blank")
        if len(text) > MAX_CHARS:
            raise ValueError("Text exceeds 120,000 characters")
        if segment_by not in ("paragraph", "sentence"):
            raise ValueError("Unsupported segment granularity")
        if writing_context not in ("general", "formal", "non_native", "academic"):
            raise ValueError("Unsupported writing context")
        resolved = detect_language(text)
        if language not in ("auto", "en", "ar", "mixed"):
            raise ValueError("Unsupported language")
        if language != "auto" and language != resolved:
            # A false declared language can invalidate calibration assumptions.
            raise ValueError("Declared language disagrees with the detected writing script")
        actual_language = resolved if language == "auto" else language
        if len(domain) > 64 or not domain or not domain.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Invalid domain tag")
        full = Span(0, len(text), text, len(tokenize(text)), actual_language)
        document = self._evaluate(
            full, language=actual_language, domain=domain, context=writing_context,
            artifact=self.artifacts["document"].get(actual_language), min_words=self.minimum_word_count
        )
        spans = paragraphs(text) if segment_by == "paragraph" else sentences(text)
        visible = spans[:MAX_SEGMENTS] if include_segments else []
        segment_results = []
        artifact = self.artifacts[segment_by].get(actual_language)
        for span in visible:
            seg_model = self.artifacts[segment_by].get(span.language)
            # Not enough text for a segment classifier: show an unassessed overlay.
            if span.words < 75 or seg_model is None:
                segment_results.append({
                    "start": span.start, "end": span.end, "word_count": span.words,
                    "language": span.language, "tier": "UNASSESSED", "color": "gray",
                    "ai_probability_percent": None, "confidence_level": "LOW",
                    "status": "INCONCLUSIVE", "model_version": None, "indicators": None,
                    "reasons": ["No independent segment calibrator" if seg_model is None else "Segment too short"],
                })
                continue
            result = self._evaluate(
                span, language=span.language, domain=domain, context=writing_context,
                artifact=seg_model, min_words=75
            )
            segment_results.append({
                "start": span.start, "end": span.end, "word_count": span.words,
                "language": span.language,
                "tier": result["tier"], "color": result["color"],
                "status": result["status"], "confidence_level": result["confidence_level"],
                "ai_probability_percent": result["ai_probability_percent"],
                "model_version": result["model_version"], "indicators": result["indicators"],
                "reasons": result["reasons"],
            })

        return {
            "schema_version": "1.0",
            "request_id": request_id or str(uuid4()),
            "analysis_status": document["status"],
            "language": actual_language,
            "domain": domain,
            "writing_context": writing_context,
            "document": document,
            "segments": segment_results,
            "segmentation": {
                "kind": segment_by, "total": len(spans), "returned": len(segment_results),
                "truncated": include_segments and len(spans) > MAX_SEGMENTS,
            },
            "calibration": {
                "document_artifact_present": self.artifacts["document"].get(actual_language) is not None,
                "segment_artifact_present": any(self.artifacts[segment_by].get(s.language) is not None for s in visible),
                "production_scores_enabled": self.allow_calibrated_results,
                "feature_version": VERSION,
                "scope": "Validated dataset distribution only; cannot prove authorship or text fraction",
            },
            "privacy": {"raw_text_returned": False, "raw_text_persisted": False},
            "disclaimer": (
                "Calibrated estimates are statistical model signals, not an AI-written word fraction "
                "or evidence sufficient for academic or employment misconduct decisions."
            ),
        }
