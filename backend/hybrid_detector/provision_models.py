"""Opt-in retrieval of pin-resolved, license-reviewed Hugging Face detector checkpoints.

This command DOWNLOADS public model weights (hundreds of MB) only when explicitly run.
It does NOT enable detection, calibration, or a production release on its own.

Python:
  python -m hybrid_detector.provision_models --language en --destination /models/tis/en
  python -m hybrid_detector.provision_models --language ar --destination /models/tis/ar
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

MODELS = {
    "en": {
        "repo": "fakespot-ai/roberta-base-ai-text-detection-v1",
        "license": "apache-2.0",
        "ai_index": 1,
        "non_ai_index": 0,
        "known_labels": ("Human", "AI"),
        "note": "Fakespot RoBERTa English detector, no independent validation for your corpus.",
    },
    "ar": {
        "repo": "nawaf11570/arabic-ai-arabert",
        "license": "apache-2.0",
        "ai_index": 1,
        "non_ai_index": 0,
        "known_labels": ("LABEL_0", "LABEL_1"),
        "note": "AraBERTv2 Arabic detector; model card explicitly says LABEL_1 = AI.",
    },
}
SAFE_FILES = [
    "config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json",
    "merges.txt", "vocab.json", "vocab.txt", "*.model", "*.safetensors",
]


def inspect_label_map(config: dict, language: str) -> dict:
    if language not in MODELS:
        raise ValueError("Unsupported locale")
    info = MODELS[language]
    mappings = config.get("id2label", {})
    labels = (str(mappings.get("0", mappings.get(0, ""))),
              str(mappings.get("1", mappings.get(1, ""))))
    if int(config.get("num_labels", 2)) != 2:
        raise ValueError("Expected binary human-vs-AI classification head")
    if language == "en":
        if tuple(s.lower() for s in labels) != ("human", "ai"):
            raise ValueError("RoBERTa class-1 AI mapping differs from the reviewed model card")
    elif labels not in (("LABEL_0", "LABEL_1"), ("HUMAN", "AI"), ("Human", "AI")):
        raise ValueError("AraBERT label mapping differs from reviewed model documentation")
    return {"id2label": list(labels), "ai_class_index": info["ai_index"]}


def provision(language: str, destination: Path) -> dict:
    if language not in MODELS:
        raise ValueError("Unsupported locale")
    from huggingface_hub import HfApi, snapshot_download

    info = MODELS[language]
    # Resolve immutable revision first, then pin exact same snapshot download.
    metadata = HfApi().model_info(info["repo"])
    if getattr(metadata, "gated", False) or getattr(metadata, "private", False):
        raise RuntimeError("Model is gated/private; this provisioning path refuses it")
    if metadata.cardData:
        license_info = metadata.cardData.get("license") if isinstance(metadata.cardData, dict) else getattr(metadata.cardData, "license", None)
        if license_info and license_info != info["license"]:
            raise RuntimeError("Source license differs from reviewed license")
    destination = destination.expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    path = Path(snapshot_download(
        repo_id=info["repo"], revision=metadata.sha, local_dir=str(destination),
        allow_patterns=SAFE_FILES, ignore_patterns=["*.bin", "*.pt", "*.pth", "*.py", "*.pkl", "*.pickle"],
    ))
    config_file = path / "config.json"
    if not config_file.is_file() or not list(path.rglob("*.safetensors")):
        raise RuntimeError("Refusing checkpoint without local safetensors and config")
    labels = inspect_label_map(json.loads(config_file.read_text(encoding="utf-8")), language)
    manifest = {
        "schema_version": 1, "repo": info["repo"], "revision": metadata.sha,
        "license": info["license"], "language": language,
        **labels, "purpose": "LOCAL_RESEARCH_ONLY_UNCALIBRATED_CLASSIFIER",
        "caveat": info["note"],
        "downstream_approval": False,
    }
    (path / "tis-model-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--language", choices=["en", "ar"], required=True)
    parser.add_argument("--destination", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(provision(args.language, args.destination), indent=2))


if __name__ == "__main__":
    main()
