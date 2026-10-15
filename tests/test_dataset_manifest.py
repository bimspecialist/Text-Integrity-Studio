"""Synthetic-only tests for traceable dataset/label provenance (E1).
No real user text, vendor claims or test data are promoted to ground truth.
"""
import copy
import json
import unittest

from backend.research.dataset_manifest import validate_manifest

DIGEST = "a" * 64
REVIEW_SHA = "b" * 64


def case(**patch):
    row = {
        "id": "case-synthetic-1",
        "content_digest": DIGEST,
        "label": "human",
        "label_provenance": "INDEPENDENTLY_VERIFIED",
        "review_evidence_ref": "review-1",
        "source": "synthetic-test",
        "source_revision": "fixed-synthetic-revision",
        "source_license": "CC-BY-4.0",
        "language": "en",
        "domain": "academic",
        "author_group": "author-A",
        "article_group": "article-A",
        "prompt_group": "none",
        "source_family": "test-fixtures",
        "model_family": "none",
        "split": "calibration",
    }
    row.update(patch)
    return row


def registry():
    return {
        "licenses": {"CC-BY-4.0": {
            "approved": True,
            "checked_by": "license-reviewer-1",
            "evidence_reference": "synthetic-license-record",
        }},
        "review_evidence": {"review-1": {
            "content_digest": DIGEST,
            "label": "human",
            "reviewer_id": "separate-human-reviewer",
            "attestation_digest": REVIEW_SHA,
            "evidence_reference": "signed-test-evidence-only",
        }},
    }


class DatasetManifestTests(unittest.TestCase):
    def test_verified_label_requires_separate_review_record(self):
        audit = validate_manifest([case()], registry())
        self.assertEqual(audit["release_eligible_labels"], 1)
        self.assertEqual(audit["records_total"], 1)
        self.assertEqual(audit["errors"], [])
        self.assertEqual(audit["licenses_checked"], 1)

    def test_fabricated_ground_truth_flag_is_not_evidence(self):
        refs = registry()
        refs["review_evidence"] = {}
        audit = validate_manifest([case()], refs)
        self.assertEqual(audit["release_eligible_labels"], 0)
        self.assertIn("INDEPENDENT_REVIEW_NOT_CONFIRMED", audit["errors"])
        self.assertEqual(audit["label_confidence_counts"]["INDEPENDENTLY_VERIFIED"], 1)

    def test_independent_label_must_match_digest_and_label(self):
        refs = registry()
        refs["review_evidence"]["review-1"]["label"] = "ai"
        self.assertEqual(validate_manifest([case()], refs)["release_eligible_labels"], 0)
        refs = registry()
        refs["review_evidence"]["review-1"]["content_digest"] = "c" * 64
        self.assertEqual(validate_manifest([case()], refs)["release_eligible_labels"], 0)
        refs = registry()
        refs["review_evidence"]["review-1"].pop("attestation_digest")
        self.assertEqual(validate_manifest([case()], refs)["release_eligible_labels"], 0)

    def test_missing_license_is_rejected(self):
        refs = registry()
        refs["licenses"] = {}
        with self.assertRaisesRegex(ValueError, "LICENSE"):
            validate_manifest([case()], refs)
        refs = registry()
        refs["licenses"]["CC-BY-4.0"]["approved"] = False
        with self.assertRaisesRegex(ValueError, "LICENSE"):
            validate_manifest([case()], refs)

    def test_unknown_author_cannot_claim_independent_verification(self):
        audit = validate_manifest([case(author_group="unknown")], registry())
        self.assertEqual(audit["release_eligible_labels"], 0)
        self.assertIn("UNKNOWN_GROUP_PREVENTS_VERIFICATION", audit["errors"])

    def test_same_digest_cross_groups_and_cross_splits_block(self):
        another = case(id="case-synthetic-2", author_group="author-B",
                       article_group="article-B", split="release_test")
        with self.assertRaisesRegex(ValueError, "DIGEST|LEAKAGE"):
            validate_manifest([case(), another], registry())
        another = case(id="case-synthetic-2", split="release_test")
        with self.assertRaisesRegex(ValueError, "LEAKAGE"):
            validate_manifest([case(), another], registry())

    def test_raw_source_text_never_appears_in_audit(self):
        secret = "PRIVATE_ACADEMIC_DOCUMENT_DO_NOT_EXPORT_1924"
        row = case(text=secret, author_group="private-author-tag", id="private-record")
        audit = validate_manifest([row], registry())
        output = json.dumps(audit, ensure_ascii=False)
        self.assertNotIn(secret, output)
        self.assertNotIn("private-record", output)
        self.assertNotIn("private-author-tag", output)
        self.assertNotIn(DIGEST, output)

    def test_public_claim_does_not_become_verified(self):
        row = case(label_provenance="PUBLIC_SOURCE_CLAIM",
                   review_evidence_ref="")
        audit = validate_manifest([row], registry())
        self.assertEqual(audit["release_eligible_labels"], 0)
        self.assertEqual(audit["label_confidence_counts"]["PUBLIC_SOURCE_CLAIM"], 1)

    def test_duplicate_id_and_unpinned_revisions_fail(self):
        with self.assertRaisesRegex(ValueError, "DUPLICATE"):
            validate_manifest([case(), case()], registry())
        with self.assertRaisesRegex(ValueError, "REVISION"):
            validate_manifest([case(source_revision="main")], registry())

    def test_ai_label_requires_identifiable_model_family(self):
        row = case(label="ai", model_family="unknown",
                   label_provenance="PUBLIC_SOURCE_CLAIM", review_evidence_ref="")
        with self.assertRaisesRegex(ValueError, "MODEL_FAMILY"):
            validate_manifest([row], registry())


if __name__ == "__main__":
    unittest.main()
