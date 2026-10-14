"""Offline-only research calibration; NEVER produces browser detector probabilities.

Fit uses *calibration* rows only, and evaluate uses *validation* rows only.
The untouched RELEASE_TEST is represented by frozen hashes in the manifest;
no release labels, texts or scores may be supplied to the fitter.

Synthetic attestations can satisfy structural tests, NOT scientific approval.
"""
from __future__ import annotations

import bisect
import hashlib
import json
import math
import re

from backend.research.cohort_split import PARTITIONS, GROUP_KEYS

_SHA40 = re.compile(r"^[a-f0-9]{40}$")
_MISSING = {None, "", "unknown", "none", "n/a", "null", "not_applicable"}
_MIN = 5


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _fingerprint(manifest: dict) -> str:
    return _sha(json.dumps(manifest, sort_keys=True, separators=(",", ":"),
                           ensure_ascii=False))


def _sigmoid(value: float) -> float:
    value = max(-50., min(50., value))
    return 1. / (1. + math.exp(-value))


def _groups(row: dict) -> set[str]:
    return {_sha(field + "\\x00" + value)
            for field in GROUP_KEYS
            if isinstance((value := row.get(field)), str)
            and value.strip().lower() not in _MISSING}


def _manifest_guard(manifest: dict) -> None:
    if not isinstance(manifest, dict):
        raise ValueError("FROZEN_SPLIT_MANIFEST_REQUIRED")
    ids = manifest.get("case_id_sha256")
    groups = manifest.get("group_hashes_sha256")
    if not isinstance(ids, dict) or not isinstance(groups, dict):
        raise ValueError("FROZEN_SPLIT_IDS_AND_GROUPS_REQUIRED")
    if manifest.get("group_hash_privacy") != "UNSALTED_RESEARCH_ONLY_DO_NOT_PUBLISH":
        raise ValueError("FROZEN_GROUP_PRIVACY_SCOPE_REQUIRED")
    if not all(isinstance(ids.get(name), list) and isinstance(groups.get(name), list)
               for name in PARTITIONS):
        raise ValueError("INCOMPLETE_FROZEN_SPLIT_MANIFEST")
    for kind, mapping in (("CASE", ids), ("GROUP", groups)):
        owned = set()
        for name in PARTITIONS:
            local = mapping[name]
            if len(local) != len(set(local)):
                raise ValueError("DUPLICATE_" + kind + "_HASH")
            if not all(re.fullmatch("[0-9a-f]{64}", str(x)) for x in local):
                raise ValueError("INVALID_" + kind + "_DIGEST")
            if owned.intersection(local):
                raise ValueError("CROSS_SPLIT_" + kind + "_LEAKAGE")
            owned.update(local)


def _rows_for_split(rows: list[dict], manifest: dict, expected: str,
                    require_verified: bool = True) -> tuple[list[tuple[float, int]], str]:
    _manifest_guard(manifest)
    if not isinstance(rows, list) or not rows:
        raise ValueError("INSUFFICIENT_SPLIT_SAMPLES")
    allowed = set(manifest["case_id_sha256"][expected])
    group_set = set(manifest["group_hashes_sha256"][expected])
    used_ids = set()
    pairs = []
    revisions = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("INVALID_CALIBRATION_ROWS")
        key = row.get("id")
        if not isinstance(key, str) or _sha(key) not in allowed:
            raise ValueError("INVALID_" + expected.upper() + "_SPLIT_CASE_ID")
        if key in used_ids:
            raise ValueError("DUPLICATE_SPLIT_SAMPLE")
        used_ids.add(key)
        actual_groups = _groups(row)
        if not actual_groups or not actual_groups.issubset(group_set):
            raise ValueError("FROZEN_GROUP_LEAKAGE_OR_METADATA_MISMATCH")
        if (require_verified and
            row.get("label_provenance") != "INDEPENDENTLY_VERIFIED"):
            raise ValueError("UNVERIFIED_LABELS_CANNOT_FIT")
        label = row.get("label")
        score = row.get("score")
        if label not in ("ai", "human") or isinstance(score, bool) or not isinstance(score, (int, float)):
            raise ValueError("INVALID_RESEARCH_LABEL_OR_SCORE")
        if not math.isfinite(score) or not 0 <= score <= 1:
            raise ValueError("INVALID_RESEARCH_SCORE")
        revision = row.get("model_revision")
        if not isinstance(revision, str) or not _SHA40.fullmatch(revision):
            raise ValueError("UNPINNED_MODEL_REVISION")
        revisions.add(revision)
        pairs.append((float(score), 1 if label == "ai" else 0))
    if len(revisions) != 1:
        raise ValueError("MIXED_MODEL_REVISION")
    return pairs, next(iter(revisions))


