"""Transparent feature extraction. A feature is evidence, never an AI percentage."""
from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import Protocol

from .text import ARABIC_LETTERS, DIACRITICS, feature_normalize, sentences, tokenize, variation

# Fixed, versioned order shared by training, artifacts, and serving.
FEATURE_NAMES: tuple[str, ...] = (
    "lm_mean_surprisal",            # optional genuine LM average negative log likelihood
    "lm_sentence_burstiness",       # optional variation of LM sentence NLL
    "semantic_coherence",          # optional adjacent embedding cosine
    "semantic_coherence_variance", # optional variance of adjacent cosine
    "ngram_log_likelihood_ratio",  # optional supervised reference frequencies
    "ngram_coverage",              # reference vocabulary coverage
    "lexical_diversity",
    "character_entropy",
    "sentence_length_variation",
    "mean_word_length",
    "punctuation_ratio",
    "arabic_character_ratio",
    "arabic_diacritic_ratio",
    "function_word_ratio",
    "transformer_raw_logit",        # optional specialist model, NOT calibrated alone
)
VERSION = "tis-hybrid-features-v1"
AR_FUNCTIONS = set("في من على إلى عن هذا هذه ذلك تلك الذي التي كان كانت لا لم لن مع بين عند هو هي كما قد إن أن لكن لأن أو و".split())
EN_FUNCTIONS = set("the a an and or to of for in on with at is are was were be been being have has had which that this those they it".split())
NG_MAX_FEATURES = 5000


class LanguageModel(Protocol):
    def mean_nll(self, samples: list[str]) -> list[float | None]: ...


class Embeddings(Protocol):
    def encode(self, samples: list[str]) -> list[list[float]]: ...


class BinaryModel(Protocol):
    def logit(self, text: str) -> float: ...


@dataclass(frozen=True)
class FeatureResult:
    values: dict[str, float | None]
    available: list[str]
    missing: list[str]
    sentence_count: int
    word_count: int


def normalized_ngrams(text: str, length: int = 3) -> list[str]:
    normalized = feature_normalize(text)
    if len(normalized) < length:
        return []
    return [normalized[i:i + length] for i in range(len(normalized) - length + 1)]


def profile_from_corpora(human_texts: list[str], ai_texts: list[str], limit: int = NG_MAX_FEATURES) -> dict:
    """Train-only class-conditional reference; never use held-out/test text."""
    profiles = [Counter(), Counter()]
    for label, corpus in enumerate((human_texts, ai_texts)):
        for text in corpus:
            profiles[label].update(normalized_ngrams(text, 3))
    if not profiles[0] or not profiles[1]:
        raise ValueError("Each class needs reference n-gram evidence")
    union = profiles[0] + profiles[1]
    vocabulary = {ngram for ngram, _ in union.most_common(limit)}
    return {
        "version": "ngram-reference-v1",
        "n": 3,
        "human": {k: profiles[0][k] for k in vocabulary if profiles[0][k]},
        "ai": {k: profiles[1][k] for k in vocabulary if profiles[1][k]},
        "human_total": sum(profiles[0].values()),
        "ai_total": sum(profiles[1].values()),
        "vocabulary_size": len(vocabulary),
        "smoothing": 1.0,
    }


def ngram_evidence(text: str, reference: dict | None) -> tuple[float | None, float | None]:
    if not reference:
        return None, None
    if reference.get("version") != "ngram-reference-v1":
        raise ValueError("Unsupported reference corpus version")
    human = reference.get("human", {})
    ai = reference.get("ai", {})
    k = int(reference.get("vocabulary_size", 0)) + 1
    if k <= 1 or k > NG_MAX_FEATURES + 1:
        raise ValueError("Invalid vocabulary size")
    alpha = float(reference.get("smoothing", 1.0))
    if alpha <= 0:
        raise ValueError("Invalid smoothing")
    human_denom = float(reference["human_total"]) + alpha * k
    ai_denom = float(reference["ai_total"]) + alpha * k
    terms = normalized_ngrams(text)
    if not terms:
        return None, None
    # Only known terms contribute: unseen terms provide no discriminative evidence.
    matched = [t for t in terms if t in human or t in ai]
    coverage = len(matched) / len(terms)
    if len(matched) < 8:
        return None, coverage
    result = 0.0
    for term in matched:
        log_ai = math.log((float(ai.get(term, 0)) + alpha) / ai_denom)
        log_human = math.log((float(human.get(term, 0)) + alpha) / human_denom)
        result += log_ai - log_human
    return result / len(matched), coverage


