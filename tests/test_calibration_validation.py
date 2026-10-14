"""E4 research-only calibration. Synthetic evidence; untouched release-test."""
import copy
import json
import unittest
from backend.research.cohort_split import split_cohorts
from backend.research.calibration_validation import (
    fit_research_calibrator, evaluate_calibration
)

MODEL_REVISION = "b9aa251e5bcda7e429fcc936767d921435945b60"


def data():
    rows = []
    for i in range(160):
        label = "ai" if i % 2 else "human"
        rows.append({
            "id": f"synthetic-case-{i:03d}",
            "content_digest": f"{i+1:064x}",
            "label": label, "source_revision": "pinned-synthetic-v1",
            "source_family": f"unique-family-{i:03d}",
            "author_group": f"author-{i:03d}",
            "article_group": f"article-{i:03d}",
            "prompt_group": f"prompt-{i:03d}",
            "model_family": "synthetic-new-ai" if label == "ai" else "none",
            "label_provenance": "INDEPENDENTLY_VERIFIED",
            "model_revision": MODEL_REVISION,
            "score": .15 + (i % 7) / 100 if label == "human" else .81 + (i % 9) / 100,
        })
    return split_cohorts(rows, seed=20261013)


class OfflineCalibrationTests(unittest.TestCase):
    def test_fit_platt_only_on_calibration_and_evaluate_validation(self):
        source = data()
        before = copy.deepcopy(source)
        model = fit_research_calibrator(source["calibration"], source["split_manifest"])
        self.assertEqual(model["status"], "RESEARCH_ONLY_HOLD")
        self.assertEqual(model["method"], "platt")
        self.assertEqual(model["model_revision"], MODEL_REVISION)
        self.assertEqual(model["trained_split"], "calibration")
        self.assertNotIn("document_text", json.dumps(model))
        self.assertNotIn("synthetic-case", json.dumps(model))
        score = evaluate_calibration(model, source["validation"], source["split_manifest"])
        self.assertEqual(score["status"], "UNCALIBRATED_TARGET_DOMAIN_HOLD")
        self.assertTrue(0 <= score["research_brier"] <= 1)
        self.assertTrue(0 <= score["research_ece_10_bin"] <= 1)
        self.assertEqual(score["evaluated_split"], "validation")
        self.assertEqual(source, before, "fit may not mutate source/split records")

    def test_isotonic_is_optional_and_monotone(self):
        source = data()
        model = fit_research_calibrator(source["calibration"],
                                        source["split_manifest"], method="isotonic")
        self.assertEqual(model["method"], "isotonic")
        self.assertTrue(all(a <= b for a, b in zip(model["parameters"]["values"],
                                                   model["parameters"]["values"][1:])))
        validation = evaluate_calibration(model, source["validation"], source["split_manifest"])
        self.assertIsNotNone(validation["research_brier"])

    def test_never_fit_on_release_test(self):
        source = data()
        with self.assertRaisesRegex(ValueError, "SPLIT|LEAKAGE|CALIBRATION"):
            fit_research_calibrator(source["release_test"], source["split_manifest"])
        art = fit_research_calibrator(source["calibration"], source["split_manifest"])
        with self.assertRaisesRegex(ValueError, "SPLIT|LEAKAGE|VALIDATION"):
            evaluate_calibration(art, source["release_test"], source["split_manifest"])

    def test_shared_prompt_group_in_release_blocks_fit(self):
        source = data()
        manifest = copy.deepcopy(source["split_manifest"])
        reused = manifest["group_hashes_sha256"]["release_test"][0]
        manifest["group_hashes_sha256"]["calibration"].append(reused)
        with self.assertRaisesRegex(ValueError, "LEAKAGE"):
            fit_research_calibrator(source["calibration"], manifest)

    def test_weak_labels_and_insufficient_classes_block_fit(self):
        source = data()
        cal = copy.deepcopy(source["calibration"])
        cal[0]["label_provenance"] = "PUBLIC_SOURCE_CLAIM"
        with self.assertRaisesRegex(ValueError, "UNVERIFIED|LABEL"):
            fit_research_calibrator(cal, source["split_manifest"])
        human = [r for r in source["calibration"] if r["label"] == "human"]
        with self.assertRaisesRegex(ValueError, "INSUFFICIENT"):
            fit_research_calibrator(human, source["split_manifest"])

    def test_manifest_mismatch_rejects_stale_validation(self):
        source = data()
        art = fit_research_calibrator(source["calibration"], source["split_manifest"])
        altered = copy.deepcopy(source["split_manifest"])
        altered["seed"] += 1
        with self.assertRaisesRegex(ValueError, "FROZEN|MANIFEST"):
            evaluate_calibration(art, source["validation"], altered)

    def test_source_group_and_id_rewrites_cannot_bypass_frozen_manifest(self):
        source = data()
        cal = copy.deepcopy(source["calibration"])
        cal[0]["prompt_group"] = "spoofed-prompt-group"
        with self.assertRaisesRegex(ValueError, "GROUP|LEAKAGE"):
            fit_research_calibrator(cal, source["split_manifest"])
        cal = copy.deepcopy(source["calibration"])
        cal[0]["id"] = "unregistered-calibration-id"
        with self.assertRaisesRegex(ValueError, "SPLIT|CASE"):
            fit_research_calibrator(cal, source["split_manifest"])

    def test_model_revision_mismatch_and_unsupported_methods(self):
        source = data()
        cal = copy.deepcopy(source["calibration"])
        cal[0]["model_revision"] = "main"
        with self.assertRaisesRegex(ValueError, "MODEL_REVISION"):
            fit_research_calibrator(cal, source["split_manifest"])
        with self.assertRaisesRegex(ValueError, "METHOD"):
            fit_research_calibrator(source["calibration"], source["split_manifest"],
                                    method="automatic-website")

    def test_browser_code_never_modified_to_claim_calibration(self):
        import pathlib
        ui = pathlib.Path(__file__).resolve().parents[1] / "docs" / "analysis" / "local-rewrite-model-manifest.json"
        self.assertIsNone(json.loads(ui.read_text(encoding="utf-8"))["productionDefault"])
        self.assertNotIn("source", json.dumps(fit_research_calibrator(
            data()["calibration"], data()["split_manifest"]
        )["parameters"]), "coefficients only, no source documents")


if __name__ == "__main__":
    unittest.main()
