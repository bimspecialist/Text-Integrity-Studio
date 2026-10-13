# Text Integrity Studio Path A Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver the approved Path A reliability-first redesign of detector internals, transparent and safe post-scan Humanize Suggestions, independent scientific evaluation, and privacy/performance/release checks WITHOUT replacing the existing Text Integrity Studio app or inventing AI-authorship certainty.

**Architecture:** Four separately reviewed workstreams, each with its own test-first plan and independently demonstrable output. Maintain GitHub Pages as a static, local-first site and the one-button bilingual UI; ship guarded incremental compatibility changes, not a rewrite. Offline evaluation/research never silently becomes a production detector update.

**Tech Stack:** Existing docs/ first-party JavaScript UMD/CommonJS, ONNX in same-origin browser iframe, GitHub Pages, Node 22, Chromium Puppeteer, existing Python 3.12 research evaluator and GitHub Actions workflows.

**Spec:** docs/superpowers/specs/2026-10-13-tis-path-a-reliability-design.md (approved design with owner-requested Humanize subsection 6.1).

## Global Constraints

- Protected verified V6 main baseline: 8d08635bd2adf3e32e22ba3735a0049ea6b22b4c. If main advances before execution, inspect the new SHA and rebase/reconcile plans; do not overwrite another change.
- No work starts merely because the design was approved. The owner must review THIS execution plan and choose Native or an actually available subagent-reviewed execution method first.
- Existing dark Manrope / IBM Plex Sans Arabic, EN/AR/RTL, large editor, ONE prominent Analyze Text action, PDF/DOCX/OCR/cleanup/export all stay working.
- Local-first private document handling. Explicit model download only on Analyze; no mandatory server/backend, text upload or third-party analytics.
- Pinned primary TMR revision b9aa251e5bcda7e429fcc936767d921435945b60 and secondary legacy revision 54895bd11f34b47a01369d25b2255224717409b8. Eligibility minimum 120 English words, <=120000 JS characters, 448 tokens/window, 12 normal/96 extended windows, 60% sampled-word coverage guard. Do not change thresholds/weights in an architecture PR.
- A raw signal is NOT a calibrated AI-authorship probability. INCONCLUSIVE/ERROR/UNSUPPORTED/CANCELLED have no overall number. Humanize editing must not be optimized for evading detectors or invent facts.
- TDD small tests, real-model smoke, pre/post screenshots, regression paths, independent review gates and easily reversible feature PRs; never disable CI failures to force green.
- Engineering GO (safe experimental site) and scientific PRODUCTION CLAIM HOLD (certified authorship percent not validated) are separate, non-substitutable decisions.

## Review Focus

1. A 120-word academic English paragraph with citations and a real measured quantity must be scanned honestly and not altered by Humanize without explicit review; tasks R3/R4/H1/H2.
2. A user imports a long DOCX during a 96-window inference, then edits an equal-length string: all old events/results are rejected and the original DOCX remains intact; tasks R2/R5/R6/R8/S4.
3. A compromised/blocked runtime CDN, spoofed iframe message or unknown model revision cannot create a score; writing-only review continues; tasks R4/R5/S1/S2/S5.
4. A public benchmark with duplicate prompts and different generator families must not contaminate train/calibration/release-test or justify a new percentage; tasks E1/E2/E3/E5.
5. Arabic RTL on a small mobile with the editor, INCONCLUSIVE panel and Humanize detail open must remain readable with one Analyze button, accessible focus/undo and no overflow; tasks H3/S4/S5.

---

## Workstream files and decisions

| Stream | Complete implementation plan | Reviewable deliverable | Depends on |
|---|---|---|---|
| R — detector lifecycle | docs/superpowers/plans/2026-10-13-tis-core-reliability.md | Immutable revision snapshots, one eligibility policy/controller, strict evidence validator and single projection | none, except preserved V6 behavior |
| H — natural writing suggestions | docs/superpowers/plans/2026-10-13-tis-natural-writing-advisor.md | User-reviewed Arabic/English post-scan suggestions, safe Apply/Undo, optional honest rescan comparison | R2 and final R8 controller/app adapter |
| E — scientific evaluation | docs/superpowers/plans/2026-10-13-tis-scientific-evaluation.md | Group-disjoint, provenance-audited offline metrics, research calibration evaluation, explicit BLOCKED/HOLD | independent; no browser release prerequisite |
| S — privacy/performance/release | docs/superpowers/plans/2026-10-13-tis-security-performance-release.md | Network trust tests, pinned dependency inventory, cold/warm benchmarks, RTL/a11y and actual public post-Pages gates | S3 V6 baseline BEFORE R8; S1/S2/S4/S5 integration after R8 and H3 |

