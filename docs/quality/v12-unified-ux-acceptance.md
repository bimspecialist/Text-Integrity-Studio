# V12 unified Text Integrity Studio — design acceptance (preview only)

This is a **gated user-experience prototype**, not a new detection model or final authorship classifier. Route **after publication approval only**: `/?v12preview=1`.

## Diagnosed product gap

V11 separates local writing observations, a 120+ word English research model, model coverage highlights and the draft editor into multiple screens. The main `Review text` can conduct editorial review without running the model; users perceive this as a missing detection result. The score is currently `UNCALIBRATED_CLASSIFIER_SIGNAL_NOT_AUTHORSHIP_PROBABILITY` under a strict evidence contract, and sentence-level authorship labels are **not supported**.

Reference research: GPTZero's public explanations describe a one-form upload/paste → document-wide assessment → highlighted passages → interpreted result. QuillBot's help describes before/after edits with visually distinguished changes. The present prototype adopts the workflow pattern, **not competitors' unverified accuracy claims or interface assets**.

## One task flow

1. Start on a light, centered, single source textbox + first-party Word/PDF/TXT picker.
2. **Check AI signal** is the visible primary task. The existing English classifier can run only after an eligible English document (120+ words) and **only after this explicit user click**; any first-run download is explained upfront. Short/Arabic documents show exactly why that action is unavailable.
3. **Refine my writing** offers a separate, always-clear local editorial path without triggering the optional model.
4. Real model state is displayed by existing V10 progress/error/results; only validated, document-revision-matched model evidence can display a **raw signal score** plus measured coverage. Never mislabel it as a verified AI-authorship percentage or sentence-by-sentence verdict.
5. Click **View writing suggestions** after supported model results, or open writing review directly. Suggestions display real rule-based observations attached to exact source ranges; no fabricated advice.
6. Open **Refine**. Source, editable draft and *the same review cards with their original preview/apply/undo listeners* are visible together, with responsive columns for desktop and stacked/mobile fallback. No automatic rewriting.

## Engineering boundary

- V12 uses the existing `DocumentSession`, `AnalysisController`, V10 results, V11 reviewed editor and protected-fact checks.
- No new model downloads occur simply by loading the preview or selecting writing review.
- Old V9 and opt-in V11 routes remain unchanged.
- The existing release marker and dependency versions are preserved.
- A source edit must invalidate previous model evidence; DOCX imported source remains read-only for automatic fixes.
- No storage or third-party request is added to the V12 presentation layer.

## Acceptance evidence

- `tests/analysis/workspace-v12-browser.test.cjs`: eight EN/AR × 320/390/768/1440 CSS-pixel browser journeys, true editor/source separation, no content overflow or clipped hero, explicit opt-in AI runtime entry + cancel, no fake progress, no third-party writing requests, V9 and V11 isolation.
- `tests/analysis/workspace-v12-axe-browser.test.cjs`: six real Chromium axe WCAG-tagged scenarios with zero reported violations. Incomplete color-contrast cases are **not certified**; manual review is still required.
- `tests/analysis/workspace-v11-m2-reviewed-edits-browser.test.cjs`: existing exact-revision suggestion preview/apply/undo, blocked protected facts, DOCX source invariants.
- `tests/analysis/workspace-v11-file-review-browser.test.cjs`: genuine DOCX/PDF import regression.
- `tests/analysis/public-postdeploy-contract.test.cjs`: protected release marker remains unchanged.
- The preview CI archives genuine Chromium screenshot files for English and Arabic input, review and Refine.

## Still NOT accepted

- **Model accuracy:** no new independent labeled EN/AR datasets, threshold tuning, calibration, uncertainty measurement or external validation. Raw model scores are **not probabilities that a fraction of text was authored by AI**. Arabic AI detection and full on-device generative rewriting are still unavailable.
- **Real devices:** NVDA/VoiceOver/TalkBack, 200–400% browser zoom and contrast checks need physical manual review.
- **User experience sign-off:** owner must inspect actual screenshots and/or hosted opt-in preview before publication. This PR must remain Draft until approved.

### Dedicated accuracy milestone (separate from UX)

Collect licensed, independently labeled human/AI corpora with human-AI-edit mixtures, balanced domain, length, time period and languages. Audit label provenance and source leakage, fix test/holdout splits before fitting thresholds, and publish per-language false-positive rates for human text, ROC/PR metrics, Brier score/ECE and reliability diagrams. Only after independent held-out calibration and ethics review can any language-specific **probability** be advertised. Until then the display must explicitly say **uncalibrated research model signal**.

**Status: UX prototype in QA. Scientific AI detection: HOLD. Production release: HOLD.**
