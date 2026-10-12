"""Synthetic software test of Platt mapping and untouched test isolation."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"backend"/"research"))
from calibrate_from_public_claims import fit_platt,calibrate,study

def records():
    rows=[]
    for split in ('calibration','test'):
      for label in ('human','ai'):
        for i in range(30):
          rows.append({
            "id":f"{split}-{label}-{i}",
            "label":label,
            "score":70+(i%7) if label=='human' else 95+(i%3),
            "group":f"group-{split}-{label}-{i}",
            "domain":"general","language":"en","split":split,
            "benchmark":"synthetic-research",
            "label_provenance":"SYNTHETIC_TEST_NOT_AUTHORSHIP_EVIDENCE"
          })
    return rows

class CalibrationTests(unittest.TestCase):
    def test_monotone_mapping_and_holdout(self):
        inputs=records()
        model=fit_platt([x for x in inputs if x["split"]=="calibration"])
        self.assertGreater(model["slope"],0)
        self.assertLess(calibrate(70,model),calibrate(96,model))
        result=study(inputs,"synthetic-research","synthetic")
        self.assertEqual(result["test_n"],60)
        self.assertEqual(result["stage"],"UNAPPROVED_WEAK_LABEL_RESEARCH")
        self.assertEqual(result["approval"],"BLOCKED")
        self.assertTrue(result["test_split_was_not_used_for_fitting"])
        self.assertGreaterEqual(result["original"]["observed_fpr_at_80"],0)
        self.assertEqual(result["calibration"]["calibration_n"],60)

    def test_leakage_refused(self):
        rows=records()
        rows[-1]["group"]=rows[0]["group"]
        with self.assertRaisesRegex(ValueError,"leakage"):
            study(rows,"synthetic-research","synthetic")

if __name__=="__main__":
    unittest.main()
