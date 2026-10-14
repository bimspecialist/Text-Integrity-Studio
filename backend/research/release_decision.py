"""E5 scientific RELEASE_TEST decision guard for Text Integrity Studio.

This module DOES NOT authenticate submitted attestations or approve launch.
All input scores/counts are research metadata, not proof of authorship.
The only possible decisions are BLOCKED, HOLD, or REVIEW_REQUIRED.
There is deliberately no READY path and no browser/model write path.
"""
from __future__ import annotations

import math
import re
from typing import Any

from backend.research.selective_metrics import one_sided_wilson_upper

_SHA40 = re.compile(r"^[a-f0-9]{40}$")
_SHA64 = re.compile(r"^[a-f0-9]{64}$")
_LANGUAGES = {"en", "ar"}
_DOMAINS = {"academic", "technical", "formal", "general", "esl", "news", "creative"}


def _valid_fraction(value: Any) -> bool:
    return (isinstance(value, (float, int)) and not isinstance(value, bool) and
            math.isfinite(value) and 0 <= value <= 1)


def _count(data: dict, name: str) -> int:
    value = data.get(name)
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError("INVALID_RESEARCH_COUNT_OR_DENOMINATOR")
    return value


def _cohort_key(data: dict) -> tuple[str, str]:
    if not isinstance(data, dict):
        raise ValueError("INVALID_COHORT_METADATA")
    language, domain = data.get("language"), data.get("domain")
    if language not in _LANGUAGES or domain not in _DOMAINS:
        # Keep arbitrary user-controlled strings out of the public report.
        raise ValueError("INVALID_COHORT_METADATA")
    return (language, domain)


def _validate_criteria(criteria: dict) -> tuple[list[tuple[str, str]], dict]:
    if not isinstance(criteria, dict):
        raise ValueError("PREREGISTERED_CRITERIA_REQUIRED")
    checked = {}
    thresholds = {
        "max_fpr_upper": (0, 1),
        "min_recall_all": (0, 1),
        "max_abstention": (0, 1),
        "max_brier": (0, 1),
        "max_ece": (0, 1),
    }
    for name in thresholds:
        value = criteria.get(name)
        if not _valid_fraction(value):
            raise ValueError("INVALID_RESEARCH_CRITERIA")
        checked[name] = float(value)
    # Published protocol minimums may be tightened by preregistration,
    # never relaxed to make an unqualified study pass.
    if (checked["max_fpr_upper"] > .01 or checked["max_brier"] > .20
            or checked["max_ece"] > .10):
        raise ValueError("INVALID_RESEARCH_CRITERIA_RELAXED_RELEASE_THRESHOLD")
    n = criteria.get("min_per_class")
    if not isinstance(n, int) or isinstance(n, bool) or n < 400:
        raise ValueError("INVALID_RESEARCH_CRITERIA_CLASS_MINIMUM")
    checked["min_per_class"] = n
    if not isinstance(criteria.get("probability_claim"), bool):
        raise ValueError("INVALID_RESEARCH_CRITERIA_PROBABILITY_FLAG")
    approved = criteria.get("expected_cohorts")
    if not isinstance(approved, list) or not approved:
        raise ValueError("EXPECTED_RESEARCH_COHORTS_REQUIRED")
    keys = [_cohort_key(c) for c in approved]
    if len(set(keys)) != len(keys):
        raise ValueError("DUPLICATE_PREREGISTERED_COHORT")
    return keys, checked


