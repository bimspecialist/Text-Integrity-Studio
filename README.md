# Text Integrity Studio
A free, privacy-first **Arabic/English** text inspection studio, designed for GitHub Pages.

## Open the web app
After Pages is enabled, the static site is served from `/docs/index.html`.

## Features
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
- Writing-quality checks are simple heuristics, not full grammar checking. File upload is limited to UTF-8 TXT/MD/CSV/JSON up to 3MB. DOCX and PDF extraction are *not* yet part of the website.
- Changes in the app are in-memory, not saved between visits.

## Publish with GitHub Pages
1. Go to **Settings → Pages** for this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select `main` and `/docs` and click **Save**.
4. GitHub Pages will provide a published URL.

## Optional Python companion
The earlier Python/Streamlit prototype can optionally be developed as a separate companion for DOCX cleaning, proofreading services and experimental local AI classification. Do not equate its classifier output with proven AI authorship.
