"""Research-only third-party benchmark scorer for actual pretrained-model inference.

Run:
  python backend/research/evaluate_model_outputs.py \
    --samples /private/holdout-labelled-results.jsonl \
    --output /private/eval.json \
    --model-revision <pinned revision> --benchmark hc3-public-claims

Labels must be known *outside* the model, and source leakage is checked. This
script computes a score breakdown; it does NOT issue a deployment approval.
It never includes document text in its written output.
"""
from __future__ import annotations
import argparse
import collections
import json
import math
from pathlib import Path

REQUIRED = {"id","label","score","group","domain","language","benchmark","label_provenance"}

def wilson_upper(positive: int,total: int,z: float=1.959963984540054)->float:
    if total <= 0:return 1.0
    p=positive/total
    z2=z*z
    return min(1.0,(p+z2/(2*total)+z*math.sqrt((p*(1-p)+z2/(4*total))/total))/(1+z2/total))

def wilson_lower(positive: int,total: int,z: float=1.959963984540054)->float:
    if total <= 0:return 0.0
    return 1.0-wilson_upper(total-positive,total,z)

def auc(labels: list[int],scores: list[float])->float|None:
    if not labels or not 0<sum(labels)<len(labels):return None
    ordered=sorted(zip(scores,labels))
    ranks=[];i=0
    while i<len(ordered):
        j=i+1
        while j<len(ordered) and ordered[j][0]==ordered[i][0]:j+=1
        rank=(i+1+j)/2
        ranks.extend([rank]*(j-i))
        i=j
    p=sum(labels);n=len(labels)-p
    return (sum(rank for rank,(score,label) in zip(ranks,ordered) if label==1)-p*(p+1)/2)/(p*n)

def ece(labels: list[int],scores: list[float],bins: int=10)->float:
    if not scores:return 1.0
    total=0.0
    for start in range(bins):
        assigned=[(y,s) for y,s in zip(labels,scores)
                  if min(bins-1,int(s*bins))==start]
        if assigned:
            truth=sum(y for y,s in assigned)/len(assigned)
            pred=sum(s for y,s in assigned)/len(assigned)
            total+=len(assigned)/len(scores)*abs(truth-pred)
    return total

# These states describe the real browser's display contract, not AI authorship.
_UI_SCORED = {"SINGLE_UNCALIBRATED_MODEL", "AGREEMENT_UNCALIBRATED", "SECONDARY_UNAVAILABLE"}
_UI_ABSTAINED = {"INSUFFICIENT_COVERAGE", "HETEROGENEOUS_DOCUMENT", "MODEL_DISAGREEMENT"}

