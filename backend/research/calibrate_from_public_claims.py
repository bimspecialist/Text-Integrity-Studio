"""Weak-label calibration study: fit only on CALIBRATION, report untouched TEST.

No artifact from here is approved for public authorship percentages. Results
are conditional on the public dataset's claimed labels and writing domain.

    python backend/research/calibrate_from_public_claims.py \
      --records private/raw-model-predictions.jsonl \
      --output private/diagnostics.json --benchmark HC3_PUBLIC_WEAK_LABELS

Uses monotone penalized Platt calibration on actual transformer logits. It
provides reproducible brier/ECE/FPR comparison without implying validity
for academic papers, non-native writers or modern generator families.
"""
from __future__ import annotations
import argparse
import json
import math
from collections import Counter
from pathlib import Path
from evaluate_model_outputs import evaluate

def sigmoid(z:float)->float:
    if z>0:return 1/(1+math.exp(-z))
    exp=math.exp(z)
    return exp/(1+exp)

def logit(p:float)->float:
    p=max(0.0001,min(0.9999,p))
    return math.log(p/(1-p))

def fit_platt(rows:list[dict])->dict:
    labels=[int(row["label"]=="ai") for row in rows]
    if len(rows)<40 or min(sum(labels),len(labels)-sum(labels))<15:
        raise ValueError("At least 15 human and 15 AI labels in calibration required")
    x=[logit(float(row["score"])/100) for row in rows]
    a,b=0.0,1.0
    for _ in range(1400):
        pred=[sigmoid(a+b*z) for z in x]
        da=sum(p-y for p,y in zip(pred,labels))/len(rows)+.003*a
        db=sum((p-y)*z for p,y,z in zip(pred,labels,x))/len(rows)+.015*(b-1)
        a-=.03*da
        b=max(.01,min(8.0,b-.03*db))
    return {"intercept":a,"slope":b,"method":"POSITIVE_SLOPE_REGULARIZED_LOGIT_PLATT",
            "calibration_n":len(rows),
            "calibration_human_n":len(rows)-sum(labels),
            "calibration_ai_n":sum(labels)}

def calibrate(score:float,parameters:dict)->float:
    return sigmoid(parameters["intercept"]+parameters["slope"]*logit(score/100))*100

def study(rows:list[dict],benchmark:str,model_revision:str)->dict:
    eligible=[r for r in rows if r.get("split") in ("calibration","test")]
    calibration=[r for r in eligible if r["split"]=="calibration"]
    test=[r for r in eligible if r["split"]=="test"]
    groups={}
    for row in eligible:
        group=row["group"]
        if group in groups and groups[group]!=row["split"]:
            raise ValueError("Source group leakage across calibration/test")
        groups[group]=row["split"]
    if not test or not calibration:
        raise ValueError("Calibration and untouched test partitions required")
    if min(Counter(r["label"] for r in test).values())<15:
        raise ValueError("Untouched test lacks enough examples for even a research diagnostic")
    params=fit_platt(calibration)
    raw=evaluate(test,expected_benchmark=benchmark,revision=model_revision)
    mapped=[dict(r,score=calibrate(r["score"],params)) for r in test]
    after=evaluate(mapped,expected_benchmark=benchmark,revision=model_revision)
    return {
        "stage":"UNAPPROVED_WEAK_LABEL_RESEARCH",
        "model_revision":model_revision,"benchmark":benchmark,
        "calibration":params,
        "test_n":len(test),
        "test_split_was_not_used_for_fitting":True,
        "original":raw,
        "weak_corpus_calibrated":after,
        "approval":"BLOCKED",
        "limitations":[
          "Platt mapping is fitted to public claimed-label corpus only.",
          "Scores do not directly measure authorship. OOD calibration/fairness unknown.",
          "No threshold is approved by this experiment.",
          "Human academic and English-as-second-language cohorts not represented independently."
        ]
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--records",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--benchmark",required=True)
    parser.add_argument("--model-revision",required=True)
    args=parser.parse_args()
    records=[json.loads(line) for line in args.records.read_text(encoding="utf-8").splitlines() if line.strip()]
    result=study(records,args.benchmark,args.model_revision)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding="utf-8")
    condensed={
      "stage":result["stage"],"test_n":result["test_n"],
      "platt_intercept":round(result["calibration"]["intercept"],4),
      "platt_slope":round(result["calibration"]["slope"],4),
      "original_fpr":result["original"]["observed_fpr_at_80"],
      "mapped_fpr":result["weak_corpus_calibrated"]["observed_fpr_at_80"],
      "original_brier":result["original"]["brier"],
      "mapped_brier":result["weak_corpus_calibrated"]["brier"],
      "original_ece":result["original"]["ece_10bins"],
      "mapped_ece":result["weak_corpus_calibrated"]["ece_10bins"],
      "approval":result["approval"]
    }
    print(json.dumps(condensed,indent=2))

if __name__=="__main__":main()
