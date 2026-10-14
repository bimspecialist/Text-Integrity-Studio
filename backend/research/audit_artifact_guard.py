"""E5 fail-closed CI research artifact publication guard.

Only aggregate, source-claimed diagnostics from the pinned TextSight 2026
research job are eligible for uploading. No release readiness is inferred.
This is intentionally a strict schema: upstream format changes stop upload
until their privacy impact has been reviewed.
"""
from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any

from backend.research.build_textsight_benchmark import DATASET, DATASET_REVISION, LICENSE

REVISION = "b9aa251e5bcda7e429fcc936767d921435945b60"
BENCH = "TEXTSIGHT_2026_EXTERNAL_VENDOR_BENCHMARK"
NOTES = [
    "Observed rates are on public, weakly verified data and are not cross-domain claims.",
    "Pretrained model may have encountered related data; provenance, deduplication and group review required.",
    "A low false-positive count in small groups does not establish safe operation.",
    "Data used here must never be used to fit thresholds and report independent test metrics in the same run.",
]
MANIFEST_NOTE = ("No samples may train, calibrate or choose a threshold; "
                 "this is an externally sourced research evaluation only.")
UI_NOT_RECORDED_NOTE = (
    "Legacy corpus recorded raw signals only; visible UI false-alert and abstention rates are unknown."
)
UI_MEASURED_NOTE = (
    "This describes raw classifier diagnostics actually displayed by the browser. "
    "Abstentions are not human classifications or correct negatives. "
    "Rates among assessed texts are selection-biased; labels remain source claims. "
    "Neither a displayed score nor agreement proves AI authorship."
)
MANIFEST_KEYS = {
    "dataset", "license", "provenance", "source_count", "model_families",
    "total", "source_text_in_artifact", "note", "resolved_source_revision",
}
METRICS_KEYS = {
    "system", "model_revision", "model_revision_audit", "benchmark", "ground_truth",
    "license_audit", "samples", "human_n", "ai_n", "auroc", "brier", "ece_10bins",
    "alert_threshold", "observed_fpr_at_80", "upper_95_fpr_at_80",
    "observed_tpr_at_80", "confusion_matrix_at_80", "precision_at_80",
    "precision_wilson_95_interval_at_80", "recall_at_80",
    "recall_wilson_95_interval_at_80", "f1_at_80",
    "observed_fnr_at_80", "fnr_wilson_95_interval_at_80",
    "domain_audit", "generator_family_audit", "ui_selection",
    "release_readiness", "notes",
}
NUMERIC_FIELDS = METRICS_KEYS - {
    "system", "model_revision", "model_revision_audit", "benchmark", "ground_truth",
    "license_audit", "domain_audit", "generator_family_audit", "ui_selection",
    "release_readiness", "notes",
}
FORBIDDEN_KEYS = {
    "raw_text", "text", "document_text", "per_document_predictions", "document",
    "prompt", "excerpt", "source_group", "content_digest", "case_id_sha256",
    "group_hashes_sha256", "author", "email", "sample_id", "source_text",
    "document_id", "upload_url", "person_name",
}
SAFE_DIMENSION = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_./:+ \-]{0,79}$")


def _fail(code: str):
    raise ValueError(code)


def _int(value: Any) -> bool:
    return type(value) is int and value >= 0


def _number(value: Any) -> bool:
    return (type(value) in (int, float) and
            math.isfinite(value) and value >= 0)


def _aggregate_tree(obj: Any, *, depth: int = 0) -> None:
    if depth > 8:
        _fail("PRIVATE_ARTIFACT_EXCESSIVE_NESTING")
    if isinstance(obj, dict):
        for key, item in obj.items():
            if (not isinstance(key, str) or key in FORBIDDEN_KEYS or
                    not re.fullmatch(r"[A-Za-z0-9_]{1,85}", key)):
                _fail("PRIVATE_ARTIFACT_UNKNOWN_FIELD")
            _aggregate_tree(item, depth=depth + 1)
        return
    if isinstance(obj, list):
        if len(obj) > 30:
            _fail("PRIVATE_ARTIFACT_UNEXPECTED_LIST")
        for item in obj:
            _aggregate_tree(item, depth=depth + 1)
        return
    if obj is not None and not _number(obj):
        _fail("PRIVATE_ARTIFACT_NONNUMERIC_EVIDENCE")