def _cohort_evidence(row: dict, limits: dict) -> tuple[dict, list[str]]:
    human = _count(row, "human_total")
    ai = _count(row, "ai_total")
    human_assessed = _count(row, "human_assessed")
    ai_assessed = _count(row, "ai_assessed")
    fp = _count(row, "human_false_alerts")
    tp = _count(row, "ai_true_positives")
    if human_assessed > human or ai_assessed > ai or fp > human_assessed or tp > ai_assessed:
        raise ValueError("INVALID_RESEARCH_COUNT_OR_DENOMINATOR")
    human_abstained, ai_abstained = human - human_assessed, ai - ai_assessed
    total = human + ai
    # Conservatively treat unassessed HUMAN samples as potential false alerts.
    # Do not describe an abstention as a correct rejection.
    worst_fpr = one_sided_wilson_upper(fp + human_abstained, human) if human else None
    recall_all = tp / ai if ai else None
    abstention = (human_abstained + ai_abstained) / total if total else None
    failed = []
    if human < limits["min_per_class"] or ai < limits["min_per_class"]:
        failed.append("INSUFFICIENT_VERIFIED_CLASS_COUNTS")
    if row.get("label_source") != "EXTERNALLY_REVIEWED_REFERENCES_ONLY":
        failed.append("UNVERIFIED_COHORT_LABEL_SOURCE")
    if worst_fpr is None or worst_fpr > limits["max_fpr_upper"]:
        failed.append("HUMAN_FALSE_POSITIVE_BOUND_FAILED")
    if recall_all is None or recall_all < limits["min_recall_all"]:
        failed.append("RECALL_ALL_ELIGIBLE_FAILED")
    if abstention is None or abstention > limits["max_abstention"]:
        failed.append("ABSTENTION_LIMIT_FAILED")
    result = {
        "language": row["language"],
        "domain": row["domain"],
        "human_total": human, "ai_total": ai,
        "human_assessed": human_assessed, "ai_assessed": ai_assessed,
        "human_abstained": human_abstained, "ai_abstained": ai_abstained,
        "human_false_alerts": fp, "ai_true_positives": tp,
        "human_fpr_upper95_conservative": worst_fpr,
        "ai_recall_all_eligible": recall_all,
        "abstention_rate": abstention,
        "status": "BLOCKED" if failed else "NUMERIC_THRESHOLDS_MET_NOT_APPROVED",
    }
    return result, failed


