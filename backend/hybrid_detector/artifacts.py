"""Reviewed calibration artifact contract; pure JSON, no pickle deserialization.

Percentages are permitted only for explicitly approved, independently tested
artifacts in a gated runtime. An operator setting alone cannot bypass gates.
"""
from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path

from .features import FEATURE_NAMES, VERSION

ARTIFACT_FORMAT = "tis-hybrid-calibrated-v1"
SCOPE_VALUES = ("document", "paragraph", "sentence")


@dataclass(frozen=True)
class CalibratedArtifact:
    raw: dict

    @property
    def version(self) -> str:
        return str(self.raw["version"])

    @property
    def unit(self) -> str:
        return str(self.raw["unit"])

    @property
    def languages(self) -> list[str]:
        return list(self.raw["eligibility"]["languages"])

    @property
    def ngram_reference(self) -> dict | None:
        return self.raw.get("ngram_reference")

    def eligible(self, language: str, domain: str, context: str) -> bool:
        config = self.raw["eligibility"]
        return (
            language in config["languages"]
            and domain in config["domains"]
            and context in config["contexts"]
        )

    def score(self, features: dict[str, float | None]) -> float:
        params = self.raw["predictor"]
        linear = float(params["intercept"])
        size = len(FEATURE_NAMES)
        for i, key in enumerate(FEATURE_NAMES):
            number = features.get(key)
            if number is not None and math.isfinite(number):
                standard = (number - float(params["center"][i])) / float(params["scale"][i])
                missing = 0.0
            else:
                standard = 0.0
                missing = 1.0
            # Defensive clip; unsupported feature drift is handled in engine.
            linear += float(params["weights"][i]) * max(-8.0, min(8.0, standard))
            linear += float(params["weights"][size + i]) * missing
        cal = params["calibration"]
        z = float(cal["coef"]) * linear + float(cal["intercept"])
        return 1.0 / (1.0 + math.exp(-max(-80.0, min(80.0, z))))

    def readiness(self) -> tuple[bool, list[str]]:
        reasons: list[str] = []
        review = self.raw.get("validation", {})
        governance = self.raw.get("governance", {})
        if review.get("human_test_n", 0) < 400:
            reasons.append("Insufficient verified-human independent holdout")
        if review.get("ai_test_n", 0) < 400:
            reasons.append("Insufficient AI-written independent holdout")
        if not isinstance(review.get("fpr_wilson_upper_95"), (int, float)) or review["fpr_wilson_upper_95"] > 0.01:
            reasons.append("False-positive confidence bound not met")
        if not isinstance(review.get("brier"), (int, float)) or review["brier"] > 0.20:
            reasons.append("Calibration Brier target not met")
        if not isinstance(review.get("ece"), (int, float)) or review["ece"] > 0.10:
            reasons.append("Calibration ECE target not met")
        if not isinstance(review.get("coverage"), (int, float)) or review["coverage"] < 0.90:
            reasons.append("Eligible-domain coverage target not met")
        if not review.get("held_out_model_families_checked"):
            reasons.append("Unseen generator-family testing missing")
        if not review.get("group_audits_passed"):
            reasons.append("Language/domain/proficiency subgroup audit missing")
        if not governance.get("provenance_reviewed") or not governance.get("approval_ref"):
            reasons.append("Independent data provenance/approval evidence missing")
        if not governance.get("release_approved"):
            reasons.append("Explicit release approval missing")
        return not reasons, reasons


def _finite(value: object) -> bool:
    return type(value) in (float, int) and math.isfinite(value)


def validate(raw: dict) -> CalibratedArtifact:
    if not isinstance(raw, dict) or raw.get("format") != ARTIFACT_FORMAT:
        raise ValueError("Unrecognized calibration format")
    if raw.get("feature_version") != VERSION or raw.get("features") != list(FEATURE_NAMES):
        raise ValueError("Calibration feature set or order changed")
    if raw.get("unit") not in SCOPE_VALUES:
        raise ValueError("Calibration scope must be document, paragraph or sentence")
    if not isinstance(raw.get("version"), str) or not 1 <= len(raw["version"]) <= 120:
        raise ValueError("Model version missing")
    config = raw.get("eligibility")
    if not isinstance(config, dict):
        raise ValueError("Eligibility policy missing")
    for key, values in (("languages", ("en", "ar", "mixed")), ("domains", None), ("contexts", ("general", "formal", "non_native", "academic"))):
        group = config.get(key)
        if not isinstance(group, list) or not 1 <= len(group) <= 40 or not all(
            isinstance(item, str) and 1 <= len(item) <= 64 and (values is None or item in values) for item in group
        ):
            raise ValueError("Invalid eligibility group " + key)
    if not isinstance(config.get("min_words"), int) or not 75 <= config["min_words"] <= 1000:
        raise ValueError("Invalid trained minimum word count")
    predictor = raw.get("predictor")
    if not isinstance(predictor, dict):
        raise ValueError("Predictor parameters missing")
    n = len(FEATURE_NAMES)
    for key, length in (("center", n), ("scale", n), ("weights", n * 2)):
        a = predictor.get(key)
        if not isinstance(a, list) or len(a) != length or not all(_finite(v) for v in a):
            raise ValueError("Invalid model parameter " + key)
    if any(v <= 0 for v in predictor["scale"]):
        raise ValueError("Non-positive feature scale")
    if not _finite(predictor.get("intercept")):
        raise ValueError("Invalid intercept")
    cal = predictor.get("calibration")
    if not isinstance(cal, dict) or not _finite(cal.get("coef")) or not _finite(cal.get("intercept")):
        raise ValueError("Invalid calibrator")
    threshold = raw.get("thresholds", {})
    if not (_finite(threshold.get("low")) and _finite(threshold.get("high"))
            and 0 < threshold["low"] < 0.5 < threshold["high"] < 1):
        raise ValueError("Invalid classification thresholds")
    reference = raw.get("ngram_reference")
    if reference is not None:
        if not isinstance(reference, dict) or reference.get("version") != "ngram-reference-v1":
            raise ValueError("Invalid reference ngram corpus")
        if any(not isinstance(reference.get(key), dict) or len(reference[key]) > 5000 for key in ("human", "ai")):
            raise ValueError("Oversized ngram reference")
    return CalibratedArtifact(raw)


def load_artifact(directory: str | Path, unit: str, language: str) -> CalibratedArtifact | None:
    if unit not in SCOPE_VALUES or language not in ("en", "ar", "mixed"):
        raise ValueError("Invalid analysis scope or language")
    base = Path(directory).resolve()
    source = base / (unit + "." + language + ".json")
    if not source.is_file():
        return None
    if source.stat().st_size > 1_500_000:
        raise ValueError("Calibration artifact too large")
    raw = json.loads(source.read_text(encoding="utf-8"))
    artifact = validate(raw)
    if artifact.unit != unit:
        raise ValueError("Calibration unit mismatch")
    # Release manifest must match exact bytes of the artifact and is separate from
    # the model output. A manual approval still requires the metric gates above.
    manifest = base / (unit + "." + language + ".approval.json")
    if manifest.is_file():
        release = json.loads(manifest.read_text(encoding="utf-8"))
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if release.get("artifact_sha256") != digest or release.get("version") != artifact.version:
            raise ValueError("Calibration release manifest fingerprint mismatch")
    elif artifact.raw.get("governance", {}).get("release_approved"):
        raise ValueError("Approved artifact is missing its integrity manifest")
    if language not in artifact.languages:
        raise ValueError("Calibration language mismatch")
    return artifact
