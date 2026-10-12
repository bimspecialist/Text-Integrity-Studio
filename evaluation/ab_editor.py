#!/usr/bin/env python3
"""Privacy-preserving, offline A/B analysis for reviewed writing workflows.
Never upload drafts, participant identity or raw document text.
CSV: session_hash,variant,locale,completed,seconds,meaning_error,reversed,reviewer_score
variant must be A or B; booleans 0/1; reviewer_score optional in [1,5].
"""
import argparse
import csv
import json
import math
import statistics
from collections import defaultdict
from datetime import datetime, timezone


def _proportion_interval(success, total, z=1.96):
    if not total:return None
    p=success/total;d=1+z*z/total
    c=(p+z*z/(2*total))/d
    m=z*math.sqrt(p*(1-p)/total+z*z/(4*total*total))/d
    return [max(0,c-m),min(1,c+m)]


def load(path):
    seen=set();rows=[]
    with open(path,newline="",encoding="utf-8-sig") as source:
        reader=csv.DictReader(source)
        required={"session_hash","variant","locale","completed","seconds","meaning_error","reversed"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError("Missing required A/B columns")
        for idx,row in enumerate(reader,2):
            key=(row["session_hash"] or "").strip()
            if not key or key in seen:raise ValueError("Duplicate/empty session_hash at row "+str(idx))
            seen.add(key)
            if row["variant"] not in ("A","B"):raise ValueError("Only A/B variants accepted")
            for flag in ("completed","meaning_error","reversed"):
                if row[flag] not in ("0","1"):raise ValueError("Boolean flags must be 0/1")
                row[flag]=int(row[flag])
            row["seconds"]=float(row["seconds"])
            if not math.isfinite(row["seconds"]) or row["seconds"]<0 or row["seconds"]>7200:
                raise ValueError("Invalid session seconds")
            raw=(row.get("reviewer_score") or "").strip()
            row["reviewer_score"]=None if not raw else float(raw)
            if row["reviewer_score"] is not None and not (1<=row["reviewer_score"]<=5):
                raise ValueError("Reviewer score outside [1,5]")
            if not row["locale"].strip():raise ValueError("Missing locale")
            rows.append(row)
    return rows


def describe(rows):
    n=len(rows)
    done=sum(r["completed"] for r in rows)
    bad=sum(r["meaning_error"] for r in rows)
    reversed_edits=sum(r["reversed"] for r in rows)
    scored=[r["reviewer_score"] for r in rows if r["reviewer_score"] is not None]
    times=sorted(r["seconds"] for r in rows)
    return {"n":n,
        "completion_rate":done/n if n else None,
        "completion_95ci":_proportion_interval(done,n),
        "meaning_error_rate":bad/n if n else None,
        "meaning_errors":bad,
        "reversal_rate":reversed_edits/n if n else None,
        "median_seconds":statistics.median(times) if times else None,
        "p95_seconds":times[math.ceil(len(times)*0.95)-1] if times else None,
        "reviewer_mean":statistics.mean(scored) if scored else None,
        "reviewer_n":len(scored)}


def evaluate(rows,min_per_arm=100,meaning_error_tolerance=0):
    by=defaultdict(list)
    for row in rows:by[row["variant"]].append(row)
    a,b=describe(by["A"]),describe(by["B"])
    by_locale={}
    for locale in sorted(set(row["locale"] for row in rows)):
        by_locale[locale]={key:describe([r for r in by[key] if r["locale"]==locale]) for key in ("A","B")}
    if not a["n"] or not b["n"]:
        change=None;error_change=None
    else:
        change=b["completion_rate"]-a["completion_rate"]
        error_change=b["meaning_error_rate"]-a["meaning_error_rate"]
    passes={
        "sample_size":"PASS" if min(a["n"],b["n"])>=min_per_arm else "UNKNOWN",
        "no_meaning_regression":"PASS" if error_change is not None and error_change<=meaning_error_tolerance else "FAIL" if error_change is not None else "UNKNOWN",
        "improved_completion_at_least_10pp":"PASS" if change is not None and change>=.10 else "UNKNOWN",
        "blind_reviewer_calibration":"UNKNOWN"  # Human oversight is mandatory
    }
    return {"as_of":datetime.now(timezone.utc).isoformat(),
      "variants":{"A":a,"B":b},"per_locale":by_locale,"completion_difference_B_minus_A":change,
      "meaning_error_difference_B_minus_A":error_change,"gates":passes,
      "release_decision":"INCONCLUSIVE" if "UNKNOWN" in passes.values() else "BLOCKED" if "FAIL" in passes.values() else "CONDITIONAL_REVIEW",
      "caveat":"A/B outcome cannot be equated to an AI detector score. Planning targets are not measured results."}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("csv")
    p.add_argument("--out",default="ab-editor-report.json")
    p.add_argument("--min-per-arm",type=int,default=100)
    a=p.parse_args()
    result=evaluate(load(a.csv),a.min_per_arm)
    with open(a.out,"w",encoding="utf8") as handle:json.dump(result,handle,ensure_ascii=False,indent=2)
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__=="__main__":main()
