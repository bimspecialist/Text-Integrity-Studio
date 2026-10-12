#!/usr/bin/env python3
"""Evidence-oriented detector evaluation. Standard library only.

Data contract: CSV columns id,label,score,split,language,domain,dialect,
author_group,model_family,edit_type. label is 'human' or 'ai'; score is a
model signal in [0,1] or empty to abstain. A score is NOT necessarily
a calibrated probability; call it that only after independent calibration.
"""
import argparse
import csv
import json
import math
import sys
from collections import defaultdict
from datetime import datetime, timezone


def ratio(n, d):
    return n / d if d else None


def wilson(successes, total, z=1.96):
    if total == 0:
        return None
    p = successes / total
    denom = 1.0 + z * z / total
    mid = (p + z * z / (2 * total)) / denom
    half = z * math.sqrt((p * (1 - p) / total) + (z * z / (4 * total ** 2))) / denom
    return {"lower": max(0, mid - half), "upper": min(1, mid + half)}


def auc(points):
    ordered = sorted(points, key=lambda x: x[0])
    positives = sum(y for _, y in ordered)
    negatives = len(ordered) - positives
    if not positives or not negatives:
        return None
    sum_positive_ranks = 0.
    i = 0
    while i < len(ordered):
        j = i + 1
        while j < len(ordered) and ordered[i][0] == ordered[j][0]:
            j += 1
        avg_rank = ((i + 1) + j) / 2.0
        sum_positive_ranks += avg_rank * sum(y for _, y in ordered[i:j])
        i = j
    return (sum_positive_ranks - positives * (positives + 1) / 2) / (positives * negatives)


def score_rows(rows, threshold=0.5, calibrated=False):
    scored = [r for r in rows if r["score"] is not None]
    count = {"tp": 0, "fp": 0, "tn": 0, "fn": 0}
    for row in scored:
        predicted = "ai" if row["score"] >= threshold else "human"
        actual = row["label"]
        count["tp" if predicted == "ai" and actual == "ai" else
              "fp" if predicted == "ai" else
              "tn" if actual == "human" else "fn"] += 1
    tp, fp, tn, fn = count["tp"], count["fp"], count["tn"], count["fn"]
    points = [(r["score"], int(r["label"] == "ai")) for r in scored]
    result = {
        "n_total": len(rows), "n_scored": len(scored),
        "n_abstained": len(rows) - len(scored), "coverage": ratio(len(scored), len(rows)),
        "human_scored": tn + fp, "ai_scored": tp + fn,
        "confusion_matrix": count,
        "false_positive_rate": ratio(fp, fp + tn),
        "fpr_wilson_95": wilson(fp, fp + tn),
        "true_positive_rate": ratio(tp, tp + fn),
        "precision": ratio(tp, tp + fp),
        "f1": ratio(2 * tp, 2 * tp + fp + fn),
        "balanced_accuracy": (ratio(tp, tp + fn) + ratio(tn, tn + fp)) / 2
            if (tp + fn and tn + fp) else None,
        "auroc": auc(points),
    }
    if calibrated and scored:
        result["brier_score"] = sum((s - y) ** 2 for s, y in points) / len(points)
        ece = 0.
        for bucket in range(10):
            local = [(s, y) for s, y in points if
                     (bucket / 10 <= s < (bucket + 1) / 10 or (bucket == 9 and s == 1))]
            if local:
                mean_predicted = sum(s for s, _ in local) / len(local)
                observed = sum(y for _, y in local) / len(local)
                ece += len(local) / len(points) * abs(mean_predicted - observed)
        result["ece_10_bin"] = ece
    return result


