# Text Integrity Studio V9 Simplified Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Status:** DRAFT FOR OWNER REVIEW. Document only; do not change production code, merge, or deploy before owner approves the detailed specification and this plan.

**Goal:** Transform the existing V8 GitHub Pages UI into a coherent, simplified, professional dark bilingual workspace with three clear modes, one obvious action, preserved local-first behavior and every current document capability.

**Architecture:** Reuse the existing canonical DocumentSession, AnalysisController, evidence contracts, source/file loader and dual-pane controller. Reduce UI layers, not underlying features: migrate markup and CSS in isolated test-first steps, keep an adapter for old display hooks, and rerun existing privacy, document, revision, research-model, mobile and RTL checks at each release gate. No React rewrite, new server, remote inference or new scoring.

**Tech Stack:** Existing GitHub Pages static HTML, CSS, first-party JavaScript, Node 22, puppeteer-core headless Chromium, Python research checks, GitHub Actions.

**Spec:** \`docs/superpowers/specs/2026-10-15-tis-simplified-workspace-v9-design.md\` at current review branch.

## Global Constraints

- Source baseline: \`feature/path-a-m0-core-reliability\` HEAD \`815fa4ff033ba4c26bd173ca38a202c2a5fe13a9\`, PR #16 draft. Record the actual SHA before execution; rebase/reconcile if it advances.
- Preserve one canonical \`#source\`, \`#file\`, \`#scanAI\`, \`#tisRevisedText\`; one DocumentSession; one AnalysisController; and existing draft Apply/Undo/rollback.
- Keep \`docs/\` as the static GitHub Pages root and existing first-party JS patterns; no mandatory backend, new accounts, new CDN or cloud rewrite.
- Retain Arabic/English with RTL/LTR, dark V8 identity and self-hosted Manrope/IBM Plex Arabic fonts.
- Keep current DOCX/PDF/OCR, metadata/writing/security/Unicode, reporting, cleaning and local TXT export behavior, including documented limits.
- Retain English detector eligibility, frozen ONNX revision, token-window/coverage/abstention semantics; never present a calibrated AI authorship claim.
- All user text stays on the user's device for analysis/writing; optional heavy inference assets require existing consent. Local generative rewriter stays disabled until separately approved and independently validated.
- No product-code change, deployment or PR merge until the owner approves both this plan and its spec and selects an execution method. Public main stays unchanged.
- Use TDD (RED -> GREEN), one logical commit per task, and check exact head SHA on CI. Do not turn regression failures into skipped checks.
- No speed, model accuracy or accessibility certification claim without fresh appropriate evidence.

## Review Focus

Five high-risk cases need owning tests, beyond happy paths:
1. Switching Humanize -> Detection -> Editor mid-unsaved Arabic draft must not destroy draft or silently Apply it: Task 4.
2. Importing DOCX/PDF while optional inference is active must reject stale inference and OCR/import completions: Task 6.
3. Mixed Arabic/English text with protected units \`25 kPa\`, citations \`[12]\`, URL and dates must keep direction and refuse unsafe Apply: Task 4.
4. A 320px mobile user with enlarged text/200% zoom must reach Upload, Analyze, contextual result and Undo without page-level overflow: Task 3.
5. A blocked CDN, canceled scan, unsupported short/Arabic text or failed model must never display a fabricated percentage or initiate a cloud fallback: Task 5.

## File map and ownership decisions

| File | Responsibility | Planned operation |
|---|---|---|
| \`docs/index.html\` | Public semantic shell, exact original control IDs, order and disclosures | Modify incrementally |
| \`docs/analysis/workspace-v9.css\` | Scoped V9 semantic tokens, layout, components and breakpoints | Create |
| \`docs/analysis/workspace-v9.js\` | Presentation-only concise status and contextual navigation, no source ownership | Create |
| \`docs/analysis/workspace-v8.js\` | Existing find/replace, drop, diff, linked scrolling, status display | Keep active during migration; relocate independent features only after verifying parity |
| \`docs/analysis/workspace-v8.css\` | Existing V8 overrides | Keep during initial gate, retire only proven redundant CSS |
| \`docs/analysis/dual-pane-editor.js\` | Modes and revision-safe draft | Preserve logic; modify display integration only if required by tests |
| \`docs/analysis/app-adapter.js\` | One scan authority and legacy-to-V9 UI integration | Narrow compatibility edits |
| \`docs/ai-score-ui.js\`, \`docs/studio-insights-ui.js\` | Result presenters | Do not change scoring; only visible presentation wrappers if needed |
| \`docs/help.html\`, \`docs/privacy.html\` | Accurate bilingual product/help/privacy descriptions | Update copy after behavior proven |
| \`.github/workflows/quality.yml\` | CI gate | Add new browser/unit tests, do not remove existing checks |
| \`tests/analysis/workspace-v9-structure.test.cjs\` | Structural hierarchy, IDs, uniqueness and accessibility structure | Create |
| \`tests/analysis/workspace-v9-responsive-browser.test.cjs\` | Geometry, keyboard, RTL, 320/390/768/1150/1440, 200% zoom | Create |
| \`tests/analysis/workspace-v9-workflows-browser.test.cjs\` | Import/analyze/revise/status paths incl. failure handling | Create |
| \`tests/analysis/workspace-v9-privacy-browser.test.cjs\` | Network/consent and no unexpected egress | Create |

## Pre-implementation gate P0: freeze, reconcile and capture V8 baseline

- [ ] Step 1: Query GitHub for the latest PR #16 head, main SHA and open product PR state. Do not base V9 changes on a stale SHA or a divergent docs-only branch.
- [ ] Step 2: Create a NEW isolated product implementation branch from the current approved PR #16 head using \`superpowers:using-git-worktrees\` when executing locally; never edit \`main\` or the docs-only review branch for product code.
- [ ] Step 3: Run existing Quality, real ONNX browser smoke and DOCX/PDF/OCR/privacy checks against the exact baseline; archive run IDs, output and screenshots at 1440, 1150 RTL, 768, 390 RTL and 320.
- [ ] Step 4: Record observable baseline: major DOM IDs, viewport clipping/scrollWidth, status after Analyze, route from Upload to result, partial DOCX/read-only behavior, and at least a 20k-word synthetic editing sample. **Only after these are recorded** may a performance-improvement claim be made.

Expected gate: baseline snapshot and reversible branch identified; no behavior change.

### Task 1: Consolidate information architecture and semantic controls (UX-01, UX-02)

**Files:** Modify \`docs/index.html\`. Create \`tests/analysis/workspace-v9-structure.test.cjs\`. Add test step in \`.github/workflows/quality.yml\` after existing V8 tests.

**Interfaces:** Consumes exact existing DOM IDs, \`TISDualPaneEditor.mount\` and \`TISAnalysisApp\`; produces the same \`#tisModes\`, \`#tisModePanel\`, \`#source\`, \`#file\`, \`#scanAI\` and \`#tisRevisedText\` once each.

- [ ] Step 1: Write test for one header, no default sidebar, one visible primary CTA per mode, exactly one of every required ID, proper tab/tabpanel linkage and a collapsed yet keyboard-reachable advanced tool entry.
- [ ] Step 2: Run \`node tests/analysis/workspace-v9-structure.test.cjs\`. Expected: RED on old duplicate/default navigation.
- [ ] Step 3: Make the smallest semantic HTML change to unify header, mode switcher, task pane and contextual result without destroying underlying functional tool elements or listeners.
- [ ] Step 4: Run new test and existing \`node tests/analysis/workspace-v8-browser.test.cjs\`. Expected: both GREEN or reconcile intentionally changed visual assertions without weakening protected behavior.
- [ ] Step 5: Commit \`feat(ui): simplify V9 semantic workspace shell\` with only the task's files.

### Task 2: Introduce isolated presentation layer, not a second controller (UX-02, UX-05, UX-07)

**Files:** Create \`docs/analysis/workspace-v9.js\`, modify \`docs/index.html\` and narrowly \`docs/analysis/app-adapter.js\`; create \`tests/analysis/workspace-v9-workflows-browser.test.cjs\`.

**Interfaces:** Consumes existing \`TISWorkspaceV8.setAnalysisState(state)\` and \`TISWorkspaceV8.setWritingReviewResult(metadata)\` (retain forwarding); produces \`TISWorkspaceV9.mount({documentObject, source, scanButton, resultRoot})\`, returning \`{setAnalysisState(state), setWritingReviewResult(metadata), dispose()}\`. No \`session.replaceText\`, model \`run()\` or fetch is permitted in this module.

- [ ] Step 1: Add a test that types source, clicks exactly \`#scanAI\` once, receives authoritative state, then edits source and observes STALE; mode switch with no input never triggers a scan.
- [ ] Step 2: Run \`node tests/analysis/workspace-v9-workflows-browser.test.cjs\`. Expected: RED due to absent V9 adapter.
- [ ] Step 3: Build a concise state presenter for EMPTY/READY/LOADING/ANALYZING/WRITING_ONLY/UNSUPPORTED/RESEARCH_SIGNAL/INCONCLUSIVE/STALE/ERROR/CANCELLED; wire it as a UI observer alongside existing presenters, not a new engine.
- [ ] Step 4: Run V9 workflows + \`node tests/analysis/analysis-integration-browser.test.cjs\` + \`node tests/analysis/analysis-controller.test.js\`. Expect 0 failures.
- [ ] Step 5: Commit \`feat(ui): render one canonical analysis state in V9\`.

### Task 3: Responsive visual system and accessibility (UX-03, UX-04, UX-10, UX-11)

**Files:** Create \`docs/analysis/workspace-v9.css\`; modify \`docs/index.html\`. Create \`tests/analysis/workspace-v9-responsive-browser.test.cjs\`.

**Interfaces:** Uses existing V8 design token values but renders only through semantic scoped \`body.tis-v9\` selectors. Layout: >=901px two columns, <=900px one column. Do not change HTML IDs to achieve styling.

- [ ] Step 1: Add headless Chrome assertions for 1440 desktop, 1150 RTL, 768 tablet, 390/320 mobile, no >8 CSS-pixel horizontal overflow, readable labels and visible result after Analyze.
- [ ] Step 2: Add keyboard/focus sequence, 200% zoom and \`prefers-reduced-motion\` checks; put manual screen-reader and touch QA on release checklist.
- [ ] Step 3: Run \`node tests/analysis/workspace-v9-responsive-browser.test.cjs\`. Expected RED before V9 styles.
- [ ] Step 4: Introduce semantic V9 scoped tokens, stable balanced columns and mobile stacking; do not add new fonts or remote assets.
- [ ] Step 5: Run V9 responsive + \`node tests/analysis/accessibility-browser.test.cjs\` + \`node tests/analysis/workspace-v8-browser.test.cjs\`; inspect actual screenshots, not just DOM tests. Commit \`feat(ui): responsive accessible bilingual V9 styling\`.

### Task 4: Preserve original/revised workflows under simplified modes (UX-05, UX-06)

**Files:** Update only display integration in \`docs/analysis/dual-pane-editor.js\` and \`docs/analysis/workspace-v9.js\` if needed, plus \`tests/analysis/workspace-v9-workflows-browser.test.cjs\`. Leave existing revisioned controller unchanged unless a failing test proves a defect.

**Interfaces:** Reuse \`TISDualPaneEditor.mount(...)\`, \`#tisRevisedText\`, \`#tisDraftApply\`, \`#tisDraftUndo\`, \`#tisDraftReset\`, \`#tisV8FindPanel\` and \`TISRewriteIntegrityCheck.compareRewrite\`.

- [ ] Step 1: Add tests for unsaved Arabic draft surviving mode round trips; protected \`25 kPa\`, \`[12]\`, URL and numeric changes never Apply; DOCX read-only unchanged; stale Undo/reset recovery never overwrite source.
- [ ] Step 2: Run \`node tests/analysis/workspace-v9-workflows-browser.test.cjs\`. Expected RED if revised layout loses state.
- [ ] Step 3: Keep existing trusted handlers and rehome their controls into clear contextual placement, with no cloned source editor.
- [ ] Step 4: Run \`node tests/analysis/dual-pane-editor-browser.test.cjs\`, \`node tests/analysis/draft-undo-unsaved-browser.test.cjs\`, \`node tests/analysis/draft-reset-recovery-browser.test.cjs\` and V9 workflow suite.
- [ ] Step 5: Commit \`feat(ui): keep safe review apply undo in simplified modes\`.

### Task 5: Truthful detector presentation, robust errors, explicit consent (UX-07, UX-08)

**Files:** \`docs/analysis/workspace-v9.js\`; \`docs/index.html\`; create \`tests/analysis/workspace-v9-privacy-browser.test.cjs\`; optionally modify result-presenter wrappers only if V9 layout requires it.

**Interfaces:** Consume canonical \`TISAnalysisController\` and \`TISEvidenceContract\` results without altering eligibility, thresholds, pinned model revisions, source coverage, consent or score. No V9 module may invoke model endpoints or download models.

- [ ] Step 1: Write tests for Arabic/short/mixed text: no research overall score; INCONCLUSIVE/Error/Cancel have no numeric author-probability; coverage and historical comparator explanatory labels are honest.
- [ ] Step 2: Add network intercept tests: initial open, typing, paste, writing review and error retries send no source text and make no optional model requests before user opt-in; blocked CDN remains usable writing-only.
- [ ] Step 3: Run \`node tests/analysis/workspace-v9-privacy-browser.test.cjs\`. Expected RED if V9 accidentally initiates inference.
- [ ] Step 4: Simplify wording/presenters while retaining consent and fail-closed behavior; retain disabled Rewrite locally and clear “not available” explanation.
- [ ] Step 5: Run V9 privacy + \`node tests/analysis/privacy-network.test.cjs\`, \`node tests/analysis/local-rewriter-network-privacy.test.cjs\`, \`node tests/analysis/evidence-contract.test.js\`, \`node tests/analysis/eligibility-policy.test.js\`. Commit \`feat(ui): simplify truthful AI and privacy states\`.

### Task 6: Keep every advanced document feature working (UX-02, UX-09)

**Files:** Modify \`docs/index.html\` and V9 view as necessary; update \`tests/analysis/workspace-v9-workflows-browser.test.cjs\`. No parser rewrite.

**Interfaces:** Preserve \`#file\` and current DOCX/PDF/OCR/cleanup/report/control IDs; preserve \`TISDocumentSession\` revision invalidation and input event behavior.

- [ ] Step 1: Add integration tests for supported drop/import and unsupported-file rejection, DOCX read-only edit boundaries, PDF OCR late result after a newer source edit, TXT draft export and report output.
- [ ] Step 2: Run V9 workflows. Expected RED for any inaccessible or broken feature in the redesign.
- [ ] Step 3: Relocate and label existing tools under a single discoverable advanced section without removing handlers. Keep practical existing size/page/range limits.
- [ ] Step 4: Run \`node tests/analysis/import-race-browser.test.cjs\`, \`node tests/analysis/import-overlap-browser.test.cjs\`, \`node tests/analysis/ocr-edit-race-browser.test.cjs\`, \`node tests/word-docx.test.js\`, \`node tests/pdf-browser.test.js\`, \`node tests/ocr-browser.test.js\`.
- [ ] Step 5: Commit \`feat(ui): preserve document tools within progressive disclosure\`.

### Task 7: Retire only verified redundant V8 presentation scaffolding (UX-01, UX-11, UX-12)

**Files:** \`docs/index.html\`, \`docs/analysis/workspace-v9.css\`, \`docs/analysis/workspace-v8.css\`, \`docs/analysis/workspace-v8.js\`, \`docs/analysis/dual-pane-editor.css\`; tests as necessary.

**Interfaces:** Keep exported \`TISWorkspaceV8\` methods until all actual callers have migrated; keep live event handlers for find, diff, drop and linked scroll. Any removal must be justified by search evidence and test.

- [ ] Step 1: Inventory CSS specificity/collisions and all live calls to each DOM ID/global hook, with screenshot baseline.
- [ ] Step 2: Write a DOM/static test detecting accidental duplicate IDs, multiple primary actions, inaccessible collapsed tools or missed event bindings.
- [ ] Step 3: Run new and existing tests to show baseline.
- [ ] Step 4: Remove only selectors and handlers verified obsolete, keeping the rest. Rerun focused tests after each removal rather than deleting old scripts wholesale.
- [ ] Step 5: Rerun full Quality and compare same-hardware synthetic editor timings; report the actual before/after numbers, or explicitly make no performance improvement claim. Commit \`refactor(ui): retire verified obsolete V8 presentation layers\`.

### Task 8: Review docs, security and candidate release matrix (UX-08, UX-10)

**Files:** \`docs/help.html\`, \`docs/privacy.html\`, \`docs/release/PATH_A_RELEASE_CHECKLIST.md\`, optional new V9 evidence log; \`.github/workflows/quality.yml\` where needed.

**Interfaces:** No runtime API introduced. Existing S1–S5 and scientific E-series release gates remain separate and unchanged.

- [ ] Step 1: Write documentation consistency checks for AR/EN mode labels, supported formats, opt-in model and inaccurate AI score claims.
- [ ] Step 2: Run docs/static checks. Expected RED for stale copy if any.
- [ ] Step 3: Update only behavior-proven copy and the release checklist, preserving technical/scientific blockers and consent explanation.
- [ ] Step 4: Run full Quality, real optional primary/secondary ONNX model smoke, backend regression and site-independent public-baseline diagnostic on exact candidate SHA. Attach fresh screenshots (1440, 1150 RTL, 768, 390 RTL, 320), keyboard and zoom records.
- [ ] Step 5: Request independent code/security/UX review; resolve Critical and Important findings; commit \`docs(ui): align V9 help privacy and acceptance evidence\`.

## Exit gates — all must be evidenced, no shortcut

- **G0:** Documentation/spec approved; exact baseline and isolated implementation branch chosen.
- **G1:** One-source/two-pane and no-duplicate-inference integrity preserved.
- **G2:** UI geometry, keyboard, RTL and mobile screenshot review passes at exact tested viewports.
- **G3:** DOCX/PDF/OCR, writing/draft, import-race, export and privacy regression suite passes.
- **G4:** Real model smoke and honest science/consent behavior pass; the unverified generative feature remains disabled.
- **G5:** Independent review, security issues, fallback and rollback plan cleared.
- **G6:** User separately authorizes merge/public release after reviewing evidence; validate actual Pages marker and run public-site checks before announcing success.

## Verification and evidence rules

Use exact versions of \`node\`, Chromium and \`puppeteer-core\` already pinned/used by Quality workflow. CI checks on a PR do not prove production deployment. A green synthetic responsiveness test does not prove WebGPU/model performance, independent detector accuracy, WCAG accessibility or real DOCX layout in Word. If a host/manual test cannot be run, report PASS WITH REQUIRED VALIDATION or BLOCKED, not PASS.

Expected basic CI entry commands (run at execution, not run by authoring this plan):
- \`node tests/analysis/workspace-v9-structure.test.cjs\`
- \`node tests/analysis/workspace-v9-workflows-browser.test.cjs\`
- \`node tests/analysis/workspace-v9-responsive-browser.test.cjs\`
- \`node tests/analysis/workspace-v9-privacy-browser.test.cjs\`
- \`node tests/analysis/workspace-v8-browser.test.cjs\`
- \`node tests/analysis/analysis-integration-browser.test.cjs\`
- \`node tests/analysis/dual-pane-editor-browser.test.cjs\`
- \`node tests/analysis/privacy-network.test.cjs\`
- \`node tests/analysis/long-editor-responsiveness.test.cjs\`

## Owner review and execution choice

This document proposes tasks and test commands; none of the new V9 test files exist yet, and none of the proposed V9 tests were run by writing this plan. The owner should (1) review and approve this design/plan, (2) select native execution or the actually available subagent-driven review mode, and only then (3) authorize product development on a new isolated implementation branch. Approval of docs never merges the changes into main; publishing is a distinct later decision.
