"""Build an independent, licensed, research-only *evaluation* corpus.

Source: TextSight AI Detection Benchmark 2026 (CC BY-SA 4.0)
https://huggingface.co/datasets/textsightai/ai-text-detection-benchmark-2026

Only ephemeral copies of text are used by GitHub CI. No dataset samples,
user documents, or raw text are uploaded to artifact storage or committed.
The dataset is published by another detector vendor; the author and generator
provenance claims are inspectable but NOT independently audited by this project.
Pre-ChatGPT Wikipedia revisions, 2015-2021 academic PMC papers, and modern
2026 AI generator samples deliberately stress cross-domain false alerts.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
from pathlib import Path

DATASET = "textsightai/ai-text-detection-benchmark-2026"
DATASET_REVISION = "423b1768f0827675295fd6dc3cd255ad2f411183"
LICENSE = "cc-by-sa-4.0"
INPUT_FILES = {
    "human_wikipedia": "data/human_wikipedia_pre2022.jsonl",
    "human_academic": "data/human_pmc_ccby_nonanglophone.jsonl",
    "ai_2026": "data/ai_generated_2026-09-29.jsonl",
}
MAX_SOURCE_BYTES = 2 * 1024 * 1024
SEED = 20261013


def digest(text: str) -> str:
    return hashlib.sha256(" ".join(str(text).casefold().split()).encode("utf-8")).hexdigest()


def readable_english(text: str) -> bool:
    if not isinstance(text, str) or len(text) > 120000:
        return False
    if len(text.split()) < 120:
        return False
    latin = len(re.findall(r"[A-Za-z]", text))
    arabic = len(re.findall(r"[\u0600-\u06ff]", text))
    return latin >= 80 and arabic < max(4, latin * .02)


def group_key(record: dict, shard: str) -> str:
    if shard == "ai_2026":
        # Keep identical prompts grouped even across generator families.
        prompt = str(record.get("prompt", "")).strip()
        if not prompt:
            raise ValueError("AI sample has no documented generation prompt")
        return "prompt-" + digest(prompt)[:20]
    if shard == "human_academic":
        identity = record.get("pmc_id") or record.get("pmcid") or record.get("id")
    else:
        identity = record.get("article") or record.get("title") or record.get("page_id") or record.get("id")
    if not identity:
        raise ValueError("Human record lacks documented source identity")
    return shard + "-" + digest(str(identity))[:20]


def prepare(rows_by_source: dict[str, list[dict]], *, per_human: int = 32, per_ai_family: int = 8) -> tuple[list[dict], dict]:
    if not 10 <= per_human <= 120 or not 3 <= per_ai_family <= 12:
        raise ValueError("Research sample-size limits exceeded")
    selected: list[dict] = []
    seen_text: set[str] = set()
    counts = collections.Counter()
    family_counts = collections.Counter()
    groups_by_source = collections.defaultdict(set)
    for shard in INPUT_FILES:
        if shard not in rows_by_source:
            raise ValueError("Missing source shard: " + shard)
        candidates = []
        for row in rows_by_source[shard]:
            if not isinstance(row, dict) or not readable_english(row.get("text")):
                continue
            expected = "ai" if shard == "ai_2026" else "human"
            if row.get("label") != expected:
                raise ValueError(f"Unexpected authorship label in source shard: {shard}")
            group = group_key(row, shard)
            text = row["text"].strip()
            text_id = digest(text)
            family = str(row.get("source", "unknown")) if expected == "ai" else ""
            if expected == "ai" and family == "unknown":
                raise ValueError("AI record missing generator family")
            candidates.append((group, text_id, family, row, text))
        candidates.sort(key=lambda item: digest(str(SEED) + ":" + shard + ":" + item[0] + ":" + item[2]))
        for group, text_id, family, original, text in candidates:
            if text_id in seen_text:
                continue
            # Preserve separate model-family generations of the same prompt.
            # They are correlated by prompt and will be reported as such,
            # never treated as independent calibration/test author groups.
            group_identity = group + "|" + family if shard == "ai_2026" else group
            if group_identity in groups_by_source[shard]:
                continue
            if shard == "ai_2026":
                if family_counts[family] >= per_ai_family:
                    continue
            elif counts[shard] >= per_human:
                continue
            seen_text.add(text_id)
            groups_by_source[shard].add(group_identity)
            counts[shard] += 1
            if shard == "ai_2026":
                family_counts[family] += 1
            label = "ai" if shard == "ai_2026" else "human"
            genre = str(original.get("genre", "")).casefold()
            domain = ("academic" if "academic" in genre or "biomedical" in genre else
                      "encyclopedic" if label == "ai" else
                      "academic" if shard == "human_academic" else "encyclopedic")
            selected.append({
                "id": str(original.get("id") or digest(shard + ":" + group + ":" + text_id)[:20]),
                "text": text, "label": label, "language": "en",
                "split": "test", "domain": domain,
                "source_group": group, "model_family": family,
                "source_dataset": DATASET,
                "label_provenance": "DOCUMENTED_EXTERNAL_SOURCE_NOT_INDEPENDENTLY_AUDITED",
            })
    if counts["human_wikipedia"] < 15 or counts["human_academic"] < 15:
        raise ValueError("Insufficient verified-date human-source examples")
    if counts["ai_2026"] < 20 or len(family_counts) < 3:
        raise ValueError("Insufficient diverse current-generation AI examples")
    if len({row["id"] for row in selected}) != len(selected):
        raise ValueError("Duplicate source record identifiers")
    manifest = {
        "dataset": DATASET, "license": LICENSE,
        "provenance": "SOURCE_VENDOR_CLAIMS_NOT_INDEPENDENTLY_AUDITED",
        "source_count": dict(sorted(counts.items())),
        "model_families": dict(sorted(family_counts.items())),
        "total": len(selected), "source_text_in_artifact": False,
        "note": "No samples may train, calibrate or choose a threshold; this is an externally sourced research evaluation only.",
    }
    return selected, manifest


def download_source() -> tuple[dict[str, list[dict]], str]:
    from huggingface_hub import HfApi, hf_hub_download

    api = HfApi()
    info = api.dataset_info(DATASET, revision=DATASET_REVISION)
    sha = str(info.sha)
    if not re.fullmatch(r"[a-f0-9]{40}", sha) or sha != DATASET_REVISION:
        raise RuntimeError("Configured external benchmark revision cannot be verified")
    card = info.cardData
    published_license = card.get("license") if isinstance(card, dict) else getattr(card, "license", None)
    if published_license != LICENSE:
        raise RuntimeError("Hugging Face declared dataset license changed; manual review required")
    result = {}
    for key, filename in INPUT_FILES.items():
        path = Path(hf_hub_download(repo_id=DATASET, repo_type="dataset", filename=filename, revision=sha))
        if path.stat().st_size > MAX_SOURCE_BYTES:
            raise ValueError("Unexpected upstream dataset shard size; manual review required")
        with path.open(encoding="utf-8") as stream:
            result[key] = [json.loads(line) for line in stream if line.strip()]
    return result, sha


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--human-per-domain", type=int, default=32)
    parser.add_argument("--ai-per-family", type=int, default=8)
    args = parser.parse_args()
    raw, sha = download_source()
    records, manifest = prepare(raw, per_human=args.human_per_domain, per_ai_family=args.ai_per_family)
    manifest["resolved_source_revision"] = sha
    args.out.mkdir(parents=True, exist_ok=True)
    data_path = args.out / "external-source-eval-private.jsonl"
    if data_path.exists():
        raise FileExistsError("Refusing to overwrite an existing source dataset")
    with data_path.open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    (args.out / "source-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    # Emit metadata only, NEVER text or user data in CI logs.
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