def evaluate_visible_ui(rows: list[dict]) -> dict:
    """Audit selectively displayed diagnostics separately from raw model outputs.

    Older benchmarks lacking these fields stay explicitly NOT_RECORDED; incomplete
    or contradictory records fail closed rather than silently biasing the denominator.
    No source text or personally identifying document content is retained.
    """
    present = any("report_status" in r or "reported_signal_percent" in r for r in rows)
    if not present:
        return {"status": "NOT_RECORDED",
                "note": "Legacy corpus recorded raw signals only; visible UI false-alert and abstention rates are unknown."}
    for row in rows:
        if "report_status" not in row or "reported_signal_percent" not in row:
            raise ValueError("Partial UI evidence: report_status and reported_signal_percent are required on every sample")
        status = row["report_status"]
        if not isinstance(status, str) or status not in _UI_SCORED | _UI_ABSTAINED:
            raise ValueError("Invalid UI status")
        score = row["reported_signal_percent"]
        if score is None:
            if status not in _UI_ABSTAINED:
                raise ValueError("Inconsistent UI: scored status cannot have a null visible diagnostic")
        else:
            if status not in _UI_SCORED:
                raise ValueError("Inconsistent UI: abstaining status cannot display a score")
            if isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score) or not 0 <= score <= 100:
                raise ValueError("Invalid UI score")
            if abs(float(score) - float(row["score"])) > 1e-6:
                raise ValueError("Inconsistent UI: one-model research diagnostic differs from raw model score")

    def cohort(subset: list[dict]) -> dict:
        human = [r for r in subset if r["label"] == "human"]
        ai = [r for r in subset if r["label"] == "ai"]
        selected = [r for r in subset if r["reported_signal_percent"] is not None]
        human_selected = [r for r in selected if r["label"] == "human"]
        ai_selected = [r for r in selected if r["label"] == "ai"]
        human_high = sum(float(r["reported_signal_percent"]) >= 80 for r in human_selected)
        ai_high = sum(float(r["reported_signal_percent"]) >= 80 for r in ai_selected)
        return {
            "total_n": len(subset),
            "assessed_n": len(selected),
            "abstained_n": len(subset) - len(selected),
            "human_n": len(human),
            "ai_n": len(ai),
            "human_assessed_n": len(human_selected),
            "ai_assessed_n": len(ai_selected),
            "human_abstained_n": len(human) - len(human_selected),
            "ai_abstained_n": len(ai) - len(ai_selected),
            "reported_human_high_at_80": human_high,
            "reported_ai_high_at_80": ai_high,
            "reported_human_high_rate_all": human_high / len(human) if human else None,
            "reported_ai_high_rate_all": ai_high / len(ai) if ai else None,
            "reported_human_high_rate_assessed": human_high / len(human_selected) if human_selected else None,
            "reported_ai_high_rate_assessed": ai_high / len(ai_selected) if ai_selected else None,
            "human_high_upper_95_all": wilson_upper(human_high, len(human)) if human else None,
            "human_high_upper_95_assessed": wilson_upper(human_high, len(human_selected)) if human_selected else None,
            "ai_high_lower_95_all": wilson_lower(ai_high, len(ai)) if ai else None,
            "abstention_rate": (len(subset) - len(selected)) / len(subset) if subset else None,
        }

    result = {"status": "MEASURED", **cohort(rows)}
    result["by_domain"] = {name: cohort([r for r in rows if str(r["domain"]) == name])
                           for name in sorted({str(r["domain"]) for r in rows})}
    result["by_generator_family"] = {
        name: cohort([r for r in rows if r["label"] == "ai" and str(r.get("model_family", "")) == name])
        for name in sorted({str(r.get("model_family")) for r in rows
                            if r["label"] == "ai" and r.get("model_family")})
    }
    result["note"] = ("This describes raw classifier diagnostics actually displayed by the browser. "
                       "Abstentions are not human classifications or correct negatives. "
                       "Rates among assessed texts are selection-biased; labels remain source claims. "
                       "Neither a displayed score nor agreement proves AI authorship.")
    return result

