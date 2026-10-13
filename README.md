# Text Integrity Studio
A free, privacy-first **Arabic/English** text inspection and writing-review studio, designed for GitHub Pages.

**Try the site:** https://bimspecialist.github.io/Text-Integrity-Studio/

## Measured independent-source model evaluation — 13 October 2026

**Important: experimental AI model scores are not accurate authorship probabilities.** An additional real ONNX evaluation against a separately published 2026 corpus recorded **104 documents**: 64 publicly human-labeled pre-ChatGPT academic/Wikipedia passages and 40 AI-labeled outputs from five 2026 generator families. The frozen raw >=80 AI-signal cutoff falsely flagged **5/64 human texts (7.8%)**, with a **17.0% 95% Wilson upper false-alert bound**, and caught **29/40 AI texts (72.5%)**. AUROC was **0.925** on this limited distribution (not 92.5% accuracy). Some recent generator types were poorly detected, and the dataset publisher is another detection vendor, so labels are documented source claims rather than independently audited truth.

[Full source-controlled external 2026 evaluation, domain and generator comparisons, and replication steps](backend/research/EXTERNAL_2026_EVALUATION.md) · [Real GitHub Actions run](https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/38352220247).

**Release remains RESEARCH ONLY.** The user's raw score is an uncalibrated diagnostic, not the percentage written by AI. The optional full-document scan and cross-model disagreement safeguards improve honesty and representativeness, not certified classifier accuracy. Do not use the model for misconduct allegations.

## Advanced model-evidence update — October 2026

After user reports of large differences against other AI detectors, the browser engine was investigated rather than tuned to copy another site's number. Real benchmark evidence found **13/24 public HC3 human-labeled texts triggered an >=80% TMR AI-class signal**, a 54.2% observed false alert at that cutoff on a small weak-label sample (Wilson 95% upper bound 72.1%; Brier 0.3009; ECE 0.3461). **Do not interpret the raw model percentage as an authorship probability.** [Measured audit](backend/research/AI_DETECTOR_VALIDATION.md) · [GitHub Action](https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/38253905498).

The research-only engine now enforces true tokenizer windows of <=448 tokens instead of silently truncating long passages, stratifies sampled sections, measures exact document coverage, and displays raw passage variability. An explicitly opt-in **Deep analysis** option downloads a second OpenAI GPT-2-era MIT-licensed RoBERTa detector. If the two models disagree strongly or sample coverage is too low, **no combined number** is shown; individual raw diagnostics remain inspectable. The second model is a historical sanity check, *not* a validated universal detector. English only, >=120 words. User documents are not intentionally uploaded for inference; model downloads use external Hugging Face/CDN endpoints after opt-in.

Research evaluation and weak-label calibration code lives under [backend/research](backend/research). The publicly deployed website does **not** install its unapproved calibration weights, does not claim certification, and does not promise matching another commercial AI detector.

## More representative document review (October 13, 2026)

The experimental English-only AI model can now optionally inspect **up to 96 tokenizer-bounded windows** instead of sampling just 12, from the existing **Deep analysis options → Check more of long documents** checkbox. It can be cancelled safely. The overall percentage is **withheld**, with detailed raw model/window evidence available, when **less than 60%** of a file was sampled or its window signals strongly contradict each other. This prevents confident-looking averages that fail to represent a whole Word/PDF document. It does **not** validate or certify AI authorship accuracy. The public HC3 pilot's 13/24 human false alerts remain a prominent warning and the release remains **RESEARCH ONLY**.

## Simple interface, all existing tools

The public browser app now follows **Add file or text → Check → Review & save**. One upload accepts TXT/MD/CSV/JSON, Word DOCX and PDF. The default view shows one primary check button and a short result; the remaining tools are retained behind accessible expandable sections: **grammar and writing suggestions, safe/thorough Unicode cleanup, tracked Word revisions/format-preserving export, PDF extraction and Arabic/English offline OCR, detailed security findings/reports, and optional experimental local-model research**. All Arabic/English labels work in RTL/LTR, with results appearing immediately after input on mobile. Expand only the tool you need.

