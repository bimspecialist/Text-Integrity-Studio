import importlib.util
from pathlib import Path
import unittest
f=Path(__file__).resolve().parents[1]/"evaluation"/"ab_editor.py"
spec=importlib.util.spec_from_file_location("ab_editor",f)
ab=importlib.util.module_from_spec(spec);spec.loader.exec_module(ab)
class ExperimentTests(unittest.TestCase):
 def sample(self,variant,n=5,success=0):
  return [{"variant":variant,"locale":"ar" if i%2 else "en","completed":int(i<success),
           "meaning_error":0,"reversed":0,"seconds":40.0,"reviewer_score":4.0} for i in range(n)]
 def test_sample_insufficient(self):
  result=ab.evaluate(self.sample("A",5,2)+self.sample("B",5,3))
  self.assertEqual(result["release_decision"],"INCONCLUSIVE")
  self.assertEqual(result["gates"]["sample_size"],"UNKNOWN")
 def test_error_regression_blocker(self):
  a=self.sample("A",100,50)
  b=self.sample("B",100,100)
  b[0]["meaning_error"]=1
  result=ab.evaluate(a+b)
  self.assertEqual(result["gates"]["no_meaning_regression"],"FAIL")
  self.assertEqual(result["release_decision"],"INCONCLUSIVE") # reviewer gate still UNKNOWN
 def test_empty(self):
  self.assertEqual(ab.describe([])["n"],0)
  self.assertIsNone(ab.describe([])["completion_rate"])
 def test_language_breakdown(self):
  x=ab.evaluate(self.sample("A",6,4)+self.sample("B",6,5),min_per_arm=3)
  self.assertIn("ar",x["per_locale"])
  self.assertIn("en",x["per_locale"])
if __name__=="__main__":unittest.main()
