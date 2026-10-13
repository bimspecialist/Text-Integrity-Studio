# V6 — Full DOCX workspace and inconclusive-evidence repair

## Verified defects from the customer's screenshot

1. The legacy Word companion appended a large inspection toolbar immediately after the textarea, between the document and the **Analyze Text** action. On a typical desktop viewport, uploading a DOCX pushed the action below the screen.
2. The research detector correctly withheld an overall score for contradictory passage evidence, but the UI wrote the long literal **INCONCLUSIVE** inside a ~108px circle, overflowing into adjacent results text.
3. Word extraction joined individual paragraphs with single newlines while the editor's section analyzer recognizes blank-line boundaries. This collapsed many Word paragraphs into one section, impairing section-level presentation.
4. The results card presented a local passage signal alongside document-wide abstention without an explicit reason and without clearly showing per-section evaluation coverage.
5. Existing PDF, OCR, DOCX and research QA scripts had assumed secondary tools were always visible. Those assumptions needed to be aligned with the previously approved More Tools disclosure, without disabling functionality.

## Implemented

- Relocated the dynamically-created DOCX picker/toolbar/structural report into a collapsed Word-specific section inside **More document tools**. Uploading a file no longer automatically opens the entire toolbox.
- Added a bilingual local document note clarifying **read-only extraction**, preserved DOCX original and where Word-specific export/cleanup can be accessed. The original filename remains in the local status.
- For read-only DOCX imports, reduced the oversized editor height so the single Analyze action stays reachable on a 1736x900 desktop.
- Preserved Word paragraph breaks and dispatched a normal input event for programmatic imports, invalidating previous AI scores.
- Numeric score display is restricted to an actual finite valid model output. When the engine abstains, the ring displays an em dash, and an explicitly labeled reason (heterogeneous passages, low coverage, or model disagreement) appears next to it.
- Added **document sampling coverage** and per-section model-window coverage labels. An unreviewed section never receives a number. For long documents, overview rows sample across the document rather than only its first eight sections.
- Preserved opt-in, on-device model inference, both historical ONNX options, calibrated-percentage abstention rules and existing Word/PDF/offline OCR code paths. **No model threshold or classifier weight was altered**.
- Strengthened the Chromium regression suite with a real, synthetic 7-paragraph DOCX upload, non-overlapping desktop layout, DOCX control relocation, source read-only status, measured-only numbers, abstention explanation, accessible advanced tools, and 390px Arabic RTL layout.
- Adapted legacy browser tests to intentionally expand **More document tools** when testing a secondary action rather than making extra actions visible on the default screen.

## Test evidence and limitations

Acceptance is gated by the repo's **Quality checks**, genuine downloaded ONNX Chromium smoke, and a public Pages integration diagnostic. The public-site workflow must verify the new deployment following merge; passing a PR's test against the old main URL is not proof of the new UI's deployment.

Research-model signals (e.g., the screenshot's 4.7% for an analyzed passage) are **not** AI authorship probabilities and must not be promoted into document-wide percentages when the model status is INCONCLUSIVE. An academic report can legitimately produce misleading model signals. The revision resolves the UI workflow and explanation, **not** the model's unverified discrimination accuracy.

No external real-world group of experts was engaged. This is an engineering review using separate UX, browser compatibility, NLP evidence, accessibility, security/privacy and QA criteria. Future work may still be needed for unusual DOCX structures, low-memory mobile browsers and independent Arabic detector calibration.