def evaluate(rows: list[dict], *, expected_benchmark: str, revision: str)->dict:
    if not rows:raise ValueError("Empty benchmark")
    ids=set();groups={}
    for row in rows:
        if not REQUIRED.issubset(row.keys()):raise ValueError("Missing provenance fields")
        if row["id"] in ids:raise ValueError("Repeated document ID")
        ids.add(row["id"])
        if row["label"] not in ("ai","human"):raise ValueError("Invalid authorship label")
        if row["benchmark"]!=expected_benchmark:raise ValueError("Unrecognized benchmark")
        if row["language"]!="en":raise ValueError("English-only detector benchmark cannot include other languages")
        if not isinstance(row["score"],(float,int)) or not math.isfinite(row["score"]) or not 0<=row["score"]<=100:
            raise ValueError("Non-finite or out-of-range model output")
        if row["label_provenance"]=="INDEPENDENTLY_VERIFIED":
            # License/provenance requires independent review, not a field claim.
            raise ValueError("Do not self-assert verified ground truth without an audit reference")
        group=str(row["group"])
        if group in groups and groups[group]!=str(row.get("split","test")):
            raise ValueError("Group leakage across test splits")
        groups[group]=str(row.get("split","test"))
    revisions_present = ["model_revision" in row for row in rows]
    if any(revisions_present) and not all(revisions_present):
        raise ValueError("Partial model revision evidence: each record must identify the inference checkpoint")
    revision_audit = "NOT_RECORDED"
    if all(revisions_present):
        if any(not isinstance(row["model_revision"], str) or row["model_revision"] != revision for row in rows):
            raise ValueError("Model revision mismatch: cannot aggregate unpinned or mixed checkpoints")
        revision_audit = "ALL_RECORDS_MATCH"
    y=[int(row["label"]=="ai") for row in rows]
    predictions=[float(row["score"])/100 for row in rows]
    human=sum(v==0 for v in y);machine=sum(y)
    fp=sum(y_i==0 and s>=.8 for y_i,s in zip(y,predictions))
    tp=sum(y_i==1 and s>=.8 for y_i,s in zip(y,predictions))
    fn=machine-tp
    tn=human-fp
    predicted_ai=tp+fp
    precision=tp/predicted_ai if predicted_ai else None
    recall=tp/machine if machine else None
    f1=2*tp/(2*tp+fp+fn) if (2*tp+fp+fn) else None
    domain_results={}
    for domain in sorted({str(row["domain"]) for row in rows}):
        cohort=[r for r in rows if str(r["domain"])==domain]
        n_h=sum(r["label"]=="human" for r in cohort)
        n_fp=sum(r["label"]=="human" and float(r["score"])>=80 for r in cohort)
        n_ai=sum(r["label"]=="ai" for r in cohort)
        n_tp=sum(r["label"]=="ai" and float(r["score"])>=80 for r in cohort)
        domain_results[domain]={
            "total":len(cohort),"human":n_h,"ai":n_ai,
            "observed_fp_rate":n_fp/n_h if n_h else None,
            "upper_95_fp_rate":wilson_upper(n_fp,n_h) if n_h else None,
            "observed_tpr_at_80":n_tp/n_ai if n_ai else None,
            "lower_95_tpr_at_80":1-wilson_upper(n_ai-n_tp,n_ai) if n_ai else None
        }
    model_family_results={}
    for family in sorted({str(r.get("model_family","")) for r in rows
                         if r["label"]=="ai" and r.get("model_family")}):
        cohort=[r for r in rows if r["label"]=="ai" and r.get("model_family")==family]
        detected=sum(float(r["score"])>=80 for r in cohort)
        model_family_results[family[:100]]={
            "n":len(cohort),
            "detected_at_80":detected,
            "observed_tpr_at_80":detected/len(cohort),
            "lower_95_tpr_at_80":1-wilson_upper(len(cohort)-detected,len(cohort))
        }
    result={
      "system":"TIS browser TMR model",
      "model_revision":revision,"model_revision_audit":revision_audit,"benchmark":expected_benchmark,
      "ground_truth":"PUBLIC_DATASET_AUTHORSHIP_CLAIMS_NOT_INDEPENDENTLY_VERIFIED",
      "license_audit":"REQUIRED",
      "samples":len(rows),"human_n":human,"ai_n":machine,
      "auroc":auc(y,predictions),
      "brier":sum((s-a)**2 for s,a in zip(predictions,y))/len(y),
      "ece_10bins":ece(y,predictions),
      "alert_threshold":.8,
      "observed_fpr_at_80":fp/human if human else None,
      "upper_95_fpr_at_80":wilson_upper(fp,human),
      "observed_tpr_at_80":recall,
      "confusion_matrix_at_80":{"true_positive":tp,"false_positive":fp,"true_negative":tn,"false_negative":fn},
      "precision_at_80":precision,
      "precision_wilson_95_interval_at_80":[wilson_lower(tp,predicted_ai),wilson_upper(tp,predicted_ai)] if predicted_ai else None,
      "recall_at_80":recall,
      "recall_wilson_95_interval_at_80":[wilson_lower(tp,machine),wilson_upper(tp,machine)] if machine else None,
      "f1_at_80":f1,
      "observed_fnr_at_80":fn/machine if machine else None,
      "fnr_wilson_95_interval_at_80":[wilson_lower(fn,machine),wilson_upper(fn,machine)] if machine else None,
      "domain_audit":domain_results,
      "generator_family_audit":model_family_results,
      "ui_selection":evaluate_visible_ui(rows),
      "release_readiness":"NOT_APPROVED",
      "notes":[
        "Observed rates are on public, weakly verified data and are not cross-domain claims.",
        "Pretrained model may have encountered related data; provenance, deduplication and group review required.",
        "A low false-positive count in small groups does not establish safe operation.",
        "Data used here must never be used to fit thresholds and report independent test metrics in the same run."
      ]
    }
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--samples",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--model-revision",required=True)
    parser.add_argument("--benchmark",required=True)
    args=parser.parse_args()
    rows=[]
    with args.samples.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():rows.append(json.loads(line))
    report=evaluate(rows,expected_benchmark=args.benchmark,revision=args.model_revision)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf-8")
    print(json.dumps(report,indent=2,ensure_ascii=False))

if __name__=="__main__":main()
