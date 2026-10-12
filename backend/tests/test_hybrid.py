import copy
import hashlib
import json
import math
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from hybrid_detector.api import APISettings, create_app
from hybrid_detector.artifacts import ARTIFACT_FORMAT, validate, load_artifact
from hybrid_detector.engine import HybridEngine
from hybrid_detector.features import FEATURE_NAMES, VERSION, Extractor, profile_from_corpora
from hybrid_detector.text import detect_language, tokenize, paragraphs, sentences, variation


class FakeLM:
    def mean_nll(self, samples):
        return [2.1 + (i % 3) * 0.3 for i in range(len(samples))]


class FakeEmbedding:
    def encode(self, samples):
        return [[1.0, 0.1 * (i % 4)] for i in range(len(samples))]


class FakeClassifier:
    def logit(self, text):
        return 0.8


def reference():
    return profile_from_corpora(
        ["Students explained field measurements to the examiner. " * 15],
        ["The generated summary listed the process results repeatedly. " * 15],
    )


def artifact(unit="document", lang="en", approved=True):
    n = len(FEATURE_NAMES)
    return {
        "format": ARTIFACT_FORMAT,
        "feature_version": VERSION,
        "features": list(FEATURE_NAMES),
        "version": "synthetic-fixture-test-only",
        "unit": unit,
        "eligibility": {
            "languages": [lang], "domains": ["general"], "contexts": ["general", "formal", "non_native", "academic"],
            "min_words": 180 if unit == "document" else 75,
        },
        "predictor": {
            "center": [0.0] * n, "scale": [1.0] * n, "weights": [0.0] * (2 * n),
            "intercept": 0.0, "calibration": {"coef": 1.0, "intercept": 0.0},
        },
        "thresholds": {"low": 0.1, "high": 0.9},
        "ngram_reference": reference(),
        "validation": {
            "human_test_n": 1000 if approved else 9, "ai_test_n": 1000 if approved else 9,
            "fpr_wilson_upper_95": 0.005 if approved else 0.8, "brier": 0.12, "ece": 0.03,
            "coverage": 0.98, "tpr_at_high_alert_threshold": 0.8 if approved else 0.1,
            "independent_label_verification_passed": approved,
            "held_out_model_families_checked": approved, "group_audits_passed": approved,
        },
        "governance": {
            "provenance_reviewed": approved, "release_approved": approved,
            "approval_ref": "FAKE_UNIT_TEST_NOT_A_REAL_DATASET" if approved else None,
        },
    }


def long_en(n=70):
    return (("This controlled experiment reports how students examined water pressure, compared documented values, and discussed engineering observations. "
             "The result was reviewed. "
             "In this detailed analysis, the instructors also checked different instrument readings and explained why supporting references should be retained. ") * n)


def test_language_offsets_and_normalization():
    source = "  Hello world.  \n\n مرحبا بالعالم؟ \n\nMeasurements at 100 kPa."
    parts = paragraphs(source)
    assert len(parts) == 3
    assert all(source[p.start:p.end] == p.text for p in parts)
    assert detect_language("هٰذا القياس بالعربية") == "ar"
    assert detect_language("this is English prose") == "en"
    assert detect_language("يشرح author النتائج") == "mixed"
    assert len(tokenize("الأعمدة تحتوي على 350 kPa، والأساسات موجودة.")) >= 6
    assert len(sentences("A normal example. Next sentence? ونص ثالث؟")) == 3
    assert variation([3, 3]) is None
    assert variation([1, 2, 3]) is not None


def test_ngram_profiles_are_supervised_not_probability():
    prof = reference()
    features = Extractor(ngram_reference=prof).extract(long_en(6))
    assert features.values["ngram_coverage"] is not None
    assert features.values["ngram_log_likelihood_ratio"] is not None
    assert features.values["lm_mean_surprisal"] is None
    assert "lm_mean_surprisal" in features.missing
    assert 0 <= features.values["lexical_diversity"] <= 1


def test_missing_artifact_and_short_input_abstain():
    engine = HybridEngine()
    for input_text in ("Brief note.", long_en()):
        response = engine.analyze(input_text)
        assert response["analysis_status"] == "INCONCLUSIVE"
        assert response["document"]["ai_probability_percent"] is None
        assert response["document"]["tier"] == "UNASSESSED"
        assert all(s["ai_probability_percent"] is None for s in response["segments"])


def test_unsupported_domain_and_non_native_are_never_forced_to_ai():
    with tempfile.TemporaryDirectory() as temp:
        engine = HybridEngine(artifact_directory=temp, allow_calibrated_results=True,
                              language_model=FakeLM(), embeddings=FakeEmbedding(), transformer=FakeClassifier())
        assert engine.analyze(long_en(), domain="academic")["document"]["ai_probability_percent"] is None
        assert engine.analyze(long_en(), writing_context="non_native")["document"]["ai_probability_percent"] is None