def load_csv(path):
    seen, data = set(), []
    with open(path, encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for required in ("id", "label", "score"):
            if required not in (reader.fieldnames or []):
                raise ValueError("Missing required CSV column: " + required)
        for index, row in enumerate(reader, 2):
            key = row["id"].strip()
            if not key or key in seen:
                raise ValueError("Duplicate or empty case id on line " + str(index))
            seen.add(key)
            label = row["label"].strip().lower()
            if label not in ("human", "ai"):
                raise ValueError("Use label human or ai on line " + str(index))
            raw_score = (row["score"] or "").strip()
            score = None if not raw_score else float(raw_score)
            if score is not None and (not math.isfinite(score) or not 0 <= score <= 1):
                raise ValueError("Score outside [0,1] on line " + str(index))
            parsed = {key: (value or "").strip() for key, value in row.items() if key is not None}
            parsed["label"], parsed["score"] = label, score
            data.append(parsed)
    return data


def evaluate(data, threshold=0.5, split="test", calibrated=False, minimum=30,
             maximum_fpr=0.01):
    filtered = [r for r in data if not r.get("split") or r["split"].lower() == split.lower()]
    overall = score_rows(filtered, threshold, calibrated)
    grouped = {}
    for field in ("language", "dialect", "domain", "edit_type"):
        group = defaultdict(list)
        for row in filtered:
            group[row.get(field) or "not_recorded"].append(row)
        grouped[field] = {}
        for name, sample in sorted(group.items()):
            details = score_rows(sample, threshold, calibrated)
            details["sample_sufficiency"] = "PASS" if details["human_scored"] >= minimum and details["ai_scored"] >= minimum else "INSUFFICIENT"
            grouped[field][name] = details
    human_n, ai_n = overall["human_scored"], overall["ai_scored"]
    fpr_ci = overall["fpr_wilson_95"]
    gates = {
        "representative_human_test_samples": "PASS" if human_n >= 300 else "UNKNOWN",
        "representative_ai_test_samples": "PASS" if ai_n >= 300 else "UNKNOWN",
        "false_positive_ci_upper_below_target": "PASS" if fpr_ci and fpr_ci["upper"] <= maximum_fpr else "UNKNOWN",
        "coverage_at_least_90pct": "PASS" if overall["coverage"] is not None and overall["coverage"] >= .9 else "UNKNOWN",
        "multilingual_strata_sample_adequacy": "PASS" if all(
            d["sample_sufficiency"] == "PASS" for d in grouped["language"].values()) else "UNKNOWN",
        "independent_provenance_calibration_checked": "UNKNOWN",  # requires human review
    }
    return {
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "threshold": threshold, "selected_split": split,
        "score_semantics": "independently_calibrated_probability" if calibrated else "raw_model_signal_not_a_probability",
        "minimum_group_samples_per_class": minimum, "maximum_acceptable_fpr": maximum_fpr,
        "overall": overall, "groups": grouped, "gates": gates,
        "decision": "INCONCLUSIVE" if any(v != "PASS" for v in gates.values()) else "CONDITIONAL_MANUAL_REVIEW",
        "note": "No approval for academic misconduct decisions. Scores alone do not establish authorship.",
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("csv", help="Labeled benchmark CSV with score [0,1]; blank score=abstain")
    p.add_argument("--threshold", type=float, default=0.5)
    p.add_argument("--split", default="test")
    p.add_argument("--calibrated", action="store_true", help="Use only after independent calibration; enables Brier/ECE")
    p.add_argument("--minimum-per-class", type=int, default=30)
    p.add_argument("--max-fpr", type=float, default=0.01)
    p.add_argument("--output", help="Optional JSON output file")
    a = p.parse_args()
    if not (0 < a.threshold < 1 and 0 <= a.max_fpr <= 1):
        p.error("threshold must be between 0 and 1; max-fpr must be between 0 and 1")
    result = evaluate(load_csv(a.csv), a.threshold, a.split, a.calibrated,
                      a.minimum_per_class, a.max_fpr)
    report = json.dumps(result, ensure_ascii=False, indent=2)
    if a.output:
        with open(a.output, "w", encoding="utf-8") as handle:
            handle.write(report + "\n")
    print(report)


if __name__ == "__main__":
    main()
