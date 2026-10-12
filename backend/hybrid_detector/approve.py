"""Manual release-control command; never substitute automated metrics for human review.

Usage:
python -m hybrid_detector.approve --artifact private/artifacts/document.ar.json \
  --review private/provenance_review.json
Provenance review example:
{"reviewed_by":"independent-reviewer-identifier","approval_ref":"TIS-EVAL-2026-001",
 "dataset_licenses_checked":true,"label_provenance_checked":true,
 "heldout_test_was_untouched":true,"subgroup_appeals_process":true}
Do NOT check artifacts or reviews containing confidential corpus data into GitHub.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from .artifacts import validate


def approve(path: Path, review_path: Path) -> tuple[Path, Path]:
    artifact = json.loads(path.read_text(encoding="utf-8"))
    parsed = validate(artifact)
    review = json.loads(review_path.read_text(encoding="utf-8"))
    if not isinstance(review, dict):
        raise ValueError("Independent review must be a JSON object")
    required = (
        "dataset_licenses_checked", "label_provenance_checked",
        "heldout_test_was_untouched", "subgroup_appeals_process",
    )
    if not all(review.get(key) is True for key in required):
        raise ValueError("Independent evidence review incomplete; no release possible")
    if not review.get("reviewed_by") or not review.get("approval_ref"):
        raise ValueError("Named reviewer identifier and approval reference required")
    artifact["governance"] = {
        "provenance_reviewed": True,
        "approval_ref": str(review["approval_ref"])[:128],
        "reviewed_by": str(review["reviewed_by"])[:128],
        "release_approved": True,
        "note": "Operator attestation only; does not constitute independent scientific proof",
    }
    verdict = validate(artifact)
    ready, gaps = verdict.readiness()
    if not ready:
        raise ValueError("Independent validation gates failed: " + "; ".join(gaps))
    output = json.dumps(artifact, ensure_ascii=False, indent=2, allow_nan=False).encode("utf-8")
    path.write_bytes(output)
    manifest = path.with_name(path.name.removesuffix(".json") + ".approval.json")
    manifest.write_text(
        json.dumps({
            "artifact_sha256": hashlib.sha256(output).hexdigest(),
            "version": parsed.version,
            "approval_ref": review["approval_ref"],
            "reviewed_by": review["reviewed_by"],
        }, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return path, manifest


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--artifact", type=Path, required=True)
    p.add_argument("--review", type=Path, required=True)
    args = p.parse_args()
    artifact, manifest = approve(args.artifact, args.review)
    print(json.dumps({"approved_artifact": str(artifact), "manifest": str(manifest), "operation": "MANUAL_REVIEW_REQUIRED"}, indent=2))


if __name__ == "__main__":
    main()
