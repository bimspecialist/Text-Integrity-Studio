# Text Integrity Studio: Real baseline + bilingual adapters + upload UI

**Implemented:** optional FastAPI binary upload endpoint, Node/Express and Next authenticated proxies, bilingual React result display, English/Arabic Hugging Face provisioning, a reproducible English research calibration run. **Not yet implemented:** independently verified human/AI training labels, an Arabic corpus passing the minimum-length gate, a hosted production inference server, and a complete production identity provider.

## 1. Install the local Python service

Use Python 3.12. From backend/:

    python -m venv .venv
    python -m pip install -r requirements.txt

Create independent 32+ character random secret(s) and set TIS_API_KEYS. Never commit actual keys. Run:

    python -m uvicorn hybrid_detector.serve:app --host 127.0.0.1 --port 8000 --no-access-log

The private authenticated routes are POST /v1/analyze (JSON text) and POST /v1/analyze-file (multipart file); GET /v1/health does not need a secret. Authenticated FastAPI file endpoint supports 6 MiB TXT/DOCX/PDF, 60 PDF pages, no executable macros, maximum 120k extracted characters; image-only scanned PDFs receive OCR_REQUIRED. PDF/DOCX may contain sensitive text; multipart servers may temporarily spool uploaded bytes to OS-managed temporary storage, which is deleted when the request is closed. The handler does not intentionally store source files in a persistent application database.

## 2. Download optional English / Arabic transformers

Use authorized Apache-2.0 HF checkpoints only. Weights are downloaded ONLY when you execute the following commands (hundreds of MB; CPU performance can be slow):

    python -m pip install -r requirements-ml.txt
    python -m pip install -r requirements-research.txt
    python -m hybrid_detector.provision_models --language en --destination /opt/tis/models/en
    python -m hybrid_detector.provision_models --language ar --destination /opt/tis/models/ar

For Windows PowerShell use e.g. C:\TIS\models\en and C:\TIS\models\ar as destinations. Exact expected environment:

    TIS_LOCAL_EN_CLASSIFIER_DIR=/opt/tis/models/en
    TIS_LOCAL_EN_AI_CLASS_INDEX=1
    TIS_LOCAL_AR_CLASSIFIER_DIR=/opt/tis/models/ar
    TIS_LOCAL_AR_AI_CLASS_INDEX=1

Optional true semantic/perplexity signals require independently selected and licensed trusted causal language and embedding checkpoints:

    TIS_LOCAL_CAUSAL_LM_DIR=/opt/tis/models/pinned-causal-lm
    TIS_LOCAL_EMBEDDINGS_DIR=/opt/tis/models/pinned-multilingual-embedder

A model only provides an **uncalibrated classifier logit**; it does not establish probability. Its AI class mapping is verified during provisioning. Do not copy Fakespot's English training distribution to Arabic, dialect text, formal essays or medical/legal decisions.

## 3. Public dataset research baseline

English HC3 question-paired human/ChatGPT claims, public CC-BY-SA source. Arabic Aya-SambaLingo Arabic DPO Apache-2.0 contains preference labels **not verified human authorship**. Corpus builder stores a frozen revision SHA and pairs by prompt to prevent source leakage between splits.

    python -m pip install -r requirements-research.txt
    python -m hybrid_detector.baseline_data --source hc3_en --out /private/research --limit 800
    python -m hybrid_detector.train --dataset /private/research/hc3_en.jsonl --output /private/research/weights --language en --domain general --unit document --version research-en-v1

Real CI run: https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/38237478229
English trained successfully, preliminary weights saved as a short-lived GitHub Actions artifact. Arabic job refused to train (not enough >=75-word paired responses). See datasets/BASELINE_RUN_2026-10-12.md for exact test measurements.

**Production percentages stay disabled:** The English holdout had 107+107 samples, 95% Wilson upper FPR 3.47%, missing full indicator coverage and independent label review. It does **not** satisfy production gates. Do not enable TIS_ENABLE_APPROVED_SCORES or file a false approval manifest.

An Arabic dataset of original human scholarly abstracts and multiple LLM outputs exists at KFUPM-JRCAI/arabic-generated-abstracts (22.4 MB), but an explicit dataset license was not confirmed in its metadata. Do not import or distribute this data as an open-source calibration corpus without licensing clearance. An explicitly MIT-tagged DetectRL-X multilingual set is much larger (approximately 31 GB binary), not a default lightweight build.

## 4. Run the React frontend privately

From backend/examples/next-ui:

    npm install
    # Copy .env.example to .env.local and set TIS_PUBLIC_ORIGIN,
    # TIS_API_KEY (the FastAPI key), TIS_SESSION_JWT_SECRET,
    # TIS_LOCAL_DEV_SETUP_KEY (a third independent random secret).
    npm run dev

Open http://localhost:3000/dev and enter the local developer setup key for a 30-minute signed test cookie, then open http://localhost:3000 to analyze documents. Development login is HARD-DISABLED when NODE_ENV is production. Real deployment requires a true identity provider issuing matching cookies—this example does not create user accounts. Static GitHub Pages cannot host this Node/FastAPI authenticated service.

Alternatively, mount backend/examples/express-authenticated-proxy.js in an existing authenticated Express app (with express, multer and jose). Browser sessions and upstream API secrets must never be interchangeable.

## 5. JSON and result semantics

- POST JSON to /v1/analyze; POST multipart to /v1/analyze-file. Form field return_extracted_text is false by default, and the protected Next upload route opts in so its highlights match the returned parsed text.
- Document/paragraph/sentence results contain bounded original-code-point offsets, available feature metrics, reasons, and optional validated percentages.
- INCONCLUSIVE / null / UNASSESSED / gray is correct for missing calibration, unsupported language, short text or false-positive safety gates.
- Red HIGH_AI_SIGNAL, yellow UNCERTAIN_MIXED, and green LOW_AI_SIGNAL appear **only for separately validated segment models**. Low signal never proves human writing.

## 6. Verification

GitHub Actions:
- hybrid-backend.yml: Python unit/HTTP parsing and security checks.
- next-integration.yml: Next TypeScript and build.
- next-e2e.yml: real local Next developer JWT + FastAPI JSON/TXT upload end-to-end smoke.
- baseline-research.yml: **manual** research-run workflow; English empirical weak-label baseline above; Arabic DPO blocked by 75-word threshold.

Before an actual public product launch, secure licensed and independently labeled corpora, external FPR/calibration audits with Arabic Gulf and non-native English, real production identity/SSL, service monitoring, data/privacy handling and deployment cost budget. Passing unit tests does not imply verified authorship probability.