def test_synthetic_artifact_fixture_can_exercise_scoring_math_without_claiming_real_validation():
    with tempfile.TemporaryDirectory() as d:
        base = Path(d)
        data = artifact()
        path = base / "document.en.json"
        contents = json.dumps(data).encode()
        path.write_bytes(contents)
        (base / "document.en.approval.json").write_text(json.dumps({
            "artifact_sha256": hashlib.sha256(contents).hexdigest(),
            "version": data["version"],
        }))
        engine = HybridEngine(
            artifact_directory=base, allow_calibrated_results=True,
            language_model=FakeLM(), embeddings=FakeEmbedding(), transformer=FakeClassifier(),
        )
        result = engine.analyze(long_en())
        assert result["document"]["status"] == "CALIBRATED_ESTIMATE"
        assert result["document"]["ai_probability_percent"] == 50.0
        assert result["document"]["tier"] == "UNCERTAIN_MIXED"
        assert result["document"]["color"] == "yellow"
        assert result["document"]["confidence_level"] in ("HIGH", "MEDIUM")
        assert result["segments"][0]["ai_probability_percent"] is None
        assert not result["privacy"]["raw_text_returned"]


def test_independent_segment_calibrator_controls_ui_tiers_not_document_score():
    with tempfile.TemporaryDirectory() as d:
        folder = Path(d)
        for intercept, expected in ((6.0, ("HIGH_AI_SIGNAL", "red")), (-6.0, ("LOW_AI_SIGNAL", "green"))):
            data = artifact(unit="paragraph")
            data["predictor"]["intercept"] = intercept
            encoded = json.dumps(data).encode()
            target = folder / "paragraph.en.json"
            target.write_bytes(encoded)
            (folder / "paragraph.en.approval.json").write_text(json.dumps({
                "artifact_sha256": hashlib.sha256(encoded).hexdigest(), "version": data["version"],
            }))
            engine = HybridEngine(artifact_directory=folder, allow_calibrated_results=True,
                                  language_model=FakeLM(), embeddings=FakeEmbedding(),
                                  transformer=FakeClassifier())
            result = engine.analyze(long_en(10))
            assert result["document"]["ai_probability_percent"] is None
            assert result["segments"][0]["tier"] == expected[0]
            assert result["segments"][0]["color"] == expected[1]
            assert result["segments"][0]["ai_probability_percent"] is not None
            assert result["segments"][0]["start"] == 0
            assert result["segments"][0]["end"] == len(long_en(10).rstrip())


def test_no_approval_manifest_refuses_approved_artifact():
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / "document.en.json").write_text(json.dumps(artifact()))
        with pytest.raises(ValueError, match="integrity manifest"):
            load_artifact(d, "document", "en")


def test_invalid_artifact_rejected():
    a = artifact()
    a["predictor"]["weights"] = [1.0]
    with pytest.raises(ValueError):
        validate(a)
    a = artifact()
    a["predictor"]["center"][0] = math.inf
    with pytest.raises(ValueError):
        validate(a)


def test_api_requires_secret_and_private_auth_and_rate_limits():
    with pytest.raises(RuntimeError, match="32-character"):
        create_app(APISettings(api_keys=("weak",)))
    app = create_app(APISettings(api_keys=("p" * 40,), requests_per_minute=2), engine=HybridEngine())
    client = TestClient(app)
    assert client.post("/v1/analyze", json={"text": long_en()}).status_code == 401
    assert client.get("/v1/health").status_code == 200
    head = {"X-API-Key": "p" * 40}
    good = client.post("/v1/analyze", headers=head, json={"text": long_en()})
    assert good.status_code == 200
    assert good.json()["analysis_status"] == "INCONCLUSIVE"
    assert "text" not in good.json()
    small = client.post("/v1/analyze", headers=head, json={"text": "Short"})
    assert small.status_code == 200
    exhausted = client.post("/v1/analyze", headers=head, json={"text": "Again"})
    assert exhausted.status_code == 429


def test_api_validation_and_payload_limits():
    client = TestClient(create_app(APISettings(api_keys=("a" * 40,), requests_per_minute=20), engine=HybridEngine()))
    key = {"X-API-Key": "a" * 40}
    assert client.post("/v1/analyze", headers=key, json={"text": "hello", "extra": "secret"}).status_code == 422
    assert client.post("/v1/analyze", headers=key, json={"text": "x" * 140000}).status_code == 413
    assert client.post("/v1/analyze", headers=key, json={"text": "", "language": "ar"}).status_code == 422
    reply = client.post("/v1/analyze", headers=key, json={"text": "A large text in English. " * 25, "language": "ar"})
    assert reply.status_code == 422
    assert "A large text" not in reply.text
