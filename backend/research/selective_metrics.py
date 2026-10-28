"""E3 independent research diagnostics for selective AI-text detection.

Abstentions are neither true negatives nor correct AI detections.
Raw model signals are not independently calibrated authorship probabilities.
No fitting and no release-test optimization occurs in this module.
All returned evidence is aggregate, never document bodies or group identities.
"""
from __future__ import annotations

import math
import random
from collections import defaultdict
from statistics import NormalDist
from typing import Any

try:
    from evaluation.score_detector import auc as _auc
except ImportError:
    _auc = None

CLASSES = ("human", "ai")
RECOGNIZED_DOMAINS = {"academic", "technical", "formal", "general", "esl", "news", "creative"}
RECOGNIZED_LANGUAGES = {"en", "ar"}
# Never let missing/placeholder identifiers merge unrelated records.
EMPTY_GROUPS = {"", "unknown", "none", "n/a", "null", "not_applicable"}
# More than one identifier may connect two rows through different paths.
# Prefix every value with its field to avoid cross-field name collisions.
SOURCE_LINK_FIELDS = ("content_digest", "source_group", "author_group",
                      "article_group", "prompt_group")


def _ratio(n: int, d: int) -> float | None:
    return n / d if d else None


def one_sided_wilson_upper(errors: int, total: int, alpha: float = .05) -> float | None:
    """One-sided Wilson upper bound at 1-alpha, NOT a two-sided 95% CI."""
    if (not isinstance(errors, int) or not isinstance(total, int) or
            isinstance(errors, bool) or isinstance(total, bool) or
            errors < 0 or total < 0 or errors > total or not 0 < alpha < .5):
        raise ValueError("INVALID_WILSON_DENOMINATOR_OR_ALPHA")
    if not total:
        return None
    z = NormalDist().inv_cdf(1 - alpha)
    p = errors / total
    d = 1 + z * z / total
    center = (p + z * z / (2 * total)) / d
    margin = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total ** 2)) / d
    return min(1., center + margin)


def _wilson_two_sided(success: int, total: int) -> dict | None:
    if not total:
        return None
    z = NormalDist().inv_cdf(.975)
    p = success / total
    d = 1 + z * z / total
    c = (p + z * z / (2 * total)) / d
    h = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total ** 2)) / d
    return {"lower": max(0., c - h), "upper": min(1., c + h)}


def _score(row: dict) -> float | None:
    if row.get("status") in ("INCONCLUSIVE", "UNSUPPORTED", "CANCELLED", "ERROR"):
        return None
    value = row.get("score")
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        raise ValueError("INVALID_SCORE")
    value = float(value)
    if not math.isfinite(value) or not 0 <= value <= 1:
        raise ValueError("INVALID_SCORE")
    return value


def _counts(rows: list[dict], threshold: float):
    matrix = {"tp": 0, "fp": 0, "tn": 0, "fn": 0}
    total = {"human": 0, "ai": 0}
    abstained = {"human": 0, "ai": 0}
    points = []
    reasons = defaultdict(int)
    for row in rows:
        label = row.get("label")
        if label not in CLASSES:
            raise ValueError("INVALID_CLASS_LABEL")
        total[label] += 1
        value = _score(row)
        if value is None:
            abstained[label] += 1
            reason = str(row.get("abstention_reason") or row.get("status") or "UNSPECIFIED")
            reasons[reason if reason in ("INCONCLUSIVE", "UNSUPPORTED", "CANCELLED",
                                        "ERROR", "LOW_COVERAGE") else "OTHER"] += 1
            continue
        positive = value >= threshold
        key = ("tp" if positive else "fn") if label == "ai" else ("fp" if positive else "tn")
        matrix[key] += 1
        points.append((value, int(label == "ai")))
    return matrix, total, abstained, points, reasons


def _diagnostic_calibration(points: list[tuple]) -> tuple[float | None, float | None]:
    if not points:
        return None, None
    brier = sum((v - target) ** 2 for v, target in points) / len(points)
    ece = 0.
    for bin_index in range(10):
        lower, upper = bin_index / 10, (bin_index + 1) / 10
        subset = [(p, y) for p, y in points if lower <= p < upper or (bin_index == 9 and p == 1.)]
        if subset:
            mean_score = sum(p for p, _ in subset) / len(subset)
            mean_label = sum(y for _, y in subset) / len(subset)
            ece += len(subset) / len(points) * abs(mean_score - mean_label)
    return brier, ece


