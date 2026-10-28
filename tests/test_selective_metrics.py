"""Synthetic E3 selective detector metrics tests. Scores are UNCALIBRATED."""
import json
import math
import unittest
from backend.research.selective_metrics import (
    compute_selective_metrics, one_sided_wilson_upper
)


def row(label, score, group=None, **extra):
    base = {"label": label, "score": score,
            "source_group": group,
            "language": "en", "domain": "academic",
            "word_count": 180, "esl": False, "formal": True,
            "model_family": "fixture-model" if label == "ai" else "none",
            "abstention_reason": "INCONCLUSIVE" if score is None else ""}
    base.update(extra)
    return base


class SelectiveMetricsTests(unittest.TestCase):
    def test_abstention_is_not_a_true_negative(self):
        samples = [
            row("human", .90, "h1"), row("human", .10, "h2"),
            row("human", None, "h3"),
            row("ai", .91, "a1"), row("ai", .20, "a2"),
            row("ai", None, "a3")
        ]
        stats = compute_selective_metrics(samples)
        self.assertEqual(stats["confusion_matrix"], {"tp": 1, "fp": 1, "tn": 1, "fn": 1})
        self.assertEqual(stats["n_scored"], 4)
        self.assertEqual(stats["n_abstained"], 2)
        self.assertEqual(stats["human_total"], 3)
        self.assertEqual(stats["human_assessed"], 2)
        self.assertEqual(stats["human_abstained"], 1)
        self.assertAlmostEqual(stats["human_fpr_assessed"], .5)
        self.assertAlmostEqual(stats["human_fpr_all_minimum"], 1/3)
        self.assertAlmostEqual(stats["human_fpr_all_maximum"], 2/3)
        self.assertAlmostEqual(stats["ai_fnr_assessed"], .5)
        self.assertAlmostEqual(stats["ai_fnr_all_maximum"], 2/3)
        self.assertAlmostEqual(stats["precision_assessed"], .5)
        self.assertAlmostEqual(stats["recall_assessed"], .5)
        self.assertAlmostEqual(stats["f1_assessed"], .5)
        self.assertAlmostEqual(stats["coverage"], 4/6)

    def test_one_sided_wilson_zero_and_one_errors_400(self):
        zero = one_sided_wilson_upper(0, 400, alpha=.05)
        one = one_sided_wilson_upper(1, 400, alpha=.05)
        self.assertAlmostEqual(zero, .006718, delta=.00002)
        self.assertGreater(one, .01)
        self.assertLess(one, .02)
        self.assertIsNone(one_sided_wilson_upper(0, 0))
        with self.assertRaises(ValueError):
            one_sided_wilson_upper(5, 4)

    def test_all_abstained_rates_are_not_estimable(self):
        stats=compute_selective_metrics([
            row("human",None,"h"),row("ai",None,"a")
        ])
        self.assertEqual(stats["confusion_matrix"], {"tp":0,"fp":0,"tn":0,"fn":0})
        self.assertEqual(stats["coverage"],0)
        for field in ("human_fpr_assessed", "ai_fnr_assessed", "precision_assessed",
                      "recall_assessed","auroc","brier_score_diagnostic"):
            self.assertIsNone(stats[field],field)
        self.assertEqual(stats["human_fpr_all_maximum"],1)
        self.assertEqual(stats["ai_fnr_all_maximum"],1)

    def test_distinct_source_groups_sharing_an_author_are_one_cluster(self):
        # Synthetic negative control: two excerpts from one author must not
        # become two "independent" samples just because the upload assigned
        # distinct source_group values. An FPR confidence interval is not
        # estimable from a single independent human author.
        rows = [
            row("human", .94, "chapter-one", author_group="same-author",
                article_group="draft-1"),
            row("human", .06, "chapter-two", author_group="same-author",
                article_group="draft-2"),
            row("ai", .88, "separate-generator", author_group="other-author"),
        ]
        result = compute_selective_metrics(rows, bootstrap_seed=19)
        self.assertEqual(result["independent_source_groups"], 2)
        self.assertIsNone(result["group_bootstrap_fpr_ci95"])
        self.assertIn("GROUP_BOOTSTRAP_UNESTIMABLE", result["evidence_gaps"])

    def test_group_bootstrap_reflects_correlation(self):
        samples = ([row("human",.9,"group-FP") for _ in range(20)]+
                   [row("human",.1,"group-TN") for _ in range(20)])
        result=compute_selective_metrics(samples,bootstrap_seed=99)
        interval=result["group_bootstrap_fpr_ci95"]
        self.assertIsNotNone(interval)
        self.assertLessEqual(interval["lower"],.1)
        self.assertGreaterEqual(interval["upper"],.9)
        self.assertEqual(result["independent_source_groups"],2)

    def test_missing_subgroups_and_labels_never_approve_release(self):
        data=[row("human",.1,"h",language="unknown",domain="unknown",word_count=None),
              row("ai",.9,"a",language="unknown",domain="unknown",word_count=None)]
        stats=compute_selective_metrics(data)
        self.assertEqual(stats["research_release_gate"],"HOLD")
        self.assertIn("MISSING_SUBGROUP_METADATA",stats["evidence_gaps"])
        self.assertNotIn("authorship_probability",stats)
        self.assertIsNone(stats["group_bootstrap_fpr_ci95"])

    def test_raw_signal_brier_and_ece_are_never_certified(self):
        stats=compute_selective_metrics([row("human",.1,"g1"),row("ai",.9,"g2")])
        self.assertAlmostEqual(stats["brier_score_diagnostic"],.01)
        self.assertIsNotNone(stats["ece_10_bin_diagnostic"])
        self.assertEqual(stats["calibration_status"],"UNCALIBRATED_RESEARCH_DIAGNOSTIC")
        self.assertNotIn("calibrated_probability",stats)

    def test_reject_mixed_splits_or_invalid_scores(self):
        with self.assertRaisesRegex(ValueError,"MIXED_SPLITS"):
            compute_selective_metrics([row("human",.1,split="calibration"),
                                       row("ai",.9,split="release_test")])
        with self.assertRaisesRegex(ValueError,"SCORE"):
            compute_selective_metrics([row("human",120)])
        with self.assertRaisesRegex(ValueError,"SCORE"):
            compute_selective_metrics([row("human",float("nan"))])

    def test_subgroup_metadata_only_no_raw_text(self):
        rows=[row("human",.25,"private-group",raw_text="SENSITIVE_TEXT_3045",
                  language="ar",domain="academic",word_count=200),
              row("ai",.82,"private-group2",language="ar",
                  domain="academic",word_count=200,model_family="unseen-generator")]
        stats=compute_selective_metrics(rows,train_model_families={"older-generator"})
        output=json.dumps(stats,ensure_ascii=False)
        self.assertNotIn("SENSITIVE_TEXT_3045",output)
        self.assertNotIn("private-group",output)
        self.assertIn("unseen_generator",stats["subgroups"])
        self.assertEqual(stats["subgroups"]["language"]["ar"]["n_total"],2)
        self.assertEqual(stats["research_release_gate"],"HOLD")


if __name__ == "__main__":
    unittest.main()
