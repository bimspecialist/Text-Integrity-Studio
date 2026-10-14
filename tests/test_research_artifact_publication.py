"""E5 CI artifact publication guard tests: synthetic weak-label aggregates only."""
import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path
import unittest

from backend.research.evaluate_model_outputs import evaluate
from backend.research.audit_artifact_guard import audit_aggregate_pair
from backend.research.build_textsight_benchmark import DATASET, DATASET_REVISION, LICENSE

REV = "b9aa251e5bcda7e429fcc936767d921435945b60"
BENCH = "TEXTSIGHT_2026_EXTERNAL_VENDOR_BENCHMARK"


def pair():
    notes = (
        "No samples may train, calibrate or choose a threshold; "
        "this is an externally sourced research evaluation only."
    )
    manifest = {
        "dataset": DATASET, "license": LICENSE,
        "provenance": "SOURCE_VENDOR_CLAIMS_NOT_INDEPENDENTLY_AUDITED",
        "source_count": {"human_wikipedia": 1, "human_academic": 1, "ai_2026": 2},
        "model_families": {"fixture-ai": 2},
        "total": 4, "source_text_in_artifact": False,
        "note": notes, "resolved_source_revision": DATASET_REVISION,
    }
    rows = []
    for i in range(4):
        label = "human" if i < 2 else "ai"
        rows.append({
            "id": f"private-fixture-{i}",
            "label": label, "score": 12. if label == "human" else 92.,
            "group": f"private-author-{i}", "domain": "academic",
            "language": "en", "benchmark": BENCH,
            "label_provenance": "DOCUMENTED_EXTERNAL_SOURCE_NOT_INDEPENDENTLY_AUDITED",
            "model_family": "fixture-ai" if label == "ai" else "",
            "model_revision": REV,
        })
    metrics = evaluate(rows, expected_benchmark=BENCH, revision=REV)
    return manifest, metrics


class ArtifactPublicationTests(unittest.TestCase):
    def test_only_pinned_aggregate_metrics_approved_to_upload(self):
        manifest, metrics = pair()
        result = audit_aggregate_pair(manifest, metrics)
        self.assertEqual(result["decision"], "BLOCKED")
        self.assertIn("INDEPENDENT_GROUND_TRUTH_NOT_VERIFIED", result["reasons"])
        self.assertEqual(result["aggregate_sample_count"], 4)
        self.assertEqual(result["model_revision"], REV)
        self.assertFalse(result["public_probability_enabled"])
        payload = json.dumps(result)
        self.assertNotIn("private-fixture", payload)
        self.assertNotIn("private-author", payload)

    def test_module_cli_imports_with_real_runner_path(self):
        manifest, metrics = pair()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source-manifest.json"
            report = root / "research-metrics.json"
            decision = root / "release-status.json"
            source.write_text(json.dumps(manifest), encoding="utf-8")
            report.write_text(json.dumps(metrics), encoding="utf-8")
            repository = Path(__file__).resolve().parents[1]
            process = subprocess.run([
                sys.executable, "-m", "backend.research.audit_artifact_guard",
                "--manifest", str(source), "--metrics", str(report),
                "--output", str(decision)
            ], cwd=repository, capture_output=True, text=True, check=True)
            self.assertTrue(decision.is_file())
            self.assertEqual(json.loads(decision.read_text())["decision"], "BLOCKED")
            self.assertNotIn("private-fixture", process.stdout)
            self.assertNotIn("private-author", process.stderr)

    def test_raw_text_case_ids_and_unsalted_group_hashes_are_rejected(self):
        manifest, metrics = pair()
        for injected in (
            {"raw_text": "STUDENT_REPORT_PRIVATE_728"},
            {"case_id_sha256": ["e" * 64]},
            {"group_hashes_sha256": {"release_test": ["f" * 64]}},
            {"per_document_predictions": [{"text": "DO_NOT_UPLOAD_711"}]},
        ):
            edited = dict(metrics, **injected)
            with self.subTest(injected=injected), self.assertRaisesRegex(ValueError, "ARTIFACT|PRIVATE"):
                audit_aggregate_pair(manifest, edited)

    def test_research_notes_cannot_be_replaced_by_arbitrary_content(self):
        manifest, metrics = pair()
        metrics["notes"] = ["PRIVATE_STUDENT_DOCUMENT_99"]
        with self.assertRaisesRegex(ValueError, "ARTIFACT|TEXT"):
            audit_aggregate_pair(manifest, metrics)
        manifest, metrics = pair()
        manifest["note"] = "User extracted content here"
        with self.assertRaisesRegex(ValueError, "ARTIFACT|TEXT"):
            audit_aggregate_pair(manifest, metrics)

    def test_claiming_independent_ground_truth_is_a_hard_error(self):
        manifest, metrics = pair()
        metrics["ground_truth"] = "INDEPENDENTLY_VERIFIED"
        with self.assertRaisesRegex(ValueError, "UNVERIFIED|PROVENANCE"):
            audit_aggregate_pair(manifest, metrics)
        manifest, metrics = pair()
        manifest["provenance"] = "INDEPENDENTLY_VERIFIED"
        with self.assertRaisesRegex(ValueError, "UNVERIFIED|PROVENANCE"):
            audit_aggregate_pair(manifest, metrics)

    def test_wrong_model_revision_or_unpinned_source_is_rejected(self):
        manifest, metrics = pair()
        metrics["model_revision"] = "c" * 40
        with self.assertRaisesRegex(ValueError, "REVISION|PIN"):
            audit_aggregate_pair(manifest, metrics)
        manifest, metrics = pair()
        manifest["resolved_source_revision"] = "main"
        with self.assertRaisesRegex(ValueError, "REVISION|PIN"):
            audit_aggregate_pair(manifest, metrics)

    def test_inconsistent_aggregate_counts_are_rejected(self):
        manifest, metrics = pair()
        manifest["total"] += 1
        with self.assertRaisesRegex(ValueError, "COUNT"):
            audit_aggregate_pair(manifest, metrics)

    def test_group_family_labels_cannot_contain_untrusted_document_text(self):
        manifest, metrics = pair()
        manifest["model_families"]["https://evil.test/?document=PRIVATE_NOTE"] = 1
        with self.assertRaisesRegex(ValueError, "ARTIFACT|PRIVATE"):
            audit_aggregate_pair(manifest, metrics)


if __name__ == "__main__":
    unittest.main()
