"""Build a PRIVATE weak-label baseline corpus from audited HF source manifests.

No downloaded text is committed. Public corpus labels are only dataset claims:
NOT independently verified authorship, and NOT release-approved evidence.

Usage (from backend/):
    python -m hybrid_detector.baseline_data --source hc3_en --out /tmp/tis-baseline --limit 800
    python -m hybrid_detector.baseline_data --source aya_ar --out /tmp/tis-baseline --limit 800

Dataset revision SHAs are resolved, recorded and passed back to downloads;
fail if the repository changed between metadata lookup and download.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Iterable

from .text import detect_language, tokenize

CONFIG = Path(__file__).resolve().parents[1] / "datasets" / "baseline.sources.json"
SOURCE_KEYS = {"hc3_en", "aya_ar"}
MAX_SOURCE_BYTES = 18_000_000


def source_config(key: str, config: Path = CONFIG) -> dict:
    if key not in SOURCE_KEYS:
        raise ValueError("Unsupported source: " + key)
    source = next(s for s in json.loads(config.read_text(encoding="utf-8"))["sources"] if s["key"] == key)
    if source["ground_truth"].startswith("independently"):
        raise ValueError("Baseline sources must not claim independent labels")
    return source


def digest(value: str) -> str:
    return hashlib.sha256(" ".join(str(value).casefold().split()).encode("utf-8")).hexdigest()


def assigned_split(prompt_hash: str, seed: int = 20261012) -> str:
    score = int(hashlib.sha256(f"{seed}:{prompt_hash}".encode()).hexdigest()[:10], 16) % 100
    return "train" if score < 70 else "calibration" if score < 85 else "test"


def _text(value: object) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts = [item.get("content", "") for item in value if isinstance(item, dict)]
        if not parts and all(isinstance(item, str) for item in value):
            parts = value
        return "\n".join(str(item).strip() for item in parts if str(item).strip()).strip()
    return ""


def pair_hc3(item: dict, source_file: str) -> Iterable[tuple[str, str, str, str]]:
    question = _text(item.get("question"))
    group = digest(question)
    if not question or len(question) < 10:
        return
    human = item.get("human_answers") or []
    ai = item.get("chatgpt_answers") or []
    if not isinstance(human, list) or not isinstance(ai, list):
        return
    # Pick one answer per class per question to minimize near-duplicates.
    human_text = next((_text(x) for x in human if len(tokenize(_text(x))) >= 75), "")
    ai_text = next((_text(x) for x in ai if len(tokenize(_text(x))) >= 75), "")
    if human_text and ai_text:
        yield group, human_text, ai_text, "HC3-ChatGPT"


def pair_aya(item: dict, source_file: str) -> Iterable[tuple[str, str, str, str]]:
    prompt = _text(item.get("prompt"))
    group = digest(prompt) if prompt else digest(str(item.get("id")))
    human_text = _text(item.get("chosen"))
    ai_text = _text(item.get("rejected"))
    # Critically: preference 'chosen' is only a dataset CLAIM about human origin.
    # Never upgrade it to independently verified ground truth.
    if len(tokenize(human_text)) >= 75 and len(tokenize(ai_text)) >= 75:
        yield group, human_text, ai_text, "SambaLingo-claimed"


def compile_pairs(rows: Iterable[tuple[str, str, str, str]], *, source: dict, limit: int, seed: int = 20261012) -> tuple[list[dict], dict]:
    selected = []
    seen_pairs, seen_text = set(), set()
    language = source["language"]
    for group, human, ai, model in rows:
        if group in seen_pairs:
            continue
        if (len(tokenize(human)) < 75 or len(tokenize(ai)) < 75
                or len(tokenize(human)) > 12000 or len(tokenize(ai)) > 12000):
            continue
        if detect_language(human) != language or detect_language(ai) != language:
            continue
        hs, as_ = digest(human), digest(ai)
        if hs == as_ or hs in seen_text or as_ in seen_text:
            continue
        seen_pairs.add(group)
        seen_text.update((hs, as_))
        selected.append((group, human, ai, model))
    # Stable selection independent of original file order.
    selected.sort(key=lambda row: digest(f"{seed}:{row[0]}"))
    selected = selected[:limit]
    output = []
    counts = Counter()
    for group, human, ai, model in selected:
        split = assigned_split(group, seed)
        for label, text in (("human", human), ("ai", ai)):
            record = {
                "id": digest(f"{source['key']}:{group}:{label}")[:24],
                "text": text,
                "label": label,
                "split": split,
                "language": language,
                "domain": "general",
                "unit": "document",
                "writing_context": "general",
                # Opaque group prevents within-question crossover. NOT verified author identity.
                "author_group": f"UNVERIFIED_PAIR_{source['key']}_{group[:20]}",
                "source_group": f"{source['key']}_{group[:20]}",
                "model_family": model if label == "ai" else "",
                "source_dataset": source["repo"],
                "label_provenance": "UNVERIFIED_PUBLIC_DATASET_CLAIM",
                "independent_verified": False,
            }
            output.append(record)
            counts[f"{split}:{label}"] += 1
    stats = {"source": source["key"], "eligible_pairs": len(selected),
             "sample_counts": dict(sorted(counts.items())),
             "independently_verified": False,
             "warning": "All labels are dataset claims. This is NOT a production validation set."}
    return output, stats


def fetch_pairs(source: dict) -> tuple[list[tuple[str, str, str, str]], str]:
    from huggingface_hub import HfApi, hf_hub_download
    api = HfApi()
    info = api.dataset_info(source["repo"], revision=source["revision"])
    revision = info.sha
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise RuntimeError("Unable to freeze dataset revision")
    rows: list[tuple[str, str, str, str]] = []
    if source["key"] == "hc3_en":
        for filename in source["files"]:
            file = Path(hf_hub_download(repo_id=source["repo"], repo_type="dataset",
                                        filename=filename, revision=revision))
            if file.stat().st_size > MAX_SOURCE_BYTES:
                raise RuntimeError("Dataset shard larger than lightweight budget")
            with file.open(encoding="utf-8") as stream:
                for line in stream:
                    if line.strip():
                        rows.extend(pair_hc3(json.loads(line), filename))
    else:
        import pyarrow.parquet as pq
        paths = [p for p in api.list_repo_files(repo_id=source["repo"], repo_type="dataset", revision=revision)
                 if p.lower().endswith(".parquet")]
        if not paths:
            raise RuntimeError("Arabic dataset parquet shards unavailable")
        for filename in paths:
            file = Path(hf_hub_download(repo_id=source["repo"], repo_type="dataset",
                                        filename=filename, revision=revision))
            if file.stat().st_size > MAX_SOURCE_BYTES:
                raise RuntimeError("Dataset shard larger than lightweight budget")
            table = pq.read_table(file, columns=["id", "prompt", "chosen", "rejected", "model"])
            for item in table.to_pylist():
                rows.extend(pair_aya(item, filename))
    return rows, revision


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=sorted(SOURCE_KEYS), required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=800)
    args = parser.parse_args()
    if not 100 <= args.limit <= 4000:
        parser.error("--limit must be in range 100..4000")
    source = source_config(args.source)
    rows, revision = fetch_pairs(source)
    prepared, stats = compile_pairs(rows, source=source, limit=args.limit)
    for split in ("train", "calibration", "test"):
        if min(sum(r["split"] == split and r["label"] == lab for r in prepared)
               for lab in ("human", "ai")) < 30:
            raise RuntimeError(f"Insufficient eligible {split} pairs for trainer; no fake fallback will be used")
    args.out.mkdir(parents=True, exist_ok=True)
    target = args.out / (args.source + ".jsonl")
    if target.exists():
        raise FileExistsError("Refusing to overwrite an existing private dataset")
    with target.open("w", encoding="utf-8") as output:
        for record in prepared:
            output.write(json.dumps(record, ensure_ascii=False) + "\n")
    manifest = {**stats, "dataset": source["repo"], "revision": revision, "license": source["license"],
                "source_card": "https://huggingface.co/datasets/" + source["repo"],
                "training_file": str(target), "redistribution_permitted": False}
    (args.out / (args.source + ".manifest.json")).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k:v for k,v in manifest.items() if k != "training_file"}, indent=2))


if __name__ == "__main__":
    main()
