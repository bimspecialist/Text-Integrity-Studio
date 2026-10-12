# Changelog

## 2026-10-12 — Advanced document integrity and editorial review

### Added
- Export selected Writing Lab corrections back into **DOCX** using WordprocessingML `w:ins`/`w:del` tracked revisions (on by default). Clean revisions are also available when Track Changes is unchecked.
- Preserve source Word documents and existing media. Conservative paragraph eligibility prevents edits in hyperlinks, field runs, pre-existing tracked revisions, and complex structures.
- Review-first, opt-in DOCX changes; no automatic editorial changes are selected on file import. Grammar and punctuation suggestions are based on deterministic rules and are not a full proofreading model.
- Protected spans in writing rules for quoted text, numbered citations, engineering units, standards, links and code.
- Browser CSP: inline JavaScript and styles extracted to static first-party modules, `connect-src 'none'`; no external inference or document API.
- Security: reject DTD/entities in parsed OOXML text, reject macro-enabled ZIP packages, warn before modifying signed documents.
- User-facing Arabic/English privacy disclosures and security risk register.
- Optional offline detector training and calibration research pipeline; validated only as software scaffolding until licensed independently labeled corpora and evaluator reviews exist.
- Offline A/B editor workflow metric script; supports completion/meaning-error comparison per language without draft content.
- Regression tests for tracked DOCX revisions, browser roundtrip, narrow layouts, locale switches, mixed scripts, basic privacy and dataset split leaks.

### Preserved
- Original Word document is never overwritten; local Unicode forensics, safe/thorough mode, DOCX export and JSON/Markdown reports.
- Source text remains in browser memory; no automatic third-party upload, analytics or model calls.
- Source and release docs are maintained in GitHub.

### Known scope boundaries
- DOCX tracked edits support **simple eligible direct text runs in the main document body**. Replacements spanning differently styled runs inherit the first affected run style; check inside Word. Unsupported structures are left unchanged.
- The web application does **not** have a validated AI-authorship predictor or universal watermark detector. No numeric AI score is fabricated.
- Full Arabic dialect modeling, server APIs, scanned PDF OCR, commercial-grade contextual proofreading and model calibration against real student essays remain unimplemented/gated.
- GitHub Pages CSP meta does not supply header-only protections. Browser rendering cannot be fully certified from CI smoke tests alone.

### Verification
- GitHub Actions runs JavaScript syntax, Word XML and Chrome roundtrip, writing rules, privacy/CSP checks, and Python evaluation dataset/A-B metric checks on the release branch.
- Review the latest run at [GitHub Actions](https://github.com/bimspecialist/Text-Integrity-Studio/actions) before applying further production changes.
