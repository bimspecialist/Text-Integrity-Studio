"""Dataset contract and contamination regression tests. No model dependencies."""
import importlib.util
import pathlib
import tempfile
import csv
import unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location("trainer",ROOT/"evaluation"/"train_baseline.py")
trainer=importlib.util.module_from_spec(s);s.loader.exec_module(trainer)
BASE=[
{"id":"h1","text":"Authentic human description of an engineering experiment and its measured results. "*2,"label":"human","split":"train","language":"en","domain":"engineering","author_group":"writer1"},
{"id":"h2","text":"A second human report with a distinct explanation and documented measurements. "*2,"label":"human","split":"validation","language":"en","domain":"engineering","author_group":"writer2"},
{"id":"a1","text":"Synthetic training example created only for a software fixture and not a science conclusion. "*2,"label":"ai","split":"test","language":"en","domain":"engineering","author_group":""},
]
def save(rows, path):
 with open(path,"w",encoding="utf8",newline="") as file:
  writer=csv.DictWriter(file,fieldnames=["id","text","label","split","language","domain","author_group"])
  writer.writeheader();writer.writerows(rows)
class DataTests(unittest.TestCase):
 def load(self,rows):
  with tempfile.TemporaryDirectory() as td:
   path=pathlib.Path(td)/"labeled.csv";save(rows,path)
   return trainer.load_validated(path)
 def test_good(self):
  out=self.load(BASE)
  self.assertEqual(len(out),3)
 def test_duplicate_id(self):
  items=[dict(x) for x in BASE];items[1]["id"]="h1"
  with self.assertRaisesRegex(ValueError,"Duplicate"):self.load(items)
 def test_source_duplicate_cross_split(self):
  items=[dict(x) for x in BASE];items[1]["text"]=items[0]["text"]
  with self.assertRaisesRegex(ValueError,"Identical text"):self.load(items)
 def test_author_leak(self):
  items=[dict(x) for x in BASE];items[1]["author_group"]="writer1"
  with self.assertRaisesRegex(ValueError,"Human author"):self.load(items)
 def test_invalid_label(self):
  items=[dict(x) for x in BASE];items[1]["label"]="machine"
  with self.assertRaisesRegex(ValueError,"Invalid label"):self.load(items)
 def test_stats(self):
  self.assertEqual(trainer.coverage(BASE)["train"]["human"],1)
if __name__=="__main__":unittest.main()