def _cosine(a: list[float], b: list[float]) -> float | None:
    if len(a) != len(b) or not a:
        return None
    x = math.sqrt(sum(v * v for v in a))
    y = math.sqrt(sum(v * v for v in b))
    if x * y < 1e-12:
        return None
    return max(-1.0, min(1.0, sum(u * v for u, v in zip(a, b)) / (x * y)))


class Extractor:
    def __init__(
        self,
        *,
        language_model: LanguageModel | None = None,
        embeddings: Embeddings | None = None,
        transformer: BinaryModel | None = None,
        ngram_reference: dict | None = None,
    ):
        self.language_model = language_model
        self.embeddings = embeddings
        self.transformer = transformer
        self.ngram_reference = ngram_reference

    def extract(self, text: str) -> FeatureResult:
        words = tokenize(text)
        sw = [s for s in sentences(text) if s.words >= 3][:64]
        normalized = feature_normalize(text)
        content = [c for c in normalized if not c.isspace()]
        chars = Counter(content)
        total = sum(chars.values())
        entropy = -sum((n / total) * math.log2(n / total) for n in chars.values()) if total else None
        lengths = [s.words for s in sw]
        unique = {feature_normalize(w) for w in words}
        count = len(words)
        arabic_characters = len(ARABIC_LETTERS.findall(text))
        letters = sum(c.isalpha() for c in text)
        # Per-script/dialect context is diagnostic, not used as an authorship judgment.
        values: dict[str, float | None] = {
            "lm_mean_surprisal": None,
            "lm_sentence_burstiness": None,
            "semantic_coherence": None,
            "semantic_coherence_variance": None,
            "ngram_log_likelihood_ratio": None,
            "ngram_coverage": None,
            "lexical_diversity": len(unique) / count if count else None,
            "character_entropy": entropy,
            "sentence_length_variation": variation([float(x) for x in lengths]),
            "mean_word_length": sum(len(w) for w in words) / count if count else None,
            "punctuation_ratio": sum(c in ".,;:!?؟؛،" for c in text) / max(1, len(text)),
            "arabic_character_ratio": arabic_characters / max(1, letters),
            "arabic_diacritic_ratio": len(DIACRITICS.findall(text)) / max(1, arabic_characters),
            "function_word_ratio": (
                sum(feature_normalize(w) in (AR_FUNCTIONS if arabic_characters > letters / 2 else EN_FUNCTIONS) for w in words) / count
            ) if count else None,
            "transformer_raw_logit": None,
        }
        llr, coverage = ngram_evidence(text, self.ngram_reference)
        values["ngram_log_likelihood_ratio"] = llr
        values["ngram_coverage"] = coverage
        if self.language_model is not None and len(sw) >= 3:
            nll = self.language_model.mean_nll([s.text for s in sw])
            if len(nll) != len(sw):
                raise ValueError("Language model score length mismatch")
            finite = [float(x) for x in nll if x is not None and math.isfinite(float(x)) and x >= 0]
            if len(finite) >= 3:
                values["lm_mean_surprisal"] = sum(finite) / len(finite)
                values["lm_sentence_burstiness"] = variation(finite)
        if self.embeddings is not None and len(sw) >= 3:
            vectors = self.embeddings.encode([s.text for s in sw])
            if len(vectors) != len(sw):
                raise ValueError("Embedding result length mismatch")
            similarities = [_cosine(a, b) for a, b in zip(vectors, vectors[1:])]
            similarities = [v for v in similarities if v is not None and math.isfinite(v)]
            if len(similarities) >= 2:
                values["semantic_coherence"] = sum(similarities) / len(similarities)
                mean = values["semantic_coherence"]
                values["semantic_coherence_variance"] = sum((v - mean) ** 2 for v in similarities) / len(similarities)
        if self.transformer is not None:
            raw = self.transformer.logit(text)
            if raw is not None:
                result = float(raw)
                if math.isfinite(result):
                    values["transformer_raw_logit"] = result

        for key in FEATURE_NAMES:
            if values[key] is not None and not math.isfinite(values[key]):
                values[key] = None
        return FeatureResult(
            values=values, available=[k for k in FEATURE_NAMES if values[k] is not None],
            missing=[k for k in FEATURE_NAMES if values[k] is None],
            sentence_count=len(sw), word_count=count,
        )
