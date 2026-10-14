"""E5 research release-gate tests on SYNTHETIC metadata only.

Passing structural tests does not prove detector accuracy, authenticity of
third-party attestations, or grant production deployment authorization.
"""
from __future__ import annotations

import copy
import json
import unittest

from backend.research.release_decision import decide_release

REV = "b9aa251e5bcda7e429fcc936767d921435945b60"
FINGERPRINT = "a" * 64
PROTOCOL = "TIS_RELEASE_PROTOCOL_20261014_V1"


def evidence():
    audit = {
        "records_total": 900,
        "release_eligible_labels": 900,
        "label_confidence_counts": {
            "INDEPENDENTLY_VERIFIED": 900, "PUBLIC_SOURCE_CLAIM": 0,
            "MACHINE_INFERRED": 0,
        },
        "errors": [],
        "licenses_checked": 2,
        "independent_attestation_status": "STRUCTURAL_ONLY_MANUAL_REVIEW_REQUIRED",
        "split_audit": {"status": "PASS", "violations": []},
        "frozen_test_sha256": FINGERPRINT,
        "model_revision": REV,
        "protocol_id": PROTOCOL,
        "data_status": "STRUCTURAL_REFERENCE_ONLY",
    }
    metrics = {
        "split": "release_test", "evidence_revision": REV,
        "cohorts": [{
            "language": "en", "domain": "academic",
            "label_source": "EXTERNALLY_REVIEWED_REFERENCES_ONLY",
            "human_total": 450, "ai_total": 450,
            "human_assessed": 450, "ai_assessed": 435,
            "human_false_alerts": 0, "ai_true_positives": 418,
        }],
    }
    calibration = {
        "status": "UNCALIBRATED_TARGET_DOMAIN_HOLD", "evaluated_split": "validation",
        "model_revision": REV, "research_brier": .08, "research_ece_10_bin": .04,
        "production_deployment": False,
    }
    criteria = {
        "protocol_id": PROTOCOL, "model_revision": REV,
        "expected_cohorts": [{"language": "en", "domain": "academic"}],
        "min_per_class": 400, "max_fpr_upper": .01,
        "min_recall_all": .85, "max_abstention": .10,
        "max_brier": .20, "max_ece": .10,
        "probability_claim": False,
        "preregistered": True,
    }
    return audit, metrics, calibration, criteria