def _core(rows: list[dict], threshold: float) -> dict:
    matrix, totals, absent, points, reasons = _counts(rows, threshold)
    tp, fp, tn, fn = (matrix[k] for k in ("tp", "fp", "tn", "fn"))
    observed = len(points)
    human_assessed, ai_assessed = fp + tn, tp + fn
    brier, ece = _diagnostic_calibration(points)
    precision = _ratio(tp, tp + fp)
    recall = _ratio(tp, tp + fn)
    fpr = _ratio(fp, human_assessed)
    fnr = _ratio(fn, ai_assessed)
    f1 = _ratio(2 * tp, 2 * tp + fp + fn)
    return {
        "n_total": len(rows), "n_scored": observed,
        "n_abstained": len(rows) - observed,
        "coverage": _ratio(observed, len(rows)),
        "human_total": totals["human"], "ai_total": totals["ai"],
        "human_assessed": human_assessed, "ai_assessed": ai_assessed,
        "human_abstained": absent["human"], "ai_abstained": absent["ai"],
        "confusion_matrix": matrix,
        "human_fpr_assessed": fpr,
        "human_fpr_all_minimum": _ratio(fp, totals["human"]),
        "human_fpr_all_maximum": _ratio(fp + absent["human"], totals["human"]),
        "ai_fnr_assessed": fnr,
        "ai_fnr_all_minimum": _ratio(fn, totals["ai"]),
        "ai_fnr_all_maximum": _ratio(fn + absent["ai"], totals["ai"]),
        "precision_assessed": precision, "recall_assessed": recall, "f1_assessed": f1,
        "auroc": _auc(points) if _auc is not None and observed else None,
        "brier_score_diagnostic": brier,
        "ece_10_bin_diagnostic": ece,
        "abstention_reasons": dict(sorted(reasons.items())),
        "confidence_intervals": {
            "fpr_assessed_one_sided_upper95": one_sided_wilson_upper(fp, human_assessed),
            "fnr_assessed_one_sided_upper95": one_sided_wilson_upper(fn, ai_assessed),
            "precision_assessed_wilson95": _wilson_two_sided(tp, tp + fp),
            "recall_assessed_wilson95": _wilson_two_sided(tp, ai_assessed),
        },
    }


def _group_keys(row: dict) -> list[tuple[str, str]]:
    """Private, typed identifiers for connected source/author/article clusters.

    Missing metadata must not establish independence. These identifiers are
    held in process only; only aggregate cluster counts leave this module.
    """
    keys = []
    for field in SOURCE_LINK_FIELDS:
        value = row.get(field)
        if isinstance(value, str) and value.strip().lower() not in EMPTY_GROUPS:
            keys.append((field, value.strip()))
    return keys


