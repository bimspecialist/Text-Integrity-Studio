"""Full synthetic software pipeline; no results here demonstrate actual AI detection."""
import json
from pathlib import Path

import pytest

from hybrid_detector.artifacts import validate
from hybrid_detector.train import fit, read_dataset, wilson, ece
from hybrid_detector.approve import approve


def make_rows():
    rows = []
    for split in ("train", "calibration", "test"):
        for label in ("human", "ai"):
            for i in range(30):
                segment = (
                    "The engineer measured the pressure on site, talked to colleagues, "
                    "and recorded original calculations during the afternoon. "
                    if label == "human" else
                    "This generated summary describes the standard workflow and repeats "
                    "a generic template of recommended operational steps. "
                )
                content = (segment * 11) + f" Documentation item number {i} in {split}."
                rows.append({
                    "id": f"{split}-{label}-{i}",
                    "text": content,
                    "label": label, "split": split, "language": "en", "domain": "general",
                    "unit": "document", "writing_context": "general",
                    "author_group": f"author-{split}-{label}-{i}",
                    "source_group": f"topic-{split}-{label}-{i}",
                    "model_family": ("generator-holdout" if split == "test" else "generator-training") if label == "ai" else "",
                })
    return rows


def test_frozen_splits_and_training_coefficients(tmp_path, monkeypatch):
    monkeypatch.delenv("TIS_LOCAL_CAUSAL_LM_DIR", raising=False)
    monkeypatch.delenv("TIS_LOCAL_EMBEDDINGS_DIR", raising=False)
    monkeypatch.delenv("TIS_LOCAL_CLASSIFIER_DIR", raising=False)
    path = tmp_path / "synthetic.jsonl"
    path.write_text("\n".join(json.dumps(row) for row in make_rows()), encoding="utf-8")
    folds = read_dataset(path, "en", "general", "document")
    model = fit(folds, language="en", domain="general", unit="document", version="fixture-only")
    parsed = validate(model)
    ready, reasons = parsed.readiness()
    assert ready is False
    assert reasons
    assert model["validation"]["human_test_n"] == 30
    assert model["validation"]["ai_test_n"] == 30
    assert model["validation"]["held_out_model_families_checked"] is True
    assert model["validation"]["coverage"] < 0.9  # no LM/semantic/transformer configured
    assert model["governance"]["release_approved"] is False
    assert parsed.score({k: 0.0 for k in model["features"]}) >= 0
    out = tmp_path / "document.en.json"
    out.write_text(json.dumps(model))
    review = tmp_path / "review.json"
    review.write_text(json.dumps({
        "reviewed_by": "synthetic-validator", "approval_ref": "NOT-REAL",
        "dataset_licenses_checked": True, "label_provenance_checked": True,
        "heldout_test_was_untouched": True, "subgroup_appeals_process": True,
    }))
    with pytest.raises(ValueError, match="validation gates"):
        approve(out, review)
    assert json.loads(out.read_text())["governance"]["release_approved"] is False


def test_prevent_cross_split_data_leakage(tmp_path):
    data = make_rows()
    data[100]["source_group"] = data[0]["source_group"]
    path = tmp_path / "bad-splits.jsonl"
    path.write_text("\n".join(json.dumps(row) for row in data), encoding="utf-8")
    with pytest.raises(ValueError, match="Group leakage"):
        read_dataset(path, "en", "general", "document")


def test_statistical_uncertainty_functions():
    assert wilson(0, 30) > 0.1
    assert wilson(0, 400) < 0.01
    assert ece([0, 1], [0, 1]) == 0
    assert ece([0, 1], [0.2, 0.2]) > 0
