# V11 writing + experimental AI signal UX — tested-preview scope

**Source:** existing public Pages V11 `?v11preview=1`, V9 is default. This update does **not** certify or recalibrate an AI-authorship classifier.

## Change delivered

- The existing **Review text / مراجعة النص** action still performs private, local rule-based writing review by default, with zero automatic classifier download.
- An obvious **Include experimental AI signal / إضافة فحص إشارة AI** checkbox appears next to the main action. When the visitor explicitly selects it and the text passes the existing English-only, 120+ word eligibility policy, the *same* primary button starts the existing, single authoritative in-browser `AnalysisController`. Its genuine download/analysis progress and Cancel are displayed.
- Arabic, mixed-script, and insufficiently long text remain available for local writing review, without starting the English research detector or fabricating an authorship percentage.
- A **measured raw model signal percent** is shown prominently only after successful, validated, source-revision-matched `RESEARCH_SIGNAL` evidence. The corresponding sampled-word coverage is displayed separately. The UI always labels it an **experimental, uncalibrated research signal, not a percentage of text authored by AI**.
- `INCONCLUSIVE`, missing, invalid, overwritten, stale or out-of-range evidence shows a dash, never a pseudo-precise percentage.
- The **Refine your writing / حسّن كتابتك** screen uses a light side-by-side source/draft layout on desktop and stacked panes on mobile. Canonical source integrity, protected facts, edited-draft validation, Apply/Undo and DOCX read-only safeguards are reused unchanged. Dark leftover UI and stale legacy toast are removed in V11.
- No research model, back-end service or calibration threshold changed; V9 defaults and V10 preview are unmodified.

## Tests and interpretation

- `tests/analysis/workspace-v11-ai-review-browser.test.cjs`: real browser interaction for consent, 120-word eligibility, authorisation of the lazy model iframe and cancellation, and RTL responsive Refine layout. The runtime iframe is **deliberately inert in this test**, so this verifies invocation, not model output.
- `tests/analysis/workspace-v11-signal-presentation.test.cjs`: synthetic **UI-only** model-state contract fixtures to verify raw score visibility only for validated statuses/revisions.
- `tests/analysis/workspace-v11-ai-score-view-browser.test.cjs`: labeled **synthetic UI fixture** displaying an injected example raw score and then withholding it when status is inconclusive. Does not measure classifier accuracy.
- Existing `workspace-v11-guided-browser`, `workspace-v11-file-review-browser`, `workspace-v11-m2-reviewed-edits-browser`, axe and website QA tests must remain green.
- GitHub's optional **real ONNX model smoke** and broad quality check must run on the exact merge candidate; only these real model checks establish that inference can execute, not its accuracy.
- Real NVDA/TalkBack/VoiceOver and scientific recalibration of AI authored-text probabilities remain **UNVERIFIED / HOLD**. Historic false-alert benchmarking prevents presenting the score as a certified AI-writing rate.

## Acceptance and rollback

Verify desktop 1440x900 input Review button remains above fold, responsive Refine at 390px RTL, every source revision invalidates previous signal and suggestions, and the model is never downloaded in the default review path. If anything regresses, revert only the preview UI changes and retain V9 in `main`.

**Final AI detector release:** HOLD pending independent data-label audits, better EN/AR coverage and held-out calibration. **Optional UI preview:** may be updated after CI + actual hosted Pages regression without asserting scientific detector accuracy.