def _cluster_bootstrap_fpr(rows: list[dict], threshold: float, seed: int) -> tuple[dict | None, int]:
    # Historical defect: choosing just source_group split excerpts from the
    # same author into falsely independent bootstrap units. Build connected
    # components over *all* known identifiers, including transitive links.
    parent = list(range(len(rows)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    owners: dict[tuple[str, str], int] = {}
    for index, row in enumerate(rows):
        identifiers = _group_keys(row)
        if not identifiers:
            # Unknown grouping makes cluster-level uncertainty unestimable.
            return None, 0
        for identifier in identifiers:
            prior = owners.get(identifier)
            if prior is not None:
                union(index, prior)
            else:
                owners[identifier] = index

    grouped: dict[int, list[dict]] = defaultdict(list)
    for index, row in enumerate(rows):
        grouped[find(index)].append(row)
    n_groups = len(grouped)
    # Preserve links through AI records (they can connect two human authors),
    # but sample only the HUMAN observations for an interval about HUMAN FPR.
    # Otherwise adding unrelated AI groups changes a human-only interval.
    human_groups = [[row for row in cluster if row["label"] == "human"]
                    for cluster in grouped.values()]
    human_groups = [cluster for cluster in human_groups if cluster]
    if len(human_groups) < 2:
        return None, n_groups

    # Stable HUMAN cluster order irrespective of AI-only rows or input order.
    # Identifiers are private in-process data, never serialized in the report.
    clusters = sorted(
        human_groups,
        key=lambda part: min(key for row in part for key in _group_keys(row))
    )
    rng = random.Random(seed)
    rates = []
    for _ in range(400):
        sampled = []
        for _ in clusters:
            sampled.extend(rng.choice(clusters))
        matrix, _, _, _, _ = _counts(sampled, threshold)
        denom = matrix["fp"] + matrix["tn"]
        if denom:
            rates.append(matrix["fp"] / denom)
    if len(rates) < 200:
        return None, n_groups
    rates.sort()
    return {"lower": rates[int(.025 * (len(rates) - 1))],
            "upper": rates[int(.975 * (len(rates) - 1))],
            "method": "HUMAN_CONNECTED_CLUSTER_BOOTSTRAP_RESEARCH_400_V2"}, n_groups


def _bucket(row: dict, field: str, train_families: set[str] | None):
    if field == "language":
        val = row.get("language")
        return val if val in RECOGNIZED_LANGUAGES else "unknown"
    if field == "domain":
        val = row.get("domain")
        return val if val in RECOGNIZED_DOMAINS else "other"
    if field == "length":
        words = row.get("word_count")
        if not isinstance(words, int) or isinstance(words, bool) or words < 0:
            return "unknown"
        return "short" if words < 120 else "medium" if words < 1000 else "long"
    if field in ("esl", "formal"):
        val = row.get(field)
        return "yes" if val is True else "no" if val is False else "unknown"
    if field == "unseen_generator":
        if row.get("label") != "ai":
            return None
        family = row.get("model_family")
        if not isinstance(family, str) or not family:
            return "unknown"
        return "seen" if family in train_families else "unseen"
    return None


def compute_selective_metrics(
    rows: list[dict], alert_threshold: float = .8,
    bootstrap_seed: int = 20261013, train_model_families: set[str] | None = None
) -> dict:
    """Deterministic metadata-only research report (always HOLD for release)."""
    if not isinstance(rows, list) or not (isinstance(alert_threshold, (float, int))
        and not isinstance(alert_threshold, bool)
        and math.isfinite(alert_threshold) and 0 < alert_threshold < 1):
        raise ValueError("INVALID_RESEARCH_THRESHOLD")
    if not isinstance(bootstrap_seed, int) or isinstance(bootstrap_seed, bool):
        raise TypeError("Expected deterministic bootstrap seed")
    if train_model_families is not None and not isinstance(train_model_families, set):
        raise TypeError("Expected training model-family set")
    if any(not isinstance(r, dict) for r in rows):
        raise TypeError("Expected cohort metadata rows")
    splits = {str(r.get("split", "research")) for r in rows}
    if len(splits) > 1:
        raise ValueError("MIXED_SPLITS_CANNOT_BE_EVALUATED_TOGETHER")
    for r in rows:
        _score(r) # reject invalid scalar even on future data versions
        if r.get("label") not in CLASSES:
            raise ValueError("INVALID_CLASS_LABEL")
    result = _core(rows, alert_threshold)
    ci, n_groups = _cluster_bootstrap_fpr(rows, alert_threshold, bootstrap_seed)
    result["group_bootstrap_fpr_ci95"] = ci
    result["independent_source_groups"] = n_groups
    missing_metadata = any(
        _bucket(r, "language", train_model_families) == "unknown" or
        _bucket(r, "domain", train_model_families) == "other" or
        _bucket(r, "length", train_model_families) == "unknown" or
        _bucket(r, "esl", train_model_families) == "unknown" or
        _bucket(r, "formal", train_model_families) == "unknown" for r in rows)
    gaps = []
    if missing_metadata:
        gaps.append("MISSING_SUBGROUP_METADATA")
    if ci is None:
        gaps.append("GROUP_BOOTSTRAP_UNESTIMABLE")
    if any(r.get("label_provenance") != "INDEPENDENTLY_VERIFIED" for r in rows):
        gaps.append("INDEPENDENT_LABEL_EVIDENCE_UNCONFIRMED")
    # Aggregate categorically. Never emit free-form domain, model names,
    # source-group strings, user text, IDs, prompts or author metadata.
    subgroups = {}
    for field in ("language", "domain", "length", "esl", "formal",
                  *(("unseen_generator",) if train_model_families is not None else ())):
        cohorts = defaultdict(list)
        for r in rows:
            bucket = _bucket(r, field, train_model_families)
            if bucket is not None:
                cohorts[bucket].append(r)
        subgroups[field] = {
            name: {
                "n_total": _core(part, alert_threshold)["n_total"],
                "n_scored": _core(part, alert_threshold)["n_scored"],
                "fpr_assessed": _core(part, alert_threshold)["human_fpr_assessed"],
                "fnr_assessed": _core(part, alert_threshold)["ai_fnr_assessed"],
            } for name, part in sorted(cohorts.items())
        }
    result.update({
        "subgroups": subgroups,
        "evidence_gaps": gaps,
        "alert_threshold": float(alert_threshold),
        "calibration_status": "UNCALIBRATED_RESEARCH_DIAGNOSTIC",
        "research_release_gate": "HOLD",
        "methodology_note": ("Assessed-only rates exclude abstentions; all-source error "
                             "bounds count abstentions as unknown, never true negatives."),
    })
    return result
