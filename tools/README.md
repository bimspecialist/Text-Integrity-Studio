# Optional Local Companion — Free and Private

The website is usable without Python. This companion is for advanced PDF extraction, scanned-page OCR and local model-assisted proofreading when the user wants additional tools on their own computer. **No remote AI service, API key, paid subscription or cloud server is required.**

## Windows setup
1. Install Python 3.11 or newer and enable `python` / `py` on PATH.
2. Open a terminal in the repository's root folder.
3. Create a local virtual environment and install optional document packages:

   ```powershell
   py -3 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r tools\requirements-local.txt
   ```

4. For OCR, install a trusted desktop **Tesseract OCR** binary and enable the `eng` and `ara` trained languages. Confirm using `tesseract --list-langs`. Python's `pytesseract` wrapper is not the Tesseract binary; both are needed.
5. For AI-assisted proofreading, install [Ollama](https://ollama.com/) locally and obtain a model you are authorized to use, for example `ollama pull qwen2.5:7b`. The model may require several GB of disk/RAM and may run slowly on CPU-only laptops. No model is downloaded without your action.

## Commands

Extract ordinary PDF text and OCR scanned pages **locally**:

```powershell
.\.venv\Scripts\python.exe tools\local_companion.py pdf "report.pdf" --ocr auto --languages eng+ara
```

For a text PDF without OCR, use `--ocr never`. To scan every page use `--ocr always` cautiously; OCR is slower and may misread diagrams, formulas, references, or Arabic. Original PDF is unchanged.

Propose a rewritten text file using local Ollama (the output is a **draft that requires review**):

```powershell
.\.venv\Scripts\python.exe tools\local_companion.py proofread "report.extracted.txt" --model qwen2.5:7b --language ar
```

Files `report.extracted.review.txt` and `*.diff` are written as separate review artifacts; no Word document is overwritten. Validate meaning, project names, citations, numeric quantities and units. This tool is not designed to beat AI detectors, fabricate a human writing history, or insert deliberate errors.

Start a loopback-only, token-protected local API for CLI integrations:

```powershell
.\.venv\Scripts\python.exe tools\local_companion.py serve --port 8765 --model qwen2.5:7b
```

The terminal prints a one-time token. Send `Authorization: Bearer <token>` to `http://127.0.0.1:8765/v1/proofread` with a JSON `{"text":"...","language":"en"}` payload. The API is intentionally **not available to arbitrary websites**: it rejects cross-origin browser requests and binds only to 127.0.0.1.

`GET /health` reports local service status and **NOT VALIDATED** for AI classification.
`POST /v1/detector` returns **INCONCLUSIVE** (HTTP 503) until independent dataset and calibration gates are completed. Never invent an AI-authorship probability.

## Website features
[Text Integrity Studio](https://bimspecialist.github.io/Text-Integrity-Studio/) includes PDF text extraction and an in-browser Arabic/English OCR option using locally hosted assets. It can analyze DOCX and export tracked Word edits without running this companion.

## Privacy and failure notes
- Local Ollama requests are limited in code to `http://127.0.0.1:11434` with proxy bypass. A malicious text file is never treated as a command.
- Default local server blocks browser Origins and uses a random bearer token; it never logs bodies or saves submitted text.
- Local model outputs can still be inaccurate or omit critical engineering facts. Review every change.
- Word and PDF content may include sensitive data: never commit source texts, model exports, API tokens or outputs to your public GitHub repository.
- Python OCR packages may download code when you install them. Choose trusted official packages and review licenses.
- The website's PDF.js and Tesseract assets are bundled on GitHub Pages (one-time browser asset transfer from the site's origin), not third-party document APIs.
