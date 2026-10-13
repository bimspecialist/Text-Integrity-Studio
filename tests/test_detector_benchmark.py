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
        self.assertEqual(report["confusion_matrix_at_80"],{
            "true_positive":20,"false_positive":0,"true_negative":20,"false_negative":0})
        self.assertEqual(report["precision_at_80"],1)
        self.assertEqual(report["recall_at_80"],1)
        self.assertEqual(report["f1_at_80"],1)
        self.assertEqual(report["observed_fnr_at_80"],0)
        self.assertLess(report["precision_wilson_95_interval_at_80"][0],1)
        self.assertLess(report["recall_wilson_95_interval_at_80"][0],1)
        self.assertEqual(report["domain_audit"]["engineering"]["ai"],20)
        self.assertEqual(report["domain_audit"]["engineering"]["human"],20)
        self.assertEqual(report["domain_audit"]["engineering"]["observed_tpr_at_80"],1)
        self.assertLess(report["domain_audit"]["engineering"]["lower_95_tpr_at_80"],1)
        self.assertEqual(report["generator_family_audit"],{})
        self.assertEqual(report["release_readiness"],"NOT_APPROVED")
        self.assertAlmostEqual(ece([0,1],[.1,.9]),.1)
        self.assertEqual(auc([0,1],[.5,.5]),.5)

    def test_partial_errors_have_correct_confusion_and_uncertainty(self):
        rows=self.samples()
        rows[0]["score"]=95   # one false alert on a human text
        rows[20]["score"]=5   # one missed AI text
        report=evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")
        self.assertEqual(report["confusion_matrix_at_80"],{
            "true_positive":19,"false_positive":1,"true_negative":19,"false_negative":1})
        self.assertAlmostEqual(report["precision_at_80"],19/20)
        self.assertAlmostEqual(report["recall_at_80"],19/20)
        self.assertAlmostEqual(report["f1_at_80"],19/20)
        self.assertAlmostEqual(report["observed_fnr_at_80"],1/20)
        self.assertLess(report["fnr_wilson_95_interval_at_80"][0],1/20)
        self.assertGreater(report["fnr_wilson_95_interval_at_80"][1],1/20)

    def test_visible_ui_signal_and_abstention_are_separate_from_raw_scores(self):
        rows=self.samples()
        for row in rows:
            row["report_status"]="SINGLE_UNCALIBRATED_MODEL"
            row["reported_signal_percent"]=row["score"]
        # Raw model emits two high scores that the actual UI correctly withholds.
        rows[0].update(score=95,report_status="HETEROGENEOUS_DOCUMENT",reported_signal_percent=None)
        rows[20].update(report_status="INSUFFICIENT_COVERAGE",reported_signal_percent=None)
        result=evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")
        self.assertEqual(result["confusion_matrix_at_80"]["false_positive"],1)
        self.assertEqual(result["confusion_matrix_at_80"]["true_positive"],20)
        ui=result["ui_selection"]
        self.assertEqual(ui["status"],"MEASURED")
        self.assertEqual(ui["assessed_n"],38)
        self.assertEqual(ui["abstained_n"],2)
        self.assertEqual(ui["human_abstained_n"],1)
        self.assertEqual(ui["ai_abstained_n"],1)
        self.assertEqual(ui["reported_human_high_at_80"],0)
        self.assertEqual(ui["reported_ai_high_at_80"],19)
        self.assertAlmostEqual(ui["reported_ai_high_rate_all"],19/20)
        self.assertEqual(ui["reported_ai_high_rate_assessed"],1)
        self.assertAlmostEqual(ui["abstention_rate"],2/40)
        self.assertGreater(ui["human_high_upper_95_all"],0)
        self.assertEqual(ui["by_domain"]["engineering"]["abstained_n"],2)

    def test_ui_evidence_must_be_complete_and_fail_closed(self):
        rows=self.samples()
        missing=evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")
        self.assertEqual(missing["ui_selection"]["status"],"NOT_RECORDED")
        rows[0]["report_status"]="SINGLE_UNCALIBRATED_MODEL"
        with self.assertRaisesRegex(ValueError,"Partial UI evidence"):
            evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")
        rows=self.samples()
        for row in rows:
            row["report_status"]="SINGLE_UNCALIBRATED_MODEL"
            row["reported_signal_percent"]=row["score"]
        rows[0]["report_status"]="UNVERIFIED_STATUS"
        with self.assertRaisesRegex(ValueError,"UI status"):
            evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")
        rows[0]["report_status"]="INSUFFICIENT_COVERAGE"
        with self.assertRaisesRegex(ValueError,"Inconsistent UI"):
            evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")
        rows[0]["reported_signal_percent"]=None
        rows[0]["report_status"]="SINGLE_UNCALIBRATED_MODEL"
        with self.assertRaisesRegex(ValueError,"Inconsistent UI"):
            evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")

    def test_generator_family_audit_keeps_small_sample_uncertainty(self):
        rows=self.samples()
        for r in rows:
            if r["label"]=="ai":
                r["model_family"]="generatorA" if int(r["id"].split("-")[-1])<10 else "generatorB"
        report=evaluate(rows,expected_benchmark="synthetic-test",revision="fixture")
        families=report["generator_family_audit"]
        self.assertEqual(set(families),{"generatorA","generatorB"})
        self.assertEqual(families["generatorA"]["n"],10)
        self.assertEqual(families["generatorB"]["n"],10)
        self.assertLess(families["generatorA"]["lower_95_tpr_at_80"],1)
        self.assertLess(families["generatorB"]["lower_95_tpr_at_80"],1)

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
