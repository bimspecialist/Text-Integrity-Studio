"""Synthetic unit fixtures audit metric math, not actual AI detector performance."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"backend"/"research"))
from evaluate_model_outputs import evaluate, auc, wilson_upper, ece

class EvaluationTests(unittest.TestCase):
    def samples(self):
        rows=[]
        for lab, score in (("human",10),("ai",90)):
            for i in range(20):
                rows.append({
                  "id":f"{lab}-{i}","label":lab,"score":score,
                  "group":f"independent-source-{lab}-{i}",
                  "domain":"engineering","language":"en",
                  "split":"test","benchmark":"synthetic-test",
                  "label_provenance":"SYNTHETIC_SOFTWARE_FIXTURE"
                })
        return rows

    def test_honest_statistical_metrics(self):
        report=evaluate(self.samples(),expected_benchmark="synthetic-test",revision="fixture")
        self.assertEqual(report["human_n"],20)
        self.assertEqual(report["ai_n"],20)
        self.assertEqual(report["auroc"],1)
        self.assertAlmostEqual(report["brier"],0.01)
        self.assertEqual(report["observed_fpr_at_80"],0)
        self.assertGreater(report["upper_95_fpr_at_80"],0.1)
        self.assertEqual(report["observed_tpr_at_80"],1)
        self.assertEqual(report["release_readiness"],"NOT_APPROVED")
        self.assertAlmostEqual(ece([0,1],[.1,.9]),.1)
        self.assertEqual(auc([0,1],[.5,.5]),.5)

    def test_bad_provenance_and_scores_rejected(self):
        rows=self.samples()
        rows[0]["score"]=float("nan")
        with self.assertRaisesRegex(ValueError,"Non-finite"):
            evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")
        rows=self.samples()
        rows[0]["id"]=rows[1]["id"]
        with self.assertRaisesRegex(ValueError,"Repeated"):
            evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")
        rows=self.samples()
        del rows[0]["label"]
        with self.assertRaisesRegex(ValueError,"Missing"):
            evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")
        rows=self.samples()
        rows[0]["label_provenance"]="INDEPENDENTLY_VERIFIED"
        with self.assertRaisesRegex(ValueError,"Do not self-assert"):
            evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")

    def test_split_and_language_leakage(self):
        rows=self.samples()
        rows[0]["group"]=rows[21]["group"]
        rows[0]["split"]="calibration"
        with self.assertRaisesRegex(ValueError,"Group leakage"):
            evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")
        rows=self.samples()
        rows[0]["language"]="ar"
        with self.assertRaisesRegex(ValueError,"English-only"):
            evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")

if __name__=="__main__":
    unittest.main()
