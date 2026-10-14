"""E2 deterministic connected-group train/calibration/validation/release split.

Separate from production inference and calibration. No text is written to the
returned split manifest; split lists themselves remain research-process data.
A structural split is NOT scientific release clearance.
"""
from __future__ import annotations

import hashlib
import random
from collections import Counter, defaultdict
from typing import Any

PARTITIONS = ("train", "calibration", "validation", "release_test")
WEIGHTS = {"train": 0.55, "calibration": 0.20, "validation": 0.15, "release_test": 0.10}
# Unknown/none identifiers must not connect unrelated sources.
EMPTY_GROUPS = {"", "none", "unknown", "null", "n/a", "not_applicable"}
GROUP_KEYS = ("content_digest", "author_group", "article_group", "prompt_group", "source_family")


def _known(value: Any) -> bool:
    return isinstance(value, str) and value.strip().lower() not in EMPTY_GROUPS


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _key_list(row: dict):
    for field in GROUP_KEYS:
        value = row.get(field)
        if _known(value):
            yield (field, value)


def audit_group_leakage(splits: dict, unseen_generator_families: set[str] | None = None) -> dict:
    """Aggregate only violation *types*; never expose group names, IDs, or text."""
    if not isinstance(splits, dict):
        raise TypeError("Expected split dictionary")
    violated: set[str] = set()
    owned: dict[tuple, str] = {}
    seen_ids: dict[str, str] = {}
    unseen = unseen_generator_families or set()
    for name in PARTITIONS:
        rows = splits.get(name, [])
        if not isinstance(rows, list):
            raise TypeError("Split lists are required")
        for row in rows:
            if not isinstance(row, dict):
                raise TypeError("Invalid split record")
            case_id = row.get("id")
            if case_id in seen_ids:
                violated.add("DUPLICATE_CASE_ID_IN_SPLITS")
            else:
                seen_ids[case_id] = name
            for field, value in _key_list(row):
                key = (field, value)
                if key in owned and owned[key] != name:
                    label = {
                        "content_digest": "CROSS_SPLIT_CONTENT_DIGEST",
                        "author_group": "CROSS_SPLIT_AUTHOR_GROUP",
                        "article_group": "CROSS_SPLIT_ARTICLE_GROUP",
                        "prompt_group": "CROSS_SPLIT_PROMPT_GROUP",
                        "source_family": "CROSS_SPLIT_SOURCE_FAMILY",
                    }[field]
                    violated.add(label)
                else:
                    owned[key] = name
            if (row.get("label") == "ai" and row.get("model_family") in unseen
                    and name != "release_test"):
                violated.add("HELD_OUT_GENERATOR_IN_TRAIN")
    return {
        "status": "PASS" if not violated else "FAIL",
        "violations": sorted(violated),
        "per_split_counts": {name: len(splits.get(name, [])) for name in PARTITIONS},
    }


def _connected_components(rows: list[dict]) -> list[list[dict]]:
    parent = list(range(len(rows)))
    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    def union(i: int, j: int):
        a, b = find(i), find(j)
        if a != b:
            parent[max(a, b)] = min(a, b)
    owners = {}
    for index, row in enumerate(rows):
        for key in _key_list(row):
            if key in owners:
                union(index, owners[key])
            else:
                owners[key] = index
    groups = defaultdict(list)
    for i, row in enumerate(rows):
        groups[find(i)].append(row)
    return list(groups.values())


def split_cohorts(
    records: list[dict],
    seed: int = 20261013,
    unseen_generator_families: set[str] | None = None
) -> dict:
    if not isinstance(records, list) or not isinstance(seed, int) or isinstance(seed, bool):
        raise TypeError("Deterministic records and integer seed required")
    unseen = unseen_generator_families or set()
    if not isinstance(unseen, set) or not all(isinstance(x, str) for x in unseen):
        raise TypeError("Unseen generator families must be a set of exact model names")
    rows = sorted(records, key=lambda r: str(r.get("id", "")))
    keys = [r.get("id") for r in rows]
    if any(not isinstance(k, str) or not k for k in keys) or len(set(keys)) != len(keys):
        raise ValueError("DUPLICATE_OR_MISSING_CASE_ID")
    for r in rows:
        if r.get("label") not in ("human", "ai") or not _known(r.get("content_digest")):
            raise ValueError("MISSING_LABEL_OR_SOURCE_DIGEST")
    components = _connected_components(rows)
    # Order independent of source file order; randomization exists only to
    # resolve otherwise equivalent component assignments reproducibly.
    rng = random.Random(seed)
    tagged = [(_hash("|".join(sorted(x["id"] for x in part))), part) for part in components]
    tagged.sort(key=lambda x: x[0])
    rng.shuffle(tagged)

    assigned = {name: [] for name in PARTITIONS}
    expected = Counter(r["label"] for r in rows)
    counts = {name: Counter() for name in PARTITIONS}
    heldout_groups = []
    other_groups = []
    for tag, part in tagged:
        if any(r["label"] == "ai" and r.get("model_family") in unseen for r in part):
            heldout_groups.append((tag, part))
        else:
            other_groups.append((tag, part))
    for _, part in heldout_groups:
        assigned["release_test"].extend(part)
        counts["release_test"].update(r["label"] for r in part)
    for tag, part in sorted(other_groups, key=lambda z: (-len(z[1]), z[0])):
        labels = Counter(r["label"] for r in part)
        choices = []
        for name in PARTITIONS:
            # Choose the closest aggregate distribution without splitting a
            # connected group. Limited groups cannot be made representative.
            loss = sum(
                ((counts[name][kind] + labels[kind] - WEIGHTS[name] * expected[kind]) ** 2) /
                max(1, expected[kind]) for kind in ("human", "ai")
            )
            before = sum(
                ((counts[name][kind] - WEIGHTS[name] * expected[kind]) ** 2) /
                max(1, expected[kind]) for kind in ("human", "ai")
            )
            choices.append((loss - before, PARTITIONS.index(name), name))
        chosen = min(choices)[2]
        assigned[chosen].extend(part)
        counts[chosen].update(labels)
    for name in PARTITIONS:
        assigned[name].sort(key=lambda r: r["id"])

    audit = audit_group_leakage(assigned, unseen)
    if audit["status"] != "PASS":
        raise ValueError("GROUP_LEAKAGE_DETECTED")
    diverse = all(counts[name]["human"] and counts[name]["ai"] for name in PARTITIONS)
    unobserved_holdout = bool(unseen) and not heldout_groups
    manifest = {
        "seed": seed,
        "status": (
            "UNSEEN_GENERATOR_NOT_PRESENT" if unobserved_holdout else
            "STRUCTURAL_ONLY_REVIEW_REQUIRED" if diverse else
            "INSUFFICIENT_GROUP_DIVERSITY"
        ),
        "grouping_fields": list(GROUP_KEYS),
        "connected_groups": len(components),
        "heldout_generator_component_count": len(heldout_groups),
        "split_counts": {name: dict(counts[name]) for name in PARTITIONS},
        "case_id_sha256": {
            name: sorted(_hash(r["id"]) for r in assigned[name]) for name in PARTITIONS
        },
        "release_test_sha256": _hash("|".join(sorted(_hash(r["id"]) for r in assigned["release_test"]))),
        "source_revisions": sorted({str(r.get("source_revision", "")) for r in rows}),
    }
    return {**assigned, "split_manifest": manifest}