**Module boundary lock-in:** R2 owns snapshots; R3 eligibility; R4 outcome validation; R5 transport; R6 state machine; R7 measured section mapping; R8 DOM adaptation. H1 produces editor observations, H2 user-controlled edits, H3 renders the optional section, H4 compares only comparable raw model outputs. E1–E5 remain offline research. S1–S5 govern trust, performance, accessibility, release and rollback. Do not implement two independent copies of the same decision.

## Proposed sequence — no automatic merge

### Master Gate M0: Freeze V6 and compare same-device baseline BEFORE core refactor

**Files / checks:** existing main; docs/superpowers/plans/2026-10-13-tis-security-performance-release.md task S3; core reliability task R1.

- [ ] **Step 1:** Verify current main SHA, PR state, GitHub Pages and recorded real ONNX smoke; store links/commit IDs in a reviewable baseline note, not personal content.
- [ ] **Step 2:** Run existing V6 test suite in a clean isolated branch/worktree and record fail/pass status without “fixing” unrelated code. New worktree isolation is established using superpowers:using-git-worktrees at execution time if the runtime supports it.
- [ ] **Step 3:** Implement only the test-only R1 characterization fixture and the S3 pre-optimization performance baseline harness. Capture real timings only after actually measuring equal browser/network/device profiles.
- [ ] **Step 4:** Confirm the owner can open a PR with baseline results and current risk register. Do not call a fake baseline an improvement.
- [ ] **Step 5:** Review/checkpoint commit and explicit GO to begin R2.

### Master Gate M1: Refactor core state and evidence with complete compatibility

