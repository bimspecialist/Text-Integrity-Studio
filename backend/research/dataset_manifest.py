"""E1 metadata-only dataset and authorship-label provenance audit.

This is a *structural* evidence gate, not independent authentication of
human reviews or rights. The release owner must verify attestations and
licensing out-of-band before any empirical accuracy claims.

Input rows may contain private text; this module NEVER returns raw records,
IDs, group names, or content digests.
"""
from __future__ import annotations

import re
from collections import Counter
from typing import Any

HEX64 = re.compile(r"^[0-9a-f]{64}$")
TIERS = ("PUBLIC_SOURCE_CLAIM", "MACHINE_INFERRED", "INDEPENDENTLY_VERIFIED")
SPLITS = {"train", "calibration", "validation", "release_test", "test", "unknown"}
GROUP_FIELDS = ("author_group", "article_group", "prompt_group", "source_family")


def _nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _pinned(value: Any) -> bool:
    return _nonempty(value) and value.strip().lower() not in {
        "main", "master", "head", "latest", "unknown", "unversioned"
    }


def _safe_group(value: Any) -> str:
    return value.strip() if _nonempty(value) else "unknown"


def _verified(row: dict, evidence: dict) -> bool:
    ref = row.get("review_evidence_ref")
    proof = evidence.get(ref) if _nonempty(ref) else None
    if not isinstance(proof, dict):
        return False
    if proof.get("label") != row["label"] or proof.get("content_digest") != row["content_digest"]:
        return False
    if not _nonempty(proof.get("reviewer_id")) or not _nonempty(proof.get("evidence_reference")):
        return False
    if not isinstance(proof.get("attestation_digest"), str) or not HEX64.fullmatch(
        proof["attestation_digest"]
    ):
        return False
    # An attestation digest is a *pointer for external review*, not a
    # cryptographic signature and never automatic permission to publish.
    return True


def validate_manifest(records: list[dict], licenses: dict) -> dict:
    """Audit structural licenses, label review references and duplicate leakage.

    Raises ValueError for malformed, contradictory or unlicensed sources.
    Soft review shortcomings are returned only as aggregate issue codes.
    `release_eligible_labels` is a prerequisite count, NOT release approval.
    """
    if not isinstance(records, list) or not isinstance(licenses, dict):
        raise TypeError("Manifest records and external license/review registry are required")
    license_records = licenses.get("licenses", {})
    review_records = licenses.get("review_evidence", {})
    if not isinstance(license_records, dict) or not isinstance(review_records, dict):
        raise ValueError("INVALID_REVIEW_REGISTRY")

    counts: Counter = Counter()
    errors: set[str] = set()
    cases: set[str] = set()
    groups: set[tuple] = set()
    digests: dict[str, tuple[tuple, str]] = {}
    license_ids: set[str] = set()
    independently_reviewable = 0
    for row in records:
        if not isinstance(row, dict):
            raise ValueError("INVALID_CASE_METADATA")
        identity = row.get("id")
        if not _nonempty(identity) or identity in cases:
            raise ValueError("DUPLICATE_OR_EMPTY_CASE_ID")
        cases.add(identity)
        digest = row.get("content_digest")
        if not isinstance(digest, str) or not HEX64.fullmatch(digest):
            raise ValueError("INVALID_CONTENT_DIGEST")
        label = row.get("label")
        tier = row.get("label_provenance")
        if label not in ("human", "ai") or tier not in TIERS:
            raise ValueError("INVALID_LABEL_PROVENANCE")
        if not _pinned(row.get("source_revision")):
            raise ValueError("UNPINNED_SOURCE_REVISION")
        if not _nonempty(row.get("source")) or not _nonempty(row.get("language")) or not _nonempty(row.get("domain")):
            raise ValueError("INCOMPLETE_SOURCE_METADATA")
        if label == "ai" and _safe_group(row.get("model_family")).lower() in {"unknown", "none"}:
            raise ValueError("UNIDENTIFIED_AI_MODEL_FAMILY")
        split = row.get("split", "unknown")
        if split not in SPLITS:
            raise ValueError("INVALID_SPLIT_NAME")
        source_license = row.get("source_license")
        license_audit = license_records.get(source_license) if _nonempty(source_license) else None
        if (not isinstance(license_audit, dict) or license_audit.get("approved") is not True
            or not _nonempty(license_audit.get("checked_by"))
            or not _nonempty(license_audit.get("evidence_reference"))):
            raise ValueError("LICENSE_NOT_INDEPENDENTLY_REVIEWED")
        license_ids.add(source_license)
        group = tuple(_safe_group(row.get(field)) for field in GROUP_FIELDS)
        groups.add(group)
        if digest in digests:
            prior_group, prior_split = digests[digest]
            if group != prior_group:
                raise ValueError("DIGEST_GROUP_CONFLICT_LEAKAGE")
            if split != prior_split:
                raise ValueError("CROSS_SPLIT_DUPLICATE_LEAKAGE")
        digests[digest] = (group, split)

        counts[tier] += 1
        if tier != "INDEPENDENTLY_VERIFIED":
            continue
        if not _verified(row, review_records):
            errors.add("INDEPENDENT_REVIEW_NOT_CONFIRMED")
            continue
        # Unknown author/source grouping means provenance or split independence
        # cannot yet be demonstrated, even if a reviewer reference exists.
        if group[0] == "unknown" or group[1] == "unknown" or group[3] == "unknown":
            errors.add("UNKNOWN_GROUP_PREVENTS_VERIFICATION")
            continue
        independently_reviewable += 1

    # IDs, digests, source text, filenames and group values must never be emitted.
    return {
        "records_total": len(records),
        "label_confidence_counts": {tier: counts[tier] for tier in TIERS},
        "licenses_checked": len(license_ids),
        "groups_total": len(groups),
        "release_eligible_labels": independently_reviewable,
        "errors": sorted(errors),
        "independent_attestation_status": "STRUCTURAL_ONLY_MANUAL_REVIEW_REQUIRED",
    }