def _platt(samples: list[tuple[float, int]]) -> dict:
    # Minimize regularized binary cross-entropy using stable 2x2 Newton updates.
    a, b, ridge = 0., 0., .01
    for _ in range(100):
        gaa, gbb = ridge * a, ridge * b
        haa, hbb, hab = ridge, ridge, 0.
        for score, truth in samples:
            prob = _sigmoid(a * score + b)
            residual = prob - truth
            w = prob * (1. - prob)
            gaa += residual * score
            gbb += residual
            haa += w * score * score
            hbb += w
            hab += w * score
        det = haa * hbb - hab * hab
        if det <= 0:
            raise ValueError("ILL_CONDITIONED_CALIBRATION_FIT")
        da = (gaa * hbb - gbb * hab) / det
        db = (gbb * haa - gaa * hab) / det
        a -= max(-5., min(5., da))
        b -= max(-5., min(5., db))
        if abs(da) + abs(db) < 1e-10:
            break
    return {"slope": a, "intercept": b}


def _isotonic(samples: list[tuple[float, int]]) -> dict:
    # Pool-adjacent-violators: monotone scalar mapping on calibration data.
    values = sorted(samples)
    blocks = []
    for score, truth in values:
        blocks.append([score, score, float(truth), 1])
        while len(blocks) >= 2:
            prev, current = blocks[-2], blocks[-1]
            if prev[2] / prev[3] <= current[2] / current[3]:
                break
            blocks[-2:] = [[prev[0], current[1],
                            prev[2] + current[2], prev[3] + current[3]]]
    return {
        "thresholds": [float(b[1]) for b in blocks],
        "values": [max(1e-6, min(1. - 1e-6, b[2] / b[3])) for b in blocks]
    }


def _predict(params: dict, method: str, source: float) -> float:
    if method == "platt":
        return _sigmoid(params["slope"] * source + params["intercept"])
    index = min(bisect.bisect_left(params["thresholds"], source),
                len(params["thresholds"]) - 1)
    return params["values"][index]


def fit_research_calibrator(calibration_rows: list[dict], split_manifest: dict,
                            method: str = "platt") -> dict:
    if method not in ("platt", "isotonic"):
        raise ValueError("UNSUPPORTED_RESEARCH_CALIBRATION_METHOD")
    pairs, revision = _rows_for_split(calibration_rows, split_manifest, "calibration")
    humans, machines = sum(y == 0 for _, y in pairs), sum(y == 1 for _, y in pairs)
    if humans < _MIN or machines < _MIN:
        raise ValueError("INSUFFICIENT_CALIBRATION_LABELS")
    params = _platt(pairs) if method == "platt" else _isotonic(pairs)
    return {
        "status": "RESEARCH_ONLY_HOLD",
        "method": method,
        "parameters": params,
        "trained_split": "calibration",
        "model_revision": revision,
        "split_manifest_sha256": _fingerprint(split_manifest),
        "calibration_n": len(pairs),
        "class_counts": {"human": humans, "ai": machines},
        "label_integrity": "REVIEW_REFERENCE_NOT_CRYPTOGRAPHICALLY_VERIFIED",
        "production_deployment": False,
    }


def evaluate_calibration(artifact: dict, validation_rows: list[dict],
                         split_manifest: dict) -> dict:
    _manifest_guard(split_manifest)
    if (not isinstance(artifact, dict) or
        artifact.get("status") != "RESEARCH_ONLY_HOLD" or
        artifact.get("trained_split") != "calibration" or
        artifact.get("split_manifest_sha256") != _fingerprint(split_manifest)):
        raise ValueError("FROZEN_MANIFEST_OR_CALIBRATOR_MISMATCH")
    pairs, revision = _rows_for_split(validation_rows, split_manifest, "validation")
    if revision != artifact["model_revision"]:
        raise ValueError("UNPINNED_MODEL_REVISION_MISMATCH")
    predictions = [_predict(artifact["parameters"], artifact["method"], x)
                   for x, _ in pairs]
    brier = sum((p - y) ** 2 for p, (_, y) in zip(predictions, pairs)) / len(pairs)
    raw_brier = sum((x - y) ** 2 for x, y in pairs) / len(pairs)
    ece = 0.
    for b in range(10):
        subset = [(p, truth) for p, (_, truth) in zip(predictions, pairs)
                  if (b / 10 <= p < (b + 1) / 10 or (b == 9 and p == 1))]
        if subset:
            ece += (len(subset) / len(pairs) *
                    abs(sum(p for p, _ in subset) / len(subset) -
                        sum(y for _, y in subset) / len(subset)))
    return {
        "status": "UNCALIBRATED_TARGET_DOMAIN_HOLD",
        "evaluated_split": "validation",
        "model_revision": revision,
        "calibration_method": artifact["method"],
        "validation_n": len(pairs),
        "research_brier": brier,
        "research_ece_10_bin": ece,
        "uncalibrated_signal_brier_diagnostic": raw_brier,
        "independent_target_domain_ground_truth": "NOT_ESTABLISHED",
        "production_deployment": False,
    }