**Files / checks:** R1–R8 plan, tests/analysis/* plus all current V6 browser tests.

- [ ] **Step 1:** Complete R2/R3/R4 pure modules with TDD, keeping current UI unchanged; an independent code reviewer checks their exact contracts.
- [ ] **Step 2:** Complete R5/R6 isolated bridge/controller; demonstrate cancel, late READY, stale same-length edit, source-import race, timeouts, bad model revisions and fail-closed returns with fake runtime.
- [ ] **Step 3:** Complete R7 projection/coverage and R8 UI adapter migration; only ONE lifecycle owner remains, and model weights/thresholds remain unchanged.
- [ ] **Step 4:** Run full Quality and real downloaded Chromium primary+secondary model smoke, with privacy and DOCX/PDF/OCR/RTL regressions. See each R task for exact commands/assertions.
- [ ] **Step 5:** Independent PR review/acceptance. Owner authorizes any production merge separately; roll back on public errors.

### Master Gate M2: Finish privacy/supply-chain and prove candidate release guards

**Files / checks:** S1, S2 and S5; S4 focused on existing editor while Humanize remains optional.

- [ ] **Step 1:** Implement S1 network and iframe trust-boundary tests with no user-text export.
- [ ] **Step 2:** Implement S2 immutable dependency/model inventory, preserving exact revisions and admitted license limitations.
- [ ] **Step 3:** Implement core S5 release markers, Quality/real-model workflow path filters and public Pages post-deploy smoke. Avoid false PASS from testing old main.
- [ ] **Step 4:** Review privacy disclosure/CSP, browser opt-in and blocked-network behavior; run relevant S tests.
- [ ] **Step 5:** Independent security and release review; no claim of independent detector accuracy.

### Master Gate M3: Add post-scan Humanize with editorial correctness

**Files / checks:** H1–H4 plan and S4 accessibility plan.

- [ ] **Step 1:** Complete H1 local bilingual suggestion contract independent of detector output; protect engineering numbers, citations, names, dates and original style.
- [ ] **Step 2:** Complete H2 revision-safe preview/apply/undo plus read-only DOCX edit/export path. No automatic rescans or source text persistence.
- [ ] **Step 3:** Complete H3 optional three-card Humanize UI and S4 mobile RTL, keyboard, live region and contrast tests; ONE prominent Analyze button remains.
- [ ] **Step 4:** Complete H4 optional comparable raw-signal comparison. Incomparable, unsupported or INCONCLUSIVE scans show comparison unavailable. Run full browser/Word/PDF/OCR and genuine model smoke.
- [ ] **Step 5:** Independent editorial factuality/accessibility/QA review and production acceptance; no promise that a user's AI score will fall.

### Master Gate M4: Independently audit scientific accuracy (parallel with M1–M3)

**Files / checks:** E1–E5 plan and existing backend/research scripts.

- [ ] **Step 1:** Complete E1 provenance/label review without calling weak public labels independent truth.
- [ ] **Step 2:** Complete E2 group-disjoint train/calibration/validation/frozen release split; verify prompt/author/source/generator leakage absence.
- [ ] **Step 3:** Complete E3 stratified FPR/FNR, precision/recall/F1, AUROC, Brier/ECE and confidence/abstention metrics. Clearly separate raw model signals from calibrated estimates.
- [ ] **Step 4:** Complete E4 offline-only calibration study and E5 scientific release gate. If 400+400 independently verified cohort and preregistered performance evidence are absent, mark HOLD/BLOCKED.
- [ ] **Step 5:** Publish aggregate research findings and make a separate scientific model-risk recommendation. DO NOT wire an experimental calibrator into GitHub Pages without later owner approval.

### Master Gate M5: Whole-project acceptance, public deployment, rollback

**Files / checks:** S3/S4/S5, all subplan completion gates; app main unchanged until each approved release.

- [ ] **Step 1:** Run all Node/Python contract + Chromium integration suites, protect no unexpected third-party upload and no hidden source text logging.
- [ ] **Step 2:** Validate V6 baseline vs current changes using real measured performance profiles; >20% median/p95/memory regression triggers review, not ignored numbers.
- [ ] **Step 3:** Run full Quality checks and actual downloaded-model smoke in a candidate PR branch. Confirm outcome contract, one primary button, DOCX/PDF/OCR export, Humanize undo and EN/AR RTL.
- [ ] **Step 4:** Only after owner-approved merge, verify Pages published new exact commit/release marker and actual public-origin real ONNX inference. If any release-critical check fails, immediately STOP rollout and revert that feature PR.
- [ ] **Step 5:** Deliver source-linked report: changed files, actual test/check links, measured performance and scientific uncertainties; close engineering GO/HOLD. Scientific authorship-certification remains on separate approval gate.

## Acceptance evidence index

| Criterion | Objective observable evidence | Fails / hold when |
|---|---|---|
| Immutable revision | R2/R6 same-length, emoji, import, stale request tests PASS | stale AI scores accepted |
| Language/coverage parity | R1/R3/R4/R7 policy and offset tests, default/extended model smoke | unsupported Arabic scored or skipped text hidden |
| Honest abstention | R4/R7/R8 correct null status and visible reason | null coerced to human/AI score |
| One main action | R8/H3/S4 desktop + 390px RTL Chromium visual tests | duplicate prominent analysis buttons |
| Humanize safety | H1/H2/H3 protected claims, reviewed edit, Word read-only and Undo | source rewritten automatically/invented figure |
| Humanize comparison | H4 same-model/options/coverage and explicit rescan tests | raw score change misrepresented as human-authorship proof |
| Data provenance | E1/E2 immutable source/label manifest and group split | source leakage/weak label certified as ground truth |
| Science uncertainty | E3/E4/E5 FPR upper, ECE/Brier + stratification and hold | sample insufficiency framed as 99% accuracy |
| Privacy/security | S1/S2 CSP origin + remote POST audit + licenses | document text transmitted without consent |
| Performance/a11y | S3/S4 reproducible browser benchmark, desktop/mobile RTL | comparable >20% regression unchecked or unusable UI |
| Publication | S5 PR/full CI, real ONNX, Pages and actual deployed URL | baseline public build mistaken for candidate |

## Risks, dependencies and rollback

- R8 must not ship without R1–R7 tests. H2/H3 depend on R2/R8, so no detached Humanize patch to the old duplicated state machine.
- S3 baseline must be measured before claimed performance improvements. Research E can run independently; absence of independent E data does not prevent safe **experimental** UI/refactor fixes from shipping.
- The pre-existing external model/JS CDN is an explicit threat boundary, not an excuse to send user documents to a remote service. Any dependency/vendor swap requires separate measured risk/license review.
- The engineering website is not a certified detector. A single public “AI percentage” is not a factual verdict; refuse production calibration promises until E5 gates pass.
- For each human-approved feature release, record the last known-good main SHA. Revert that release PR squash commit if public checks fail. No database migration is involved.
- Never claim external named experts or a supervised scientific trial were convened by merely following this plan. Review roles are AI/NLP evaluator, application engineer, secure-code reviewer, accessibility/UX, and release QA.

## Owner Review / Execution Choice

This is a written execution plan, not proof of finished software. None of these unchecked steps have been executed, and no product source files, trained model weights or release status were changed while authoring this plan.

After the owner reviews and approves these five plan documents and chooses a supported execution method, implement one task at a time with test-first commits, reviewer gates, and separately authorized merges/deployments.

**Status: AWAITING PLAN APPROVAL AND EXECUTION-METHOD SELECTION.**
