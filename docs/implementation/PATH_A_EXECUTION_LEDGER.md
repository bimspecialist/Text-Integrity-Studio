# Path A execution ledger — 2026-10-13
**Execution plan:** docs/superpowers/plans/2026-10-13-tis-path-a-master-plan.md (PR #15)
**Isolated branch:** feature/path-a-m0-core-reliability (draft PR #16), started from verified main 8d08635bd2adf3e32e22ba3735a0049ea6b22b4c
**Environment ruling:** Local container cannot resolve github.com for git clone. All source changes are isolated on the GitHub feature branch, with actual test commands executed by GitHub Actions; no local repo/worktree was fabricated. Do not merge until complete review and owner's requested release gates.

## Task ledger

- **R1: complete (tests/analysis/baseline-parity.test.js).** Frozen V6 limits and abstentions. Initial CI failure in run 38405751046 was an incorrectly sized test fixture (1800 characters encoded to less than 448 fake tokens). Corrected fixture to 3000 characters WITHOUT changing production thresholds. Entire Quality run **38405958130 PASS** (aaac5d7).
- **R2: complete (docs/analysis/document-session.js).** Wrote tests first, observed expected missing-module RED in Quality run **38406238377**, implemented immutable revisioned text and UTF-16 paragraph spans; full Quality run **38406467085 PASS** (e17a732). Same-length edits invalidate prior snapshot, DOCX source tag preserved, no storage or remote network access. This new module is not wired to production yet; integration is R8.
- **R3: complete (docs/analysis/eligibility-policy.js, docs/ai-score-ui.js, docs/studio-insights-ui.js, docs/index.html).** Unit RED expected missing policy module in Quality run **38406816473**, unit GREEN run **38407098104**; browser delegation RED when first-party scripts were not loaded in run **38407341394**; canonical policy script now loads before both UI consumers. Final Quality **38407639487 PASS**, actual two-model Chromium smoke **38407639095 PASS**, pre-existing public-main URL diagnostic **38407639340 PASS** (this diagnostic checks old published main, NOT the unmerged candidate).
- **R4: complete as an isolated pure contract (docs/analysis/evidence-contract.js).** Tests-first missing-module RED in Quality run **38408247871**; real fail-closed model revision/UTF-16 offset/coverage/status validator implemented, and full Quality **38408541466 PASS** with real ONNX browser smoke **38408541637 PASS**. Handles INCONCLUSIVE as null; strips user source text from returned projection. The validator is NOT yet wired into the live controller (R6/R8).
- **Ruling — empty input exception:** The V6 core returns MIN_WORDS on an empty string, whereas visible UI requires NO_TEXT. The canonical wrapper returns NO_TEXT before calling the core; all nonempty source classifications mirror the core exactly. Short Arabic under 120 words retains the core MIN_WORDS precedence, while long Arabic/mixed text remains UNSUPPORTED_LANGUAGE. No English model result is allowed for unsupported Arabic.

## Remaining gates

- M0 performance baseline S3: **not yet completed**; do not claim improvements without real matched measurements.
- R5 Worker/iframe bridge, R6 controller, R7 coverage projection, R8 UI integration, plus H/L/E/S workstreams: **not yet completed**. R4 has unit coverage but is not yet integrated into live inference.
- Browser-local full generative rewriting/model selection L1–L8: **not yet implemented**; no model weights downloaded or production generator enabled.
- No production deployment or main merge has occurred; scientific probability validation remains unproven.
