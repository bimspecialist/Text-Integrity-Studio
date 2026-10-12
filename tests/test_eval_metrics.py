import importlib.util
import pathlib
import unittest

FILE = pathlib.Path(__file__).resolve().parents[1] / "evaluation" / "score_detector.py"
SPEC = importlib.util.spec_from_file_location("score_detector", FILE)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


class DetectorMetricsTests(unittest.TestCase):
    def test_perfect_classifier(self):
        rows = [{"label": "human", "score": 0.1}] * 25 + [{"label": "ai", "score": 0.9}] * 25
        result = mod.score_rows(rows, threshold=0.5, calibrated=True)
        self.assertEqual(result["false_positive_rate"], 0)
        self.assertEqual(result["true_positive_rate"], 1)
        self.assertEqual(result["auroc"], 1)
        self.assertGreater(result["fpr_wilson_95"]["upper"], 0)
        self.assertGreaterEqual(result["ece_10_bin"], 0)
    def test_abstain(self):
        rows = [{"label": "human", "score": None}, {"label": "ai", "score": 0.8}]
        r = mod.score_rows(rows)
        self.assertEqual(r["n_abstained"], 1)
        self.assertEqual(r["coverage"], 0.5)
        self.assertIsNone(r["false_positive_rate"])
    def test_auc_ties(self):
        self.assertAlmostEqual(mod.auc([(0.5, 0), (0.5, 1)]), 0.5)
    def test_all_human(self):
        r = mod.score_rows([{"label": "human", "score": 0.8}])
        self.assertEqual(r["false_positive_rate"], 1)
        self.assertIsNone(r["auroc"])
    def test_grouping_and_unknown_gate(self):
        rows = [{"label": "human", "score": 0.1, "split": "test", "language": "ar", "dialect": "gulf", "domain": "engineering", "edit_type": "original"}] + [
            {"label": "ai", "score": 0.8, "split": "test", "language": "en", "dialect": "", "domain": "essay", "edit_type": "original"}]
        r = mod.evaluate(rows)
        self.assertEqual(r["decision"], "INCONCLUSIVE")
        self.assertIn("ar", r["groups"]["language"])
        self.assertIn("en", r["groups"]["language"])
        self.assertEqual(r["gates"]["representative_human_test_samples"], "UNKNOWN")
    def test_wilson_with_zero_fps_is_not_zero_uncertainty(self):
        self.assertGreater(mod.wilson(0, 100)["upper"], 0.03)


if __name__ == "__main__":
    unittest.main()