class ResearchReleaseTests(unittest.TestCase):
    def test_no_auto_ready_even_if_every_synthetic_metric_passes(self):
        audit, metrics, cal, criteria = evidence()
        decision = decide_release(audit, metrics, cal, criteria)
        self.assertEqual(decision["decision"], "REVIEW_REQUIRED")
        self.assertNotIn("READY", json.dumps(decision))
        self.assertIn("INDEPENDENT_EXTERNAL_SIGNOFF_REQUIRED", decision["reasons"])
        self.assertEqual(decision["evidence_revision"], REV)
        self.assertEqual(decision["cohorts"][0]["status"], "NUMERIC_THRESHOLDS_MET_NOT_APPROVED")

    def test_explicit_synthetic_or_weak_source_evidence_cannot_count_as_release(self):
        audit, metrics, cal, criteria = evidence()
        audit["data_status"] = "SYNTHETIC_TEST_NOT_RELEASE_EVIDENCE"
        result = decide_release(audit, metrics, cal, criteria)
        self.assertEqual(result["decision"], "BLOCKED")
        self.assertIn("NOT_INDEPENDENT_RELEASE_DATA", result["reasons"])

    def test_missing_subgroup_blocks_release(self):
        audit, metrics, cal, criteria = evidence()
        criteria["expected_cohorts"].append({"language": "ar", "domain": "academic"})
        result = decide_release(audit, metrics, cal, criteria)
        self.assertEqual(result["decision"], "BLOCKED")
        self.assertIn("EXPECTED_COHORT_MISSING", result["reasons"])
        self.assertNotIn("ar-academic", json.dumps(result))

    def test_fabricated_ground_truth_flag_without_independent_audit_blocks(self):
        audit, metrics, cal, criteria = evidence()
        audit["independent_attestation_status"] = "INDEPENDENTLY_VERIFIED"
        audit["release_eligible_labels"] = 1000000
        metrics["cohorts"][0]["verified"] = True
        result = decide_release(audit, metrics, cal, criteria)
        self.assertEqual(result["decision"], "BLOCKED")
        self.assertIn("UNSUPPORTED_INDEPENDENCE_CLAIM", result["reasons"])

    def test_insufficient_400_class_samples_per_cohort(self):
        audit, metrics, cal, criteria = evidence()
        metrics["cohorts"][0]["ai_total"] = 399
        metrics["cohorts"][0]["ai_assessed"] = 380
        metrics["cohorts"][0]["ai_true_positives"] = 375
        result = decide_release(audit, metrics, cal, criteria)
        self.assertEqual(result["decision"], "BLOCKED")
        self.assertIn("INSUFFICIENT_VERIFIED_CLASS_COUNTS", result["reasons"])

    def test_excessive_false_positive_upper_bound_is_not_hidden(self):
        audit, metrics, cal, criteria = evidence()
        metrics["cohorts"][0]["human_false_alerts"] = 2
        result = decide_release(audit, metrics, cal, criteria)
        self.assertEqual(result["decision"], "BLOCKED")
        self.assertIn("HUMAN_FALSE_POSITIVE_BOUND_FAILED", result["reasons"])
        self.assertGreater(result["cohorts"][0]["human_fpr_upper95_conservative"], .01)

    def test_abstentions_cannot_create_perfect_false_alert_or_recall(self):
        audit, metrics, cal, criteria = evidence()
        metrics["cohorts"][0]["human_assessed"] = 100
        metrics["cohorts"][0]["ai_assessed"] = 100
        metrics["cohorts"][0]["ai_true_positives"] = 99
        result = decide_release(audit, metrics, cal, criteria)
        self.assertEqual(result["decision"], "BLOCKED")
        self.assertIn("ABSTENTION_LIMIT_FAILED", result["reasons"])
        self.assertIn("RECALL_ALL_ELIGIBLE_FAILED", result["reasons"])
        self.assertIn("HUMAN_FALSE_POSITIVE_BOUND_FAILED", result["reasons"])

    def test_calibration_gate_for_probability_claim(self):
        audit, metrics, cal, criteria = evidence()
        criteria["probability_claim"] = True
        self.assertIn("CALIBRATION_MISSING_OR_UNVERIFIED",
                      decide_release(audit, metrics, None, criteria)["reasons"])
        too_high = dict(cal, research_ece_10_bin=.12, research_brier=.24)
        result = decide_release(audit, metrics, too_high, criteria)
        self.assertIn("CALIBRATION_ERROR_THRESHOLD_FAILED", result["reasons"])
        self.assertEqual(result["decision"], "BLOCKED")

    def test_validation_is_not_release_test_and_revision_must_match(self):
        audit, metrics, cal, criteria = evidence()
        wrong = dict(cal, evaluated_split="release_test")
        self.assertIn("CALIBRATION_SPLIT_NOT_INDEPENDENT",
                      decide_release(audit, metrics, wrong, criteria)["reasons"])
        wrong = dict(cal, model_revision="c" * 40)
        self.assertIn("CALIBRATION_MODEL_REVISION_MISMATCH",
                      decide_release(audit, metrics, wrong, criteria)["reasons"])

    def test_unregistered_thresholds_and_changed_model_block(self):
        audit, metrics, cal, criteria = evidence()
        criteria["preregistered"] = False
        self.assertIn("PROTOCOL_NOT_PREREGISTERED",
                      decide_release(audit, metrics, cal, criteria)["reasons"])
        criteria["preregistered"] = True
        metrics["evidence_revision"] = "b" * 40
        self.assertIn("EVIDENCE_MODEL_REVISION_MISMATCH",
                      decide_release(audit, metrics, cal, criteria)["reasons"])

    def test_forged_rate_cannot_override_counts(self):
        audit, metrics, cal, criteria = evidence()
        metrics["cohorts"][0]["human_false_alerts"] = 6
        metrics["cohorts"][0]["false_positive_rate"] = 0.0
        result = decide_release(audit, metrics, cal, criteria)
        self.assertEqual(result["decision"], "BLOCKED")
        self.assertGreater(result["cohorts"][0]["human_fpr_upper95_conservative"], .01)

    def test_reject_invalid_denominators_and_nonfinite_values(self):
        audit, metrics, cal, criteria = evidence()
        metrics["cohorts"][0]["human_assessed"] = 451
        with self.assertRaisesRegex(ValueError, "DENOMINATOR|COUNT"):
            decide_release(audit, metrics, cal, criteria)
        audit, metrics, cal, criteria = evidence()
        criteria["min_recall_all"] = float("nan")
        with self.assertRaisesRegex(ValueError, "CRITERIA"):
            decide_release(audit, metrics, cal, criteria)

    def test_aggregate_export_contains_no_personal_source_content(self):
        audit, metrics, cal, criteria = evidence()
        secret = "CONFIDENTIAL_STUDENT_NOTE_DO_NOT_EXPORT_2994"
        metrics["cohorts"][0]["raw_text"] = secret
        metrics["cohorts"][0]["source_group"] = "private-author-123"
        audit["user_comment"] = "sample.pdf"
        result = decide_release(audit, metrics, cal, criteria)
        encoded = json.dumps(result, ensure_ascii=False)
        for forbidden in (secret, "private-author", "sample.pdf", "content_digest", "raw_text"):
            self.assertNotIn(forbidden, encoded)

    def test_no_public_website_weight_or_threshold_update(self):
        audit, metrics, cal, criteria = evidence()
        result = decide_release(audit, metrics, cal, criteria)
        self.assertEqual(result["production_deployment"], False)
        self.assertEqual(result["public_probability_enabled"], False)


if __name__ == "__main__":
    unittest.main()