**Deployment boundary:** The public GitHub Pages UI remains fully local with no backend keys. The separate authenticated Next.js/FastAPI AI-evidence interface is likewise simplified, but **requires a running private server and verified login** and continues to return INCONCLUSIVE rather than fake AI-origin percentages.

### Public-site design correction + opt-in browser AI signal (October 2026)

The earlier visual shown in chat was an **illustrative stock reference, not a screenshot of this website**. The actual [GitHub Pages UI](https://bimspecialist.github.io/Text-Integrity-Studio/) has now been redesigned as a dark navy document workspace with a navigation rail, editor, right-side results, and a visible experimental AI indicator.

For *English only*, the optional **onnx-community/tmr-ai-text-detector-ONNX** model (MIT, RoBERTa-base fine-tuned for AI-vs-human classification on RAID) can be downloaded and run **inside the browser** through Transformers.js after the user explicitly clicks the button. Approximate quantized model download size is 126 MB, plus runtime code. Eligible English text requires >=120 words. The current engine uses the model's AI-class signal over up to twelve genuine-token-bounded document windows and reports sampling coverage and segment variation; optional second-model scores are shown separately, not averaged into a fabricated probability. It is displayed as **EXPERIMENTAL / NOT INDEPENDENTLY CALIBRATED**, NOT a verified probability or fraction of AI-authored words. **Arabic, mixed scripts, very short documents, or failed network/model loads yield no percentage rather than a guessed number.** No remote inference API is called by the application, but the optional third-party code/weights downloads introduce security and connection-metadata considerations, disclosed in [privacy.html](docs/privacy.html).

The existing separately deployable FastAPI/Node hybrid backend continues to require proper independent validation before it exposes *calibrated* authorship risk percentages. The optional public browser classifier is deliberately a separate research-only UI path and does not silently override backend release approval.

### New public-data baseline, secure uploads and authenticated React interface

The complete [integration and local deployment guide](backend/INTEGRATION_GUIDE.md) explains the public HC3 English calibration experiment, blocked Arabic DPO minimum-word validation, opt-in RoBERTa/AraBERT provisioning, the FastAPI multipart PDF/DOCX/TXT parser, [full authenticated Next.js UI](backend/examples/next-ui/README.md), and [Express proxy](backend/examples/express-authenticated-proxy.js).

The actual English baseline produced unapproved research weights and a measured held-out diagnostic—not verified AI authorship percentages. The [baseline run record](backend/datasets/BASELINE_RUN_2026-10-12.md) includes the achieved false-positive confidence interval and missing validation gates. GitHub Pages cannot host the new Node/FastAPI service. No verified model or public backend is deployed.

### Optional hybrid detection service (backend source, not hosted)

The new [FastAPI hybrid detector](backend/README.md) implements Arabic/English segmentation, genuine optional language-model perplexity and burstiness, embedding coherence, stylometry and supervised n-gram analysis, local Hugging Face/approved provider adapters, independent calibration and segment-level UI response mapping. See [Node.js integration](backend/examples/node-express-route.js) and [FastAPI mounting](backend/examples/fastapi-mount.py).

**Safety:** The GitHub Pages app remains separate and has no server API secret. No pretrained, independently validated detector is deployed; the backend returns INCONCLUSIVE and null percentages until real licensed evaluation data, held-out false-positive/fairness tests, model provenance review and a signed-off artifact pass the release gates. Source code and passing synthetic tests are not proof of real-world detection accuracy.

### Research and development deliverables
- [Executive research report — October 2026](research/EXECUTIVE_RESEARCH_2026.md): scholarly sources, practical methods, vendor limitations, ethics, privacy, architecture and budgets.
- [Development roadmap](ROADMAP.md): phased work packages, owners, acceptance gates, risks and estimated resources.
- [Detector evaluation framework](evaluation/README.md) and [Python metric evaluator](evaluation/score_detector.py): transparent false-positive rates, confidence intervals, stratification and uncertainty.
- [Working browser prototype](docs/index.html) with [Writing Lab](docs/writing-lab.js), [bilingual rules](docs/writing-rules.js), and [Word DOCX tooling](docs/word-docx.js).

**Scope:** No independently validated AI-authorship detector is bundled. An optional **user-supplied, experimental local model** can display an explicitly unverified signal and abstain on short/out-of-domain text; this is never a verified percentage of AI-written words or proof of authorship. The main product provides document integrity checks, PDF/Word inspection, and review-first grammar suggestions. It never introduces deliberate errors or promises detector evasion.

**Updated Word editor:** Writing Lab suggestions for simple document-body paragraphs can now be selected for **Word DOCX export with Track Changes** (on by default), or exported as clean revisions. Complex fields, hyperlinks, marked-up paragraphs, notes/comments, drawings and style-heavy structures remain untouched. Word may retain or simplify formatting inside replaced text across differently styled runs: review tracked edits in Microsoft Word before final use.


## PDF + scanned-page OCR — available on the website

1. Open [Text Integrity Studio](https://bimspecialist.github.io/Text-Integrity-Studio/).
2. Choose a PDF up to **24 MB**. The site uses bundled, current PDF.js to extract text locally (first 80 pages maximum).
3. For scanned/image-only pages, select a range up to **12 pages** and choose English, Arabic, or both. Click **Run OCR**. Bundled Tesseract language files and WASM run in the browser; no remote model service is contacted.
4. Review source order, mathematical notation and Arabic OCR, then export TXT or edit the extracted text in Writing Lab. The original PDF is never overwritten.

If you need more than 80 pages or deeper offline workflows, see the [Python local companion](tools/README.md) with optional pypdf/pypdfium2/pytesseract and Ollama proofreading.

## Word DOCX — available now

To inspect a Word file **without Python**:

1. Open the app (`docs/index.html` locally or via GitHub Pages after enabling it).
2. Click **Choose Word document (.docx)** and select a Word DOCX file (up to 18 MB).
3. Review **Unicode**, **Writing quality**, **Security**, and the **Word document inspection** report.
4. In **Writing improvement lab**, select individual, meaning-preserving suggestions. The default is **no editorial changes selected** for Word.
5. Keep **Track editorial changes in Word** checked if you want Microsoft Word to show suggested insertions/deletions for review.
6. Click **Preview Word cleanup** and **Download cleaned Word (.docx)**. The original file remains untouched.
7. An optional checkbox clears text from Word runs explicitly marked hidden (`w:vanish`, `w:webHidden`, `w:specVanish`). This is OFF by default and requires extra confirmation.

**Preservation:** Rewrites affected text runs in OOXML and repacks the existing DOCX archive, retaining the rest of the document package, including images, sections, tables and styles. Extremely complex Word files must be checked in Word after export. Scanned pages, password-protected files and legacy `.doc` are not supported. For an old `.doc` use Word → Save As → `.docx`.

**Safety:** Checks archive entry count, uncompressed size, unusually high compression ratios and XML part size before decompressing XML. JavaScript and JSZip are included locally; the document is never uploaded to the site. No Office macros are executed.

**Scope:** Detects suspicious Unicode, directly-hidden text runs, tracked changes and probable watermark shapes by identifier. It does **not** remove pictures, visible graphic watermarks, metadata, comment history, tracked changes, inherited hidden styles or statistical AI watermarks. AI-writing percentage is not available here. Word's built-in signature validation may fail if an already signed document is modified.

**Testing:** `tests/word-docx.test.js` and `.github/workflows/quality.yml` provide an automated ZIP roundtrip + safety regression test.

## New engineering and research tools
- [Optional browser research signal](docs/experimental-signal.js) accepts only user-provided numerical TF-IDF model exports from [local training](evaluation/train_baseline.py). No supervised model weights are supplied, and results are never certified AI-origin percentages.
- [Optional fully local Python companion](tools/README.md): PDF OCR, Ollama-reviewed writing proposals, high-risk number/citation change flags, and loopback-only token-protected API (not cloud-hosted).
- [Bilingual quickstart](docs/help.html) and [user privacy statement](docs/privacy.html).

- [Local baseline AI detector training pipeline](evaluation/train_baseline.py) with [optional, pinned model dependencies](evaluation/requirements-model.txt). Requires user-provided, independently labeled and authorized train/validation/test data. No pretrained production AI detector is deployed.
- [Offline A/B writing evaluation](evaluation/ab_editor.py) measures reviewed completion and meaning-error risks without uploading any drafts.
- [Security review and risk register](SECURITY.md), [bilingual privacy disclosure](docs/privacy.html), and a same-origin-only CSP permitting local OCR/WASM assets.
- CI tests verify style-preserving Word revisions, extracted PDF text, image-only PDF OCR, optional research signal abstention, protected spans, ZIP safety, privacy, local API authentication, evaluation metrics, and dataset leakage.

## Open the web app
After Pages is enabled, the static site is served from `/docs/index.html`.

## Features
- Review-first DOCX editorial suggestions with Word Track Changes for eligible main-body paragraphs, preserving source document files.
- Bilingual writing improvement lab: selectable spelling, grammar, punctuation, formatting and clarity edits with preview, undo and TXT export.
- Detailed audit of invisible and unusual Unicode characters, with count, code point and review category.
- Safe versus thorough cleanup, preview before applying, TXT download, clipboard copy.
- Bidirectional markers and mixed-script look-alikes flagged for manual review rather than blindly removed.
- Writing-quality review: unusually long sentences, adjacent repeated English words, repeated spaces, trailing whitespace.
- Security review: direction overrides, replacement characters and mixed-script lookalikes.
- JSON and Markdown report export, editing undo/redo, basic TXT/MD/CSV/JSON file import and drag-and-drop.
- Responsive dark UI and Arabic RTL / English LTR language switch.
- Runs in the browser: no server text upload, accounts, API calls or analytics.

## Limitations
- **Research-only AI scores** require an independently trained user-supplied JSON model export. The code does not contain a pre-validated model or license to publish trained weights; it abstains for short/unsupported input and still may be wrong on eligible samples.
- **Local Ollama proofreading** is an optional Python integration, not a free hosted AI service and not part of GitHub Pages. The local model can change facts; review numerical/citation warnings and the unified diff.

- This web edition **does not provide an AI-authorship percentage**. No trustworthy calibrated AI-writing percentage can be derived from superficial text characteristics, and no such value is invented.
- Zero-width characters are not proof of AI generation or watermarking. No guarantee is made about statistical or metadata watermarks.
- Thorough cleaning can affect Arabic directionality, shaping, complex scripts and emoji sequences; review before applying.
- Writing-quality checks are simple heuristics, not full grammar checking. DOCX is supported up to 18 MB, and plain UTF-8 TXT/MD/CSV/JSON up to 3MB. PDF extraction is available for up to 24 MB and 80 pages; optional OCR runs on up to 12 selected scanned pages at a time. PDF edits export as TXT rather than a modified PDF.
- Changes in the app are in-memory, not saved between visits.

## Publish with GitHub Pages
1. Go to **Settings → Pages** for this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select `main` and `/docs` and click **Save**.
4. GitHub Pages will provide a published URL.

## Optional Python companion
The earlier Python/Streamlit prototype can optionally be developed as a separate companion for DOCX cleaning, proofreading services and experimental local AI classification. Do not equate its classifier output with proven AI authorship.
