# Text Integrity Studio — Hybrid Detection API

Status: **implemented backend source and automated tests; not an independently validated AI-authorship detector.** The existing project is a static GitHub Pages app, with a separate optional Python local companion. This module adds a new, separately deployable FastAPI service. No hosted server or vetted classifier weights have been provided.

A numerical AI model percentage is returned ONLY when a signed-off, independent, held-out-calibrated artifact exists for the requested language, writing context, domain and granularity; operational approval must also be enabled. Otherwise the API reports INCONCLUSIVE and a null score. No combination of perplexity, burstiness or style can establish authorship by itself. Model scores are **not percentages of words written by AI** and cannot independently justify an academic or workplace accusation.

## 1. Hybrid pipeline

Each request passes through authentication, rate/body/concurrency limits, offset-preserving bilingual segmentation, and indicator extraction:

1. Perplexity: exp(mean token negative log likelihood from a trusted, local causal LM). If no LM is configured, return null.
2. Burstiness: coefficient of variation of genuine per-sentence LM negative log likelihood; do not substitute variance of sentence lengths.
3. Semantic coherence: mean and variance of adjacent sentence embedding cosine similarities from a trusted, local sentence embedding model.
4. Stylometry and supervised character trigrams: lexical diversity, Shannon character entropy, sentence length variation, punctuation, Arabic diacritic/script counts, English/Arabic function word patterns, and smoothed human-vs-AI trigram log-likelihood ratio from a training-only corpus.
5. Optional transformer classifier: local Hugging Face AutoModelForSequenceClassification with verified AI class index; raw logit only. Optional vetted HTTPS classification adapters may implement the same logit(text) interface but must require content-owner consent and secure server-side credentials.

The meta-detector learns standardization, missing-indicator masks and a logistic coefficient for each feature using real labeled TRAIN data. A sigmoid calibrator is fitted only on a separate CALIBRATION split. The untouched TEST split establishes the operating false-positive rates, Brier score, expected calibration error, coverage and group safeguards.

All original text offsets are preserved. Arabic alef/tatweel/diacritic normalization is feature-only; source text is not rewritten.

## 2. Run locally

With Python 3.11+:

    cd backend
    python -m venv .venv
    # Activate your environment then:
    python -m pip install -r requirements.txt
    # Set TIS_API_KEYS in the private server environment, never client JavaScript.
    export TIS_API_KEYS="$(python -c 'import secrets;print(secrets.token_urlsafe(48))')"
    python -m uvicorn hybrid_detector.serve:app --host 127.0.0.1 --port 8000 --no-access-log

Windows PowerShell:

    $env:TIS_API_KEYS = & python -c "import secrets;print(secrets.token_urlsafe(48))"
    python -m uvicorn hybrid_detector.serve:app --host 127.0.0.1 --port 8000 --no-access-log

The service starts without transformer weights and without approved calibration. Health: GET /v1/health. Authenticated endpoint: POST /v1/analyze with X-API-Key header.

Example JSON:

    {
      "text": "Your own consented essay, report or paragraph...",
      "language": "auto",
      "domain": "general",
      "writing_context": "general",
      "segment_by": "paragraph",
      "include_segments": true
    }

Illustrative RESPONSE SHAPE (not measured data):

    {
      "analysis_status": "INCONCLUSIVE",
      "language": "en",
      "document": {
        "ai_probability_percent": null,
        "confidence_level": "LOW",
        "tier": "UNASSESSED",
        "color": "gray",
        "indicators": {
          "perplexity": null,
          "burstiness_nll_cv": null,
          "semantic_coherence_mean_cosine": null,
          "ngram_class_log_likelihood_ratio": null,
          "stylometry": {
            "lexical_diversity": null
          }
        }
      },
      "segments": [
        {
          "start": 0,
          "end": 18,
          "ai_probability_percent": null,
          "tier": "UNASSESSED",
          "color": "gray"
        }
      ]
    }

The actual API includes request IDs, detailed reasons, complete diagnostics, number of words, version data and segmentation coverage. The abbreviated example uses null placeholders, not invented statistical findings.

Responses: 401 invalid key, 413 oversized input, 422 unsupported/invalid input, 429 rate-limit, 503 busy service, 504 timeout. The API never echoes raw document text in error messages.

## 3. Language-specific train/calibration/test

Prepare independently licensed, verified JSONL records in a PRIVATE folder. Required per item: id, text, label (human or ai), split (train/calibration/test), language (en/ar/mixed), domain, author_group, source_group. Optional: unit (document/paragraph/sentence), writing_context (general/formal/non_native/academic), model_family. Use opaque IDs and documented rights/author provenance. An author or source/prompt group, including duplicate text, must not cross splits. Ensure unseen generator families and non-native human writing are held out for explicit generalization audits.

Install training dependencies and optionally ML dependencies for the SAME models used in serving:

    python -m pip install -r requirements-training.txt
    # Only if trusted local pretrained checkpoints are available:
    python -m pip install -r requirements-ml.txt
    export TIS_LOCAL_CAUSAL_LM_DIR=/opt/trusted-checkpoints/causal-lm
    export TIS_LOCAL_EMBEDDINGS_DIR=/opt/trusted-checkpoints/multilingual-encoder