def audit_aggregate_pair(manifest: dict, metrics: dict) -> dict:
    """Reject raw inputs and return an aggregate-only, always-BLOCKED verdict."""
    if not isinstance(manifest, dict) or not isinstance(metrics, dict):
        _fail("PRIVATE_ARTIFACT_REQUIRES_OBJECTS")
    if set(manifest) != MANIFEST_KEYS or set(metrics) != METRICS_KEYS:
        _fail("PRIVATE_ARTIFACT_UNREVIEWED_SCHEMA")
    if (manifest["dataset"] != DATASET or manifest["license"] != LICENSE or
        manifest["resolved_source_revision"] != DATASET_REVISION):
        _fail("SOURCE_REVISION_OR_LICENSE_PIN_MISMATCH")
    if manifest["provenance"] != "SOURCE_VENDOR_CLAIMS_NOT_INDEPENDENTLY_AUDITED":
        _fail("UNVERIFIED_SOURCE_PROVENANCE_MUST_REMAIN_MARKED")
    if manifest["source_text_in_artifact"] is not False or manifest["note"] != MANIFEST_NOTE:
        _fail("PRIVATE_ARTIFACT_TEXT_RISK")
    source_counts = manifest["source_count"]
    families = manifest["model_families"]
    if (not isinstance(source_counts, dict) or
        set(source_counts) != {"human_wikipedia", "human_academic", "ai_2026"} or
        not all(_int(v) for v in source_counts.values()) or
        not isinstance(families, dict) or not families or
        not all(isinstance(k, str) and SAFE_DIMENSION.fullmatch(k) and _int(v)
                for k, v in families.items())):
        _fail("PRIVATE_ARTIFACT_UNREVIEWED_SOURCE_COUNTS")
    if (not _int(manifest["total"]) or
        sum(source_counts.values()) != manifest["total"] or
        sum(families.values()) != source_counts["ai_2026"]):
        _fail("AGGREGATE_COUNT_MISMATCH")
    if (metrics["system"] != "TIS browser TMR model" or
        metrics["model_revision"] != REVISION or
        metrics["model_revision_audit"] != "ALL_RECORDS_MATCH"):
        _fail("MODEL_REVISION_OR_RUNTIME_PIN_MISMATCH")
    if (metrics["benchmark"] != BENCH or
        metrics["ground_truth"] !=
         "PUBLIC_DATASET_AUTHORSHIP_CLAIMS_NOT_INDEPENDENTLY_VERIFIED" or
        metrics["license_audit"] != "REQUIRED" or
        metrics["release_readiness"] != "NOT_APPROVED"):
        _fail("UNVERIFIED_LABEL_PROVENANCE_OR_RELEASE_STATE_CHANGED")
    if metrics["notes"] != NOTES:
        _fail("PRIVATE_ARTIFACT_FREE_TEXT_NOT_REVIEWED")
    if not all(_number(metrics[name]) or metrics[name] is None for name in NUMERIC_FIELDS):
        # Confidence interval fields are allowed bounded numeric arrays.
        for name in NUMERIC_FIELDS:
            value = metrics[name]
            if value is None or _number(value):
                continue
            if not (isinstance(value, list) and len(value) == 2 and
                    all(_number(v) for v in value)):
                _fail("PRIVATE_ARTIFACT_NUMERIC_METRICS_ONLY")
    for name in ("samples", "human_n", "ai_n"):
        if not _int(metrics[name]):
            _fail("AGGREGATE_COUNT_INVALID")
    if (metrics["samples"] != manifest["total"] or
        metrics["human_n"] != source_counts["human_wikipedia"] + source_counts["human_academic"] or
        metrics["ai_n"] != source_counts["ai_2026"]):
        _fail("AGGREGATE_COUNT_MISMATCH")
    for group_name in ("domain_audit", "generator_family_audit"):
        groups = metrics[group_name]
        if not isinstance(groups, dict):
            _fail("PRIVATE_ARTIFACT_UNREVIEWED_GROUP")
        for label, group in groups.items():
            if group_name == "domain_audit":
                if label not in ("academic", "encyclopedic"):
                    _fail("PRIVATE_ARTIFACT_UNREVIEWED_DOMAIN")
            elif label not in families:
                _fail("PRIVATE_ARTIFACT_UNREVIEWED_MODEL_FAMILY")
            if not isinstance(group, dict):
                _fail("PRIVATE_ARTIFACT_UNREVIEWED_GROUP")
            _aggregate_tree(group)
    _aggregate_tree(metrics["confusion_matrix_at_80"])
    ui = metrics["ui_selection"]
    if not isinstance(ui, dict) or ui.get("status") not in ("NOT_RECORDED", "MEASURED"):
        _fail("PRIVATE_ARTIFACT_UNREVIEWED_UI")
    if ui["status"] == "NOT_RECORDED":
        if ui != {"status": "NOT_RECORDED", "note": UI_NOT_RECORDED_NOTE}:
            _fail("PRIVATE_ARTIFACT_UNREVIEWED_UI_NOTE")
    else:
        if ui.get("note") != UI_MEASURED_NOTE:
            _fail("PRIVATE_ARTIFACT_UNREVIEWED_UI_NOTE")
        for key, val in ui.items():
            if key in ("note", "status"):
                continue
            if key in ("by_domain", "by_generator_family"):
                if not isinstance(val, dict):
                    _fail("PRIVATE_ARTIFACT_UNREVIEWED_UI_GROUP")
                for label, stats in val.items():
                    if not ((key == "by_domain" and label in ("academic", "encyclopedic")) or
                            (key == "by_generator_family" and label in families)):
                        _fail("PRIVATE_ARTIFACT_UNREVIEWED_UI_GROUP")
                    _aggregate_tree(stats)
            else:
                if not (val is None or _number(val)):
                    _fail("PRIVATE_ARTIFACT_UNREVIEWED_UI_STAT")

    # Public research artifacts contain no case IDs, source text, source-group
    # fingerprints, member predictions or candidate calibration parameters.
    return {
        "decision": "BLOCKED",
        "reasons": [
            "INDEPENDENT_GROUND_TRUTH_NOT_VERIFIED",
            "NOT_AN_UNTOUCHED_REGISTERED_RELEASE_TEST",
            "PROBABILITY_CLAIM_NOT_AUTHORIZED",
        ],
        "aggregate_sample_count": metrics["samples"],
        "model_revision": REVISION,
        "source_revision": DATASET_REVISION,
        "artifact_status": "STRICT_AGGREGATE_RESEARCH_ONLY",
        "public_probability_enabled": False,
        "production_deployment": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--metrics", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args()
    for path in (options.manifest, options.metrics):
        if path.stat().st_size > 2_000_000:
            _fail("PRIVATE_ARTIFACT_FILE_TOO_LARGE")
    manifest = json.loads(options.manifest.read_text(encoding="utf-8"))
    metrics = json.loads(options.metrics.read_text(encoding="utf-8"))
    decision = audit_aggregate_pair(manifest, metrics)
    options.output.write_text(json.dumps(decision, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(decision, ensure_ascii=False))


if __name__ == "__main__":
    main()
