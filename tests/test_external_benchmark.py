"""Synthetic source contracts only; does not validate detector accuracy."""
from __future__ import annotations
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"backend"/"research"))
from build_textsight_benchmark import prepare, group_key, readable_english


def make_text(i: int, prefix: str) -> str:
    phrase = ("The engineers reviewed measured results and documented the experiment "
              "with independent sources, methods, dates, and relevant constraints. ")
    return (phrase*13) + f" This unique {prefix} record comes from item {i}."


class ExternalCorpusTests(unittest.TestCase):
    def corpus(self):
        wikipedia=[{"id":f"w-{i}","text":make_text(i,"wiki"),
                    "label":"human","article":f"article-{i}"} for i in range(22)]
        academic=[{"id":f"p-{i}","text":make_text(i,"academic"),
                   "label":"human","pmc_id":f"PMC-{i}"} for i in range(22)]
        generated=[]
        for model in ("modelA","modelB","modelC"):
            for i in range(8):
                generated.append({"id":f"g-{model}-{i}","text":make_text(i,model),
                   "label":"ai","source":model,
                   "prompt":f"Describe topic {i}",
                   "genre":"biomedical" if i%2 else "encyclopedic"})
        return {
            "human_wikipedia":wikipedia,
            "human_academic":academic,
            "ai_2026":generated,
        }

    def test_balanced_correlated_prompt_sources(self):
        rows,manifest=prepare(self.corpus(),per_human=20,per_ai_family=8)
        self.assertEqual(len(rows),64)
        self.assertEqual(sum(x["label"]=="human" for x in rows),40)
        self.assertEqual(sum(x["label"]=="ai" for x in rows),24)
        self.assertEqual(set(manifest["model_families"]),{"modelA","modelB","modelC"})
        self.assertTrue(any(x["domain"]=="academic" for x in rows))
        self.assertTrue(any(x["domain"]=="encyclopedic" for x in rows))
        self.assertTrue(all(x["label_provenance"].endswith("NOT_INDEPENDENTLY_AUDITED") for x in rows))
        self.assertEqual(len(set(x["id"] for x in rows)),len(rows))
        self.assertEqual(len(set(x["source_group"] for x in rows if x["label"]=="ai")),8)
        again,_=prepare(self.corpus(),per_human=20,per_ai_family=8)
        self.assertEqual([x["id"] for x in rows],[x["id"] for x in again])

    def test_unverified_or_invalid_sources_fail_closed(self):
        bad=self.corpus()
        bad["human_wikipedia"][0]["label"]="ai"
        with self.assertRaisesRegex(ValueError,"Unexpected authorship"):
            prepare(bad)
        self.assertFalse(readable_english("كلمات عربية " * 150))
        self.assertFalse(readable_english("too short"))
        with self.assertRaisesRegex(ValueError,"AI sample"):
            group_key({"id":"a","prompt":""},"ai_2026")
        with self.assertRaisesRegex(ValueError,"Research sample-size"):
            prepare(self.corpus(),per_human=1)

if __name__=="__main__":
    unittest.main()