Train a locale and scope:

    python -m hybrid_detector.train \
      --dataset /private/verified-corpus.jsonl \
      --output /private/tis-artifacts \
      --language ar --domain academic --unit document \
      --version ar-academic-v1

Training writes unapproved document.ar.json (or document.en.json, paragraph.ar.json, sentence.en.json, etc.). Document weights and calibration MUST NOT be reused for paragraph or sentence classifications. With no trained language model or semantic/transformer signal, signal-family coverage will be insufficient to approve production scoring.

Models are provided only from local trusted, pinned directories, never downloaded automatically by the server:
- TIS_LOCAL_CAUSAL_LM_DIR: pretrained causal LM.
- TIS_LOCAL_EMBEDDINGS_DIR: multilingual sentence embedding model.
- TIS_LOCAL_CLASSIFIER_DIR + TIS_LOCAL_AI_CLASS_INDEX=0|1: classifier binary head with independently verified mapping. Its raw scores are uncalibrated features until the supervised hybrid model is trained.

A real model's license, output-label semantics, training domain and reproducibility must be reviewed. The optional external wrapper in hybrid_detector/adapters.py is disabled unless explicitly instantiated by a server owner with approved public HTTPS hostname and server-only credentials.

## 4. Release safeguards and score confidence

A human release reviewer must attest dataset permissions, ground-truth labels, untouched test data, subgroup appeals, and an audit reference. A gate requires at least 400 verified-human and 400 AI-labeled examples on an independent TEST split per released model, 95% Wilson upper FPR bound <=1% at the frozen red-alert threshold, Brier <=0.20, 10-bin ECE <=0.10, >=90% feature-family coverage, held-out generator models and group auditing.

These are *project acceptance targets*, not measured achievements. Real-domain evaluation can still uncover failures after passing.

After review, use:

    python -m hybrid_detector.approve \
      --artifact /private/tis-artifacts/document.ar.json \
      --review /private/approval-review.json

Approval-review JSON must include reviewed_by, approval_ref, and boolean attestation fields dataset_licenses_checked, label_provenance_checked, heldout_test_was_untouched, subgroup_appeals_process. A fingerprint manifest is generated next to the reviewed artifact. Then explicitly set TIS_CALIBRATION_DIR and TIS_ENABLE_APPROVED_SCORES=true for a *private* controlled pilot; deploy only after additional security and evidence review.

The engine enforces a minimum calibrated word count, >=3 independent signal families, adequate within-text variation, applicability of locale/domain/writing context, and release readiness. It labels an operating-domain confidence HIGH/MEDIUM/LOW, which is **not the probability that the text was authored by AI**. Short, uniform, unsupported, missing-feature, or out-of-domain samples abstain.

For independently calibrated SEGMENT artifacts only: HIGH_AI_SIGNAL (red), UNCERTAIN_MIXED (yellow), LOW_AI_SIGNAL (green). Otherwise every paragraph/sentence is UNASSESSED (gray); red and green are never forced from a document-only score. The low-signal tier does not prove human authorship.

## 5. Node.js and FastAPI integration

- FastAPI host: backend/examples/fastapi-mount.py mounts the authenticated service as a sub-application under /detector.
- Node 22 / Express: backend/examples/node-express-route.js is a server-side session-protected proxy. It refuses anonymous traffic, caps payload size, and securely reads the upstream key from process.env.
- Render paragraph/sentence spans using backend/examples/render-markers.js and marker.css. The renderer uses text nodes (not unsanitized HTML) and exact offsets from the original text.

GitHub Pages is static and **cannot safely contain an unrestricted API key**. Use an authenticated server-side proxy; never add the backend key to docs/ JavaScript.

## 6. Privacy, operational limits and validation

- Raw user text is processed in memory and not persisted/logged by this service.
- The reference n-gram profiles themselves may reveal short substrings from training corpora; keep trained artifacts PRIVATE until licensing/privacy clearance.
- HTTP concurrency and single-process rate limits prevent unbounded local requests; multiple replicas require central quotas and an account/tenant authorization layer.
- The Dockerfile is non-root and ships the minimal service. Mount any approved artifacts/checkpoints read-only and inject secrets at runtime. A hosted production deployment has NOT been configured or verified.
- 120,000-character text, 135 KB JSON body, maximum 80 returned segment markers, LM sentence cap 64, and 30-second API wait timeout are enforced. Timeout does not forcibly stop CPU inference already running in its worker thread.
- Factual quality and provenance remain subject to human oversight. The API makes no authorship adjudications.
- Do not use estimates for student discipline, job decisions, or automatic sanctions. Provide documented appeals and human review.
- Operational runbook requirements: private TLS ingress, structured metrics without raw prompts, secret rotation, rate-limit monitoring, rollbacks, backups for **model artifacts only**, and bounded cloud costs.

Tests (synthetic software fixtures, NOT empirical detector performance):

    python -m pip install -r requirements-test.txt
    PYTHONPATH=. python -m pytest tests -q
    python -m compileall -q hybrid_detector

GitHub Actions: .github/workflows/hybrid-backend.yml. Use independent Arabic, Gulf dialect, non-native English and technical-document cohorts before any real-world score claims.

Primary references: https://scikit-learn.org/stable/modules/calibration.html ;
https://huggingface.co/docs/transformers/en/model_doc/auto ;
https://fastapi.tiangolo.com/reference/security/
