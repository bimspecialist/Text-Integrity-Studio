"""E2: Synthetic group-disjoint split tests. No real released cohort is implied."""
import copy
import json
import unittest
from backend.research.cohort_split import split_cohorts, audit_group_leakage


def record(i, label="human", author=None, article=None, prompt=None,
           model=None, family=None):
    return {
        "id": "synthetic-%03d" % i,
        "content_digest": ("%064x" % (i + 1)),
        "label": label,
        "author_group": author or "writer-%03d" % i,
        "article_group": article or "article-%03d" % i,
        "prompt_group": prompt or "prompt-%03d" % i,
        "source_family": family or "source-%03d" % i,
        "source_revision": "fixed-synthetic-revision",
        "model_family": model or ("fixture-llm" if label == "ai" else "none"),
    }


def split_name(groups, needle):
    for name in ("train", "calibration", "validation", "release_test"):
        if any(r["id"] == needle for r in groups[name]):
            return name
    raise AssertionError("case missing")


class CohortSplitTests(unittest.TestCase):
    def test_transitive_author_article_prompt_components_cannot_leak(self):
        rows = [
            record(1, author="writer-A", article="article-X"),
            record(2, author="writer-B", article="article-X"),
            record(3, author="writer-B", article="article-Z"),
            *[record(i, label="human" if i % 2 else "ai") for i in range(4, 35)]
        ]
        outcome = split_cohorts(rows, seed=20261013)
        expected = split_name(outcome, "synthetic-001")
        self.assertEqual(split_name(outcome, "synthetic-002"), expected)
        self.assertEqual(split_name(outcome, "synthetic-003"), expected)
        self.assertEqual(audit_group_leakage(outcome)["status"], "PASS")

    def test_duplicate_digest_kept_in_same_cohort(self):
        a, b = record(1), record(2)
        b["content_digest"] = a["content_digest"]
        rows = [a, b] + [record(i) for i in range(3, 25)]
        outcome = split_cohorts(rows)
        self.assertEqual(split_name(outcome, a["id"]), split_name(outcome, b["id"]))
        self.assertEqual(audit_group_leakage(outcome)["violations"], [])

    def test_shared_prompt_with_unseen_generator_is_frozen_in_release(self):
        a=record(40, label="ai", prompt="prompt-shared", model="seen-model")
        b=record(41, label="ai", prompt="prompt-shared", model="new-model")
        rows=[a,b]+[record(i, label="human" if i % 2 else "ai") for i in range(2, 36)]
        out=split_cohorts(rows, unseen_generator_families={"new-model"})
        self.assertEqual(split_name(out, b["id"]), "release_test")
        self.assertEqual(split_name(out, a["id"]), "release_test")
        self.assertEqual(audit_group_leakage(out, unseen_generator_families={"new-model"})["status"], "PASS")

    def test_deterministic_same_seed_and_no_source_text_in_manifest(self):
        rows=[record(i, label="human" if i % 2 else "ai") for i in range(1, 45)]
        rows[0]["raw_text"]="PRIVATE_NOTE_DO_NOT_EXPORT_4055"
        first=split_cohorts(copy.deepcopy(rows),seed=77)
        second=split_cohorts(copy.deepcopy(list(reversed(rows))),seed=77)
        self.assertEqual(first["split_manifest"],second["split_manifest"])
        for name in ("train","calibration","validation","release_test"):
            self.assertEqual(sorted(r["id"] for r in first[name]),
                             sorted(r["id"] for r in second[name]))
        data=json.dumps(first["split_manifest"])
        self.assertNotIn("PRIVATE_NOTE",data)
        self.assertNotIn("synthetic-001",data)
        self.assertNotIn("writer-001",data)
        self.assertTrue(first["split_manifest"]["release_test_sha256"])

    def test_different_seeds_never_sacrifice_disjointness(self):
        rows=[record(i,label="human" if i%2 else "ai") for i in range(1,50)]
        for seed in (1,2,20261013):
            out=split_cohorts(rows,seed=seed)
            self.assertEqual(audit_group_leakage(out)["status"],"PASS")
            assigned=[r["id"] for name in ("train","calibration","validation","release_test")
                      for r in out[name]]
            self.assertCountEqual(assigned,[r["id"] for r in rows])

    def test_manual_cross_split_replay_is_detected_without_ids(self):
        a,b=record(1,author="same-writer"),record(2,author="same-writer")
        out={"train":[a],"calibration":[],"validation":[],"release_test":[b]}
        report=audit_group_leakage(out)
        self.assertEqual(report["status"],"FAIL")
        self.assertIn("CROSS_SPLIT_AUTHOR_GROUP",report["violations"])
        self.assertNotIn("same-writer",json.dumps(report))

    def test_undersized_cohorts_are_not_declared_ready(self):
        out=split_cohorts([record(1,label="human"),record(2,label="ai")])
        self.assertEqual(out["split_manifest"]["status"],"INSUFFICIENT_GROUP_DIVERSITY")
        self.assertEqual(audit_group_leakage(out)["status"],"PASS")

    def test_unseen_generator_claim_fails_if_contaminated(self):
        ai=record(1,label="ai",model="unseen")
        out={"train":[ai],"calibration":[],"validation":[],"release_test":[]}
        audit=audit_group_leakage(out,unseen_generator_families={"unseen"})
        self.assertEqual(audit["status"],"FAIL")
        self.assertIn("HELD_OUT_GENERATOR_IN_TRAIN",audit["violations"])


if __name__=="__main__":
    unittest.main()