def decide_release(audit: dict, metrics: dict, calibration: dict | None,
                   criteria: dict) -> dict:
    """Return an auditable **metadata-only** HOLD/BLOCKED/REVIEW_REQUIRED verdict.

    No release approval can be inferred from arbitrary booleans or synthetic
    test labels. Numeric metrics are recomputed from recorded denominators,
    and unsupported public probability claims are always blocked.
    """
    if not isinstance(audit, dict) or not isinstance(metrics, dict):
        raise TypeError("RESEARCH_AUDIT_AND_RELEASE_METRICS_REQUIRED")
    expected, limits = _validate_criteria(criteria)
    reasons: set[str] = set()
    expected_revision = criteria.get("model_revision")
    if not isinstance(expected_revision, str) or not _SHA40.fullmatch(expected_revision):
        raise ValueError("PREREGISTERED_MODEL_REVISION_REQUIRED")
    protocol = criteria.get("protocol_id")
    if not isinstance(protocol, str) or not re.fullmatch(r"[A-Z0-9_]{10,80}", protocol):
        raise ValueError("PREREGISTERED_PROTOCOL_ID_REQUIRED")
    if criteria.get("preregistered") is not True:
        reasons.add("PROTOCOL_NOT_PREREGISTERED")
    if (audit.get("protocol_id") != protocol or
        audit.get("model_revision") != expected_revision or
        not isinstance(audit.get("frozen_test_sha256"), str) or
        not _SHA64.fullmatch(audit["frozen_test_sha256"])):
        reasons.add("FROZEN_TEST_PROVENANCE_MISMATCH")
    if metrics.get("split") != "release_test":
        reasons.add("UNTOUCHED_RELEASE_TEST_REQUIRED")
    if metrics.get("evidence_revision") != expected_revision:
        reasons.add("EVIDENCE_MODEL_REVISION_MISMATCH")
    if audit.get("independent_attestation_status") != "STRUCTURAL_ONLY_MANUAL_REVIEW_REQUIRED":
        reasons.add("UNSUPPORTED_INDEPENDENCE_CLAIM")
    if audit.get("data_status") != "STRUCTURAL_REFERENCE_ONLY":
        reasons.add("NOT_INDEPENDENT_RELEASE_DATA")
    if audit.get("errors") != [] or not isinstance(audit.get("licenses_checked"), int) or audit["licenses_checked"] < 1:
        reasons.add("LICENSE_OR_LABEL_PROVENANCE_AUDIT_FAILED")
    check = audit.get("split_audit")
    if not isinstance(check, dict) or check.get("status") != "PASS" or check.get("violations") != []:
        reasons.add("CROSS_SPLIT_LEAKAGE_NOT_EXCLUDED")

    raw = metrics.get("cohorts")
    if not isinstance(raw, list):
        raw = []
    if len(raw) > 100:
        raise ValueError("UNBOUNDED_RESEARCH_COHORTS")
    rows: dict[tuple[str, str], dict] = {}
    for item in raw:
        key = _cohort_key(item)
        if key in rows:
            raise ValueError("DUPLICATE_EVALUATION_COHORT")
        rows[key] = item
    if any(key not in expected for key in rows):
        reasons.add("UNREGISTERED_RELEASE_TEST_COHORT")
    cohorts = []
    observed_labels = 0
    for key in expected:
        if key not in rows:
            reasons.add("EXPECTED_COHORT_MISSING")
            cohorts.append({
                "language": key[0], "domain": key[1], "status": "MISSING",
                "human_total": 0, "ai_total": 0,
                "human_fpr_upper95_conservative": None,
                "ai_recall_all_eligible": None, "abstention_rate": None,
            })
            continue
        decision, local = _cohort_evidence(rows[key], limits)
        cohorts.append(decision)
        reasons.update(local)
        observed_labels += decision["human_total"] + decision["ai_total"]

    n_verified = audit.get("release_eligible_labels")
    tiers = audit.get("label_confidence_counts")
    tier_count = tiers.get("INDEPENDENTLY_VERIFIED") if isinstance(tiers, dict) else None
    if (not isinstance(n_verified, int) or isinstance(n_verified, bool) or
        not isinstance(tier_count, int) or isinstance(tier_count, bool) or
        n_verified < observed_labels or tier_count < observed_labels or
        audit.get("records_total", 0) < observed_labels):
        reasons.add("VERIFIED_LABEL_COUNT_NOT_SUPPORTED_BY_AUDIT")

    if calibration is not None:
        if not isinstance(calibration, dict):
            reasons.add("CALIBRATION_MISSING_OR_UNVERIFIED")
        else:
            if calibration.get("model_revision") != expected_revision:
                reasons.add("CALIBRATION_MODEL_REVISION_MISMATCH")
            if calibration.get("evaluated_split") != "validation" or calibration.get("production_deployment") is not False:
                reasons.add("CALIBRATION_SPLIT_NOT_INDEPENDENT")
            if criteria["probability_claim"]:
                brier = calibration.get("research_brier")
                ece = calibration.get("research_ece_10_bin")
                if not _valid_fraction(brier) or not _valid_fraction(ece):
                    reasons.add("CALIBRATION_MISSING_OR_UNVERIFIED")
                elif brier > limits["max_brier"] or ece > limits["max_ece"]:
                    reasons.add("CALIBRATION_ERROR_THRESHOLD_FAILED")
    elif criteria["probability_claim"]:
        reasons.add("CALIBRATION_MISSING_OR_UNVERIFIED")

    if criteria["probability_claim"]:
        # E4 explicitly returns unverified target-domain evidence. A numeric
        # research ECE/Brier does NOT authenticate its true labels or locale.
        # This gate must never automatically certify probability claims.
        if (not isinstance(calibration, dict) or
            calibration.get("status") != "INDEPENDENT_TARGET_DOMAIN_APPROVED_BY_EXTERNAL_REVIEW"):
            reasons.add("CALIBRATION_MISSING_OR_UNVERIFIED")

    # Structural positives still require verified external attestations,
    # preregistered untouched-data review and direct owner approval.
    if reasons:
        decision = "BLOCKED"
    else:
        decision = "REVIEW_REQUIRED"
        reasons.add("INDEPENDENT_EXTERNAL_SIGNOFF_REQUIRED")
    return {
        "decision": decision,
        "reasons": sorted(reasons),
        "cohorts": cohorts,
        "evidence_revision": expected_revision,
        "protocol_status": "PREREGISTRATION_CLAIM_NOT_EXTERNALLY_AUTHENTICATED",
        "independent_ground_truth": "UNVERIFIED_BY_THIS_CODE",
        "production_deployment": False,
        "public_probability_enabled": False,
    }
