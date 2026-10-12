# Text Integrity Studio
A free, privacy-first **Arabic/English** text inspection and writing-review studio, designed for GitHub Pages.

**Try the site:** https://bimspecialist.github.io/Text-Integrity-Studio/

### Research and development deliverables
- [Executive research report — October 2026](research/EXECUTIVE_RESEARCH_2026.md): scholarly sources, practical methods, vendor limitations, ethics, privacy, architecture and budgets.
- [Development roadmap](ROADMAP.md): phased work packages, owners, acceptance gates, risks and estimated resources.
- [Detector evaluation framework](evaluation/README.md) and [Python metric evaluator](evaluation/score_detector.py): transparent false-positive rates, confidence intervals, stratification and uncertainty.
- [Working browser prototype](docs/index.html) with [Writing Lab](docs/writing-lab.js), [bilingual rules](docs/writing-rules.js), and [Word DOCX tooling](docs/word-docx.js).

**Scope:** This site **does not currently detect whether text was written by AI**. It provides document integrity scans and human-reviewed style/grammar suggestions, and intentionally displays no invented AI-authorship percentage. It never generates deliberate “human errors” or promises detector evasion.

**Updated Word editor:** Writing Lab suggestions for simple document-body paragraphs can now be selected for **Word DOCX export with Track Changes** (on by default), or exported as clean revisions. Complex fields, hyperlinks, marked-up paragraphs, notes/comments, drawings and style-heavy structures remain untouched. Word may retain or simplify formatting inside replaced text across differently styled runs: review tracked edits in Microsoft Word before final use.


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
- [Local baseline AI detector training pipeline](evaluation/train_baseline.py) with [optional, pinned model dependencies](evaluation/requirements-model.txt). Requires user-provided, independently labeled and authorized train/validation/test data. No pretrained production AI detector is deployed.
- [Offline A/B writing evaluation](evaluation/ab_editor.py) measures reviewed completion and meaning-error risks without uploading any drafts.
- [Security review and risk register](SECURITY.md), [bilingual privacy disclosure](docs/privacy.html), and no-network browser CSP.
- CI tests verify style-preserving Word revisions, browser export, protected spans, ZIP safety, dataset leakage, evaluation metrics, and privacy baseline.

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
- This web edition **does not provide an AI-authorship percentage**. No trustworthy calibrated AI-writing percentage can be derived from superficial text characteristics, and no such value is invented.
- Zero-width characters are not proof of AI generation or watermarking. No guarantee is made about statistical or metadata watermarks.
- Thorough cleaning can affect Arabic directionality, shaping, complex scripts and emoji sequences; review before applying.
- Writing-quality checks are simple heuristics, not full grammar checking. DOCX is supported up to 18 MB, and plain UTF-8 TXT/MD/CSV/JSON up to 3MB. PDF extraction is not available in the website.
- Changes in the app are in-memory, not saved between visits.

## Publish with GitHub Pages
1. Go to **Settings → Pages** for this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select `main` and `/docs` and click **Save**.
4. GitHub Pages will provide a published URL.

## Optional Python companion
The earlier Python/Streamlit prototype can optionally be developed as a separate companion for DOCX cleaning, proofreading services and experimental local AI classification. Do not equate its classifier output with proven AI authorship.
