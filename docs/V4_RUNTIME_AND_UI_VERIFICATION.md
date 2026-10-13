# V4 — Real AI detection and focused editor release evidence

Baseline: `b6ceffac4403d3e3dfb5e99e04d0e851d2af845b`, GitHub Pages.
PR: [#11](https://github.com/bimspecialist/Text-Integrity-Studio/pull/11).

## Reproduction and root-cause boundaries

The public deployed GitHub Pages website was tested with a real Chromium browser and real optional ONNX model (not a mock): [baseline deployed run 38365638946](https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/38365638946). A **2,750-character English test document** produced an uncalibrated TMR model signal of **98.1%**, with zero recorded failed requests and zero page-console errors. This single observation does **not** prove that other users or browsers can download the model reliably. It is a research **model output**, not 98.1% AI authorship or accuracy.

**Confirmed UI defects:**
- Prominent “Check my text” checked grammar but **did not launch AI detection**. Users saw a writing status and might reasonably believe AI had run.
- Browser model had a separate, low-visibility trigger and scrolled the page to a lower technical card after clicking, obscuring the primary result.
- Errors and “English-only / >=120 words” eligibility messages appeared only in the lower technical status. Short English could be misreported as unsupported language.
- Missing iframe initialization timeout and inference inactivity timeout could leave a long “Loading...” experience without a usable failure explanation.
- Existing desktop interface had an oversized introduction, multiple competing actions and research details in the default workflow. Mobile CSS grid flattening risked confusing panel overlap/order, addressed by explicit mobile flex order.

**Corrective changes:**
- One clearly labeled primary **Scan AI text / فحص AI للنص** button in the editing workflow. Review writing is a separate, equally honest operation and **does not download the AI model**.
- AI result and language/length/network/model/timeout diagnostics appear where users look: the primary right-hand results panel.
- Heavy research model comparison, contextual limitations and passage-level diagnostics move behind **Advanced details**, without deleting the original functionality.
- The real English ONNX model still requires explicit opt-in to fetch model weights (~126 MB) from third-party model-hosting/CDN origins. No private text is intentionally submitted to a model inference API.
- Cancel, input-change and timeout paths clear stale results; dead child frames are discarded and retries are possible.
- Focused dark document toolbar, slim navigation, large editable canvas and right-side diagnostic/suggestions; responsive Arabic RTL ordering protects editor before results.
- Query-versioned changed scripts/styles reduce stale client caches following Pages deployment.

## Scientific restrictions

No training data, inference thresholds, model weights, or calibration coefficients were altered. For English documents shorter than **120 whitespace-separated words**, unsupported Arabic/mixed text, very long content, or contradictory/insufficient model evidence, **no document-wide authorship percentage can be justified**. A raw classifier diagnostic is not a calibrated probability. Existing research benchmark (5/64 high human alerts in the externally labeled 2026 corpus) is unaffected and still insufficient to certify classification quality.

## ECC-style acceptance and rollback

- Maintain **quality.yml** regression coverage for safe Word/DOCX, PDF.js and offline OCR, grammar, Unicode security, bilingual layout, raw evidence, and real browser opt-in/cancel/unsupported/failure retry behavior.
- Maintain genuine downloaded **ONNX primary and secondary smoke** in Chromium on the PR head.
- Capture visual screenshots at desktop and mobile RTL and assert no input/results overlap.
- A public-site diagnostic checks the actual GitHub Pages origin using a **non-private development fixture**. On PR, it observes the existing published main; once Pages deployment succeeds on the merged revision, an automatically triggered workflow must verify the new version is served, that **Scan AI text** works, and that the runtime returns real evidence.
- Rollback: revert squash merge from PR #11 to the previous main SHA. No user documents are uploaded/persisted by the new UI, and no backend migration is involved.

**Remaining uncertainty:** The real model was not validated on every Windows/Android/mobile browser, blocked network, or low-memory device. English-only capability and statistically calibrated authorship accuracy remain scientifically limited; this release fixes the **visible workflow and failure recovery**, not model discrimination rates.
