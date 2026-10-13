# Text Integrity Studio — approved V5 single-action redesign

**Baseline main:** cfc946c3d52c4f46c9ce4f1a042ef81b307c2c00
**PR:** https://github.com/bimspecialist/Text-Integrity-Studio/pull/13

## Delivery

The approved mockup direction is implemented as accessible, responsive native HTML, CSS and JavaScript in the existing static website. No alternate project, service, paid AI API, user account, fictitious free-plan quota, or screenshot overlay was added.

Changes:
- First-party licensed Manrope variable for English and IBM Plex Sans Arabic for Arabic, including local OFL license files and CI verification of exact pinned font hashes.
- Top website masthead, desktop tool rail, large text editor, keyboard-accessible upload tab, compact AI evidence ring and section signal breakdown.
- ONE visible Analyze Text action in the default workspace. It first runs existing non-destructive local writing/Unicode/security checks. On eligible English text (>=120 words and within limits), the same click launches the optional real local ONNX model. When running, that same action cancels.
- All previous Word/DOCX, PDF, offline OCR, text cleanup, research model, export/report and history controls remain accessible behind the single More document tools disclosure or the advanced scientific details panel.
- The model indicator never contains the mockup's invented 72% or a made-up high-confidence badge. It displays an actual, uncalibrated ONNX model signal or an explicit inconclusive state. Paragraph indicators require actual model-window coverage; unexamined sections remain unscored.
- Input changes cancel or invalidate old model results; the interface explicitly notes that raw model signals are NOT reliable authorship probabilities.

## Safety and licensing

Font source is Google Fonts commit 66928797f271fed5ee428544e7229685e2d90127. Exact blob hashes are pinned in the Quality workflow. Open Font License notices remain in the docs/fonts directory. All fonts are loaded from the website origin; no external font tracking is added. Original user text remains local to the browser; first-time ONNX code and model weights are fetched only on explicit analysis.

The detector still supports English only. There is NO newly verified calibration accuracy, no certified author identification, and no promise of detecting Arabic or mixed-language AI-authored text. Those situations return writing feedback and explain why the research AI score is unavailable.

## Acceptance and release evidence

- Browser one-click test asserts the single visible main button, source-derived score, measured paragraph values, stale-result removal, local font readiness, no unsolicited third-party requests and desktop/mobile RTL layout.
- Prior DOCX, PDF.js, offline OCR, grammar, cleanup, security and research ONNX regression suites remain mandatory. Secondary-tool tests explicitly expand More document tools before exercising the same underlying features.
- Genuine downloaded ONNX smoke in Chromium is a required PR check, separate from mocked fast UI tests.
- After merge, the actual public GitHub Pages URL must serve the V5 design, and the post-deploy Chromium gate must run an English sample through the same public Analyze button using the real model. The deployment gate waits briefly for the Pages CDN to update.
- If Quality, live-model inference, Pages publication or the post-deploy public scan fails, rollout is NOT validated. Revert the PR squash merge if required; there is no backend schema or stored user data to migrate.

## Honest scope

This release changes user experience, not classification weights or measured false-positive performance. It intentionally does not implement arbitrary binary file formats, independently calibrated per-document AI percentages, fake confidence scores or server-based team management on GitHub Pages.
