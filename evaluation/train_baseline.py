#!/usr/bin/env python3
"""Optional local multilingual detector research baseline.

Requires explicitly consented/provenance-verified labeled documents. Not used by
the GitHub Pages app. Never deploy a classifier without held-out evaluation,
subgroup fairness review and explicit abstention policy.

Setup: python -m pip install -r evaluation/requirements-model.txt
Usage: python evaluation/train_baseline.py approved_data.csv --out-dir local-results
CSV: id,text,label,split,language,domain,dialect,author_group,model_family
splits: train, validation, test (selected BEFORE training)
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime, timezone

SPLITS = ("train", "validation", "test")
REQUIRED = ("id", "text", "label", "split", "language", "domain")


def sha(text):
    return hashlib.sha256(" ".join(text.split()).encode("utf-8")).hexdigest()


def load_validated(path):
    rows, ids, hashes = [], set(), {}
    with open(path, encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        missing = set(REQUIRED) - set(reader.fieldnames or [])
        if missing:
            raise ValueError("Missing columns: " + ", ".join(sorted(missing)))
        for n, raw in enumerate(reader, 2):
            r = {k: (v or "").strip() for k, v in raw.items() if k}
            rid = r["id"]
            if not rid or rid in ids:
                raise ValueError("Duplicate/empty id at line " + str(n))
            ids.add(rid)
            if r["label"].lower() not in ("human", "ai"):
                raise ValueError("Invalid label at line " + str(n))
            if r["split"].lower() not in SPLITS:
                raise ValueError("Split must be train/validation/test at line " + str(n))
            if len(r["text"]) < 80 or len(r["text"]) > 120000:
                raise ValueError("Sample text length outside 80–120000 characters at line " + str(n))
            r["label"],r["split"] = r["label"].lower(),r["split"].lower()
            h = sha(r["text"])
            if h in hashes and hashes[h] != r["split"]:
                raise ValueError("Identical text crosses train/validation/test splits: " + rid)
            hashes[h] = r["split"]
            rows.append(r)
    if not rows:
        raise ValueError("No rows")
    # An explicitly supplied human author must not cross data splits.
    author_splits = defaultdict(set)
    for r in rows:
        if r["label"] == "human" and r.get("author_group"):
            author_splits[r["author_group"]].add(r["split"])
    leaks = [a for a, splits in author_splits.items() if len(splits)>1]
    if leaks:
        raise ValueError("Human author groups cross evaluation splits: " + ", ".join(leaks[:5]))
    return rows


def coverage(rows):
    by_split = defaultdict(Counter)
    for row in rows:
        by_split[row["split"]][row["label"]] += 1
    return {k: dict(by_split[k]) for k in SPLITS}


def train(rows, output_path, min_per_class=30):
    # Optional large dependencies are imported only for actual local training.
    from joblib import dump
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.metrics import roc_auc_score
    import numpy as np
    import sys
    sys.path.insert(0,str(Path(__file__).resolve().parent))
    import score_detector

    groups = {split:[r for r in rows if r["split"]==split] for split in SPLITS}
    for split, subset in groups.items():
        counts = Counter(r["label"] for r in subset)
        if min(counts.get("human",0),counts.get("ai",0))<min_per_class:
            raise ValueError(f"{split} has insufficient verified samples per class: {dict(counts)}")
    model=make_pipeline(
        TfidfVectorizer(analyzer="char",ngram_range=(3,5),min_df=2,max_features=70000,sublinear_tf=True),
        LogisticRegression(max_iter=1200,class_weight="balanced",random_state=42)
    )
    model.fit([r["text"] for r in groups["train"]],[int(r["label"]=="ai") for r in groups["train"]])
    val_scores=model.decision_function([r["text"] for r in groups["validation"]])
    # Platt scaling is fitted ONLY on the validation partition.
    calibrator=LogisticRegression(random_state=42,max_iter=500)
    calibrator.fit(np.asarray(val_scores).reshape(-1,1),[int(r["label"]=="ai") for r in groups["validation"]])
    test_scores=model.decision_function([r["text"] for r in groups["test"]])
    probabilities=calibrator.predict_proba(np.asarray(test_scores).reshape(-1,1))[:,1]
    labeled=[]
    for row, score in zip(groups["test"],probabilities):
        labeled.append({
            "id":row["id"],"label":row["label"],"score":float(score),"split":"test",
            "language":row["language"],"domain":row["domain"],
            "dialect":row.get("dialect",""),"edit_type":row.get("edit_type","")
        })
    scored=score_detector.evaluate(labeled,threshold=.5,split="test",calibrated=True)
    out=Path(output_path)
    out.mkdir(parents=True,exist_ok=True)
    # Only load artifacts you created locally; joblib/pickle is unsafe for untrusted files.
    dump({"model":model,"calibrator":calibrator,"version":"tfidf-char-3to5-logreg-platt-v1"},
         out/"local_experimental_model.joblib")
    with (out/"held_out_scores.csv").open("w",encoding="utf-8",newline="") as f:
        w=csv.DictWriter(f,fieldnames=list(labeled[0]));w.writeheader();w.writerows(labeled)
    report={
        "trained_at":datetime.now(timezone.utc).isoformat(),
        "architecture":"TF-IDF char n-grams 3–5 + logistic regression + validation-only Platt calibration",
        "sample_counts":coverage(rows),
        "limitations":"Experimental, corpus-specific, cannot establish document authorship. NOT DEPLOYABLE without governance and fairness review.",
        "independently_verified_provenance":"NOT REVIEWED",
        "holdout":scored
    }
    (out/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("csv")
    p.add_argument("--out-dir",default="local-evaluation-output")
    p.add_argument("--minimum-per-class",type=int,default=30)
    a=p.parse_args()
    if a.minimum_per_class<2:p.error("minimum-per-class must be >=2")
    train(load_validated(a.csv),a.out_dir,a.minimum_per_class)


if __name__=="__main__":
    main()
