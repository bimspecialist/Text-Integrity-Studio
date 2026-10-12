"""Reproducible held-out training + sigmoid calibration; never train on test labels.

Example:
python -m hybrid_detector.train --dataset private/corpus.jsonl \
  --output private/artifacts --language ar --domain academic --unit document

The tool ALWAYS emits an unapproved model. A separate independent audit and
artifact approval are needed before runtime exposes percentages.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from .artifacts import ARTIFACT_FORMAT
from .features import FEATURE_NAMES, VERSION, Extractor, profile_from_corpora
from .engine import signal_families
from .text import detect_language, tokenize


def read_dataset(path: Path, language: str, domain: str, unit: str) -> dict[str, list[dict]]:
    result: dict[str, list[dict]] = {"train": [], "calibration": [], "test": []}
    unique_ids, hashes = set(), {}
    groups: dict[str, set[str]] = defaultdict(set)
    with path.open(encoding="utf-8-sig") as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            record = json.loads(line)
            if not isinstance(record, dict):
                raise ValueError(f"Invalid JSON object on line {line_number}")
            if any(key not in record for key in ("id", "label", "split", "language", "domain", "text", "author_group", "source_group")):
                raise ValueError(f"Missing provenance fields on line {line_number}")
            split, label = record["split"], record["label"]
            if split not in result or label not in ("human", "ai"):
                raise ValueError(f"Invalid split/label on line {line_number}")
            ident = str(record["id"])
            if not ident or ident in unique_ids:
                raise ValueError("Duplicate or blank example ID")
            unique_ids.add(ident)
            text = record["text"]
            if not isinstance(text, str) or not 75 <= len(tokenize(text)) <= 12000:
                raise ValueError("Labeled text outside 75-12000 word bounds")
            digest = hashlib.sha256(" ".join(text.casefold().split()).encode()).hexdigest()
            if digest in hashes and hashes[digest] != split:
                raise ValueError("Text duplicate crosses frozen train/calibration/test splits")
            hashes[digest] = split
            for key in ("author_group", "source_group"):
                if not str(record[key]).strip():
                    raise ValueError("Source and author groups must be recorded")
                # Prevent source/prompt/author contamination between all splits.
                groups[key + ":" + str(record[key])].add(split)
            if record["language"] not in ("en", "ar", "mixed"):
                raise ValueError("Unsupported data language")
            if detect_language(text) != record["language"]:
                raise ValueError("Declared language differs from writing script")
            if record["language"] == language and record["domain"] == domain and record.get("unit", "document") == unit:
                result[split].append(record)
    leaks = [key for key, splits in groups.items() if len(splits) > 1]
    if leaks:
        raise ValueError("Group leakage between holdouts: " + ", ".join(leaks[:5]))
    return result


def wilson(successes: int, total: int) -> float:
    if total <= 0:
        return 1.0
    z = 1.96
    p = successes / total
    denom = 1 + z * z / total
    half = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denom
    center = (p + z * z / (2 * total)) / denom
    return min(1.0, center + half)


def ece(y: list[int], prob: list[float], bins: int = 10) -> float:
    total = len(y)
    if total == 0:
        return 1.0
    error = 0.0
    for bucket in range(bins):
        sample = [
            (target, score)
            for target, score in zip(y, prob)
            if bucket / bins <= score < (bucket + 1) / bins or (bucket == bins - 1 and score == 1)
        ]
        if sample:
            correct = sum(t for t, _ in sample) / len(sample)
            predicted = sum(s for _, s in sample) / len(sample)
            error += len(sample) / total * abs(correct - predicted)
    return error


def _matrix(values: list[dict], medians: list[float], scales: list[float]) -> list[list[float]]:
    rows = []
    for values_by_key in values:
        numbers, missing = [], []
        for name, center, scale in zip(FEATURE_NAMES, medians, scales):
            v = values_by_key.get(name)
            if v is None or not math.isfinite(float(v)):
                numbers.append(0.0)
                missing.append(1.0)
            else:
                numbers.append(max(-8.0, min(8.0, (float(v) - center) / scale)))
                missing.append(0.0)
        rows.append(numbers + missing)
    return rows


def fit(dataset: dict[str, list[dict]], *, language: str, domain: str, unit: str, version: str) -> dict:
    import numpy as np
    from sklearn.linear_model import LogisticRegression

    classes = {}
    for split, records in dataset.items():
        classes[split] = Counter(rec["label"] for rec in records)
        if min(classes[split].get("human", 0), classes[split].get("ai", 0)) < 30:
            raise ValueError(f"At least 30 verified human AND AI items required in {split}; this is a software minimum, not a release gate")
    reference = profile_from_corpora(
        [r["text"] for r in dataset["train"] if r["label"] == "human"],
        [r["text"] for r in dataset["train"] if r["label"] == "ai"],
    )
    # Resolve exactly the same local, pinned adapters used by serving.
    from .api import _local_adapters
    extractor = Extractor(ngram_reference=reference, **_local_adapters())
    # Production optional adapters must be supplied consistently to BOTH this
    # training feature extraction and serving. No missing feature is forged.
    by_split = {}
    for name, records in dataset.items():
        by_split[name] = [extractor.extract(r["text"]) for r in records]

    train = by_split["train"]
    centers, scales = [], []
    for key in FEATURE_NAMES:
        known = [f.values[key] for f in train if f.values[key] is not None]
        center = float(statistics.median(known)) if known else 0.0
        scale = float(statistics.pstdev(known)) if len(known) > 1 else 1.0
        centers.append(center)
        scales.append(scale if scale > 1e-8 else 1.0)
    matrix = {k: _matrix([f.values for f in data], centers, scales) for k, data in by_split.items()}
    target = {k: np.array([int(r["label"] == "ai") for r in data]) for k, data in dataset.items()}
    base = LogisticRegression(max_iter=1600, class_weight="balanced", C=0.5, random_state=41)
    base.fit(matrix["train"], target["train"])
    calibration_decisions = base.decision_function(matrix["calibration"]).reshape(-1, 1)
    calibrator = LogisticRegression(max_iter=500, random_state=41)
    calibrator.fit(calibration_decisions, target["calibration"])
    cal_scores = calibrator.predict_proba(calibration_decisions)[:, 1].tolist()
    test_scores = calibrator.predict_proba(base.decision_function(matrix["test"]).reshape(-1, 1))[:, 1].tolist()

    # Choose high-alert operating threshold on CALIBRATION ONLY, then freeze.
    human_cal = sorted(
        score for score, row in zip(cal_scores, dataset["calibration"]) if row["label"] == "human"
    )
    high = min(0.999, max(0.90, human_cal[-1] + 1e-6))
    low = 0.10
    test_y = target["test"].tolist()
    counts = Counter(r["label"] for r in dataset["test"])
    fp = sum(score >= high and label == 0 for label, score in zip(test_y, test_scores))
    tp = sum(score >= high and label == 1 for label, score in zip(test_y, test_scores))
    fpr_upper = wilson(fp, counts["human"])
    brier = sum((score - target) ** 2 for score, target in zip(test_scores, test_y)) / len(test_y)
    error = ece(test_y, test_scores)
    families = [signal_families(f) for f in by_split["test"]]
    coverage = sum(len(row) >= 3 for row in families) / len(families)
    train_models = {r.get("model_family") for r in dataset["train"] if r["label"] == "ai"}
    unseen_models = {
        r.get("model_family") for r in dataset["test"]
        if r["label"] == "ai" and r.get("model_family") not in train_models
    }
    contexts = {
        r.get("writing_context", "general") for r in dataset["test"]
        if r["label"] == "human" and r.get("writing_context", "general") in ("general", "formal", "non_native", "academic")
    }
    # Group review requires enough independently verified human cases per named
    # writing context, not just a pooled FPR score.
    groups_passed = bool(contexts) and all(
        len([r for r in dataset["test"] if r["label"] == "human" and r.get("writing_context", "general") == context]) >= 100
        for context in contexts
    )
    test_stats = {
        "human_test_n": counts["human"], "ai_test_n": counts["ai"],
        "fpr_at_high_alert_threshold": fp / counts["human"],
        "fpr_wilson_upper_95": fpr_upper,
        "tpr_at_high_alert_threshold": tp / counts["ai"],
        "brier": brier, "ece": error, "coverage": coverage,
        "held_out_model_families_checked": bool(unseen_models),
        "group_audits_passed": groups_passed,
        "test_prevalence_ai": counts["ai"] / len(test_y),
    }
    return {
        "format": ARTIFACT_FORMAT, "feature_version": VERSION, "features": list(FEATURE_NAMES),
        "unit": unit, "version": version,
        "eligibility": {
            "languages": [language], "domains": [domain],
            "contexts": sorted(contexts) if contexts else ["general"],
            "min_words": 180 if unit == "document" else 75,
        },
        "predictor": {
            "center": centers, "scale": scales,
            "weights": [float(x) for x in base.coef_[0]],
            "intercept": float(base.intercept_[0]),
            "calibration": {
                "method": "sigmoid_independent_calibration_split",
                "coef": float(calibrator.coef_[0, 0]),
                "intercept": float(calibrator.intercept_[0]),
            },
        },
        "ngram_reference": reference,
        "thresholds": {"low": low, "high": high},
        "validation": test_stats,
        "governance": {
            "provenance_reviewed": False, "approval_ref": None,
            "release_approved": False, "warning": "RESEARCH ONLY; operator must separately review provenance and subgroup false positives",
        },
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dataset", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--language", choices=("en", "ar", "mixed"), required=True)
    p.add_argument("--domain", default="general")
    p.add_argument("--unit", choices=("document", "paragraph", "sentence"), default="document")
    p.add_argument("--version", default="experimental-1")
    args = p.parse_args()
    data = read_dataset(args.dataset, args.language, args.domain, args.unit)
    artifact = fit(data, language=args.language, domain=args.domain, unit=args.unit, version=args.version)
    args.output.mkdir(parents=True, exist_ok=True)
    target = args.output / (args.unit + "." + args.language + ".json")
    target.write_text(json.dumps(artifact, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps({"artifact": str(target), "release_approved": False, "validation": artifact["validation"]}, indent=2))


if __name__ == "__main__":
    main()
