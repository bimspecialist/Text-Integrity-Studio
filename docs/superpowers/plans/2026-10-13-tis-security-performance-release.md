# Text Integrity Studio Security, Performance and Release-Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Prove that the reliability and Humanize changes remain private, secure, responsive and accessible on the real GitHub Pages site, with meaningful fail-closed CI and post-deployment acceptance gates.

**Architecture:** Keep the existing GitHub Pages and browser-embedded ONNX runtime. Add network/privacy assertions, a pinned dependency inventory, reproducible desktop/mobile benchmarks, and release checks around the existing workflows rather than a new backend or a general CI rewrite.

**Tech Stack:** Static first-party HTML/CSS/JS, GitHub Pages, Chromium Puppeteer, Node.js 22 assertions, GitHub Actions, Python offline research evidence, restrictive CSP, pinned same-origin Word/PDF/OCR asset loaders.

**Spec:** docs/superpowers/specs/2026-10-13-tis-path-a-reliability-design.md, sections 9-12. Integrates completed/reviewed work from the core reliability and Natural-Writing Advisor plans. The research evaluation can be reviewed in parallel.

## Global Constraints

- GitHub Pages stays the public host; there is no server for document upload, model inference, account or session storage.
- All original text, file bytes and private proposed edits remain in local browser memory; local model downloads are allowed only after the explicit Analyze action.
- Outer-page CSP: script-src 'self', connect-src 'self', style-src 'self'. Runtime iframe origins, privileges and allowed model/CDN requests require separate documented inspection; sandbox flags are not a complete security boundary.
- Keep opt-in pinned primary and historical model IDs/revisions: b9aa251e5bcda7e429fcc936767d921435945b60 and 54895bd11f34b47a01369d25b2255224717409b8, Transformers.js 3.8.1 currently delivered via CDN. Do not silently upgrade a model or dependency while refactoring.
- Existing dark website, first-party Manrope + IBM Plex Sans Arabic, one visible Analyze button, progress accessibility, EN/AR RTL, Word/PDF/OCR and original report export remain working.
- Current planned device profiles: desktop Chromium 1440x900 and low/mid-spec emulated mobile 390x844. Real hardware measurements are preferred for peak memory, which browser harnesses may not expose reliably.
- Benchmark lengths: fixed eligible 150 words, 2000 words, 20000 words and a near-limit <=120000-character document. Keep cold/warm downloads distinct. Investigate a >20% median or p95 runtime/memory deterioration on like-for-like conditions; do not fabricate absolute timings or bytes.
- Public release requires Quality, real downloaded Chromium ONNX model smoke (both models) and post-deploy public-origin AI scan. A PR check of the OLD published main must not be mistaken for candidate validation.
- Science remains separate: engineering release success never authorizes independently calibrated AI-authorship percentages or accusations.

## Review Focus

1. A malicious uploaded DOCX/PDF containing HTML/links/embedded text must not inject script or send extracted source to a remote origin. Task S1 tests untrusted_document_content_never_executes.
2. A runtime message with correct requestId but wrong event.source, origin or model revision must be rejected without rendering an AI score. Tasks S1/S5 tests spoofed_message_fail_closed.
3. A browser blocking CDN/model fetches must provide an actionable retry error; it may still perform local editorial review, without a fake percentage. Tasks S1/S5 tests cdn_blocked_falls_back_to_editorial.
4. A cold-start mobile scan near size limits may time out or be cancelled without freezing the editor; coverage and partiality must be disclosed. Task S3 tests low_memory_cancel_responsive.
5. Arabic RTL with a long DOCX and a Humanize suggestion open must keep keyboard focus order, no overlap or x-scroll and full text labels. Task S4 tests rtl_long_docx_accessibility.

---

### Task S1: Privacy and iframe trust-boundary regression

**Files:**
- Create: tests/analysis/privacy-network.test.cjs
- Create: docs/security/LOCAL_MODEL_THREAT_MODEL.md
- Modify as needed: docs/ai-runtime.html, docs/privacy.html, tests/security-static.test.js
- Read-only references: docs/browser-ai-runtime.js, docs/analysis/inference-bridge.js, docs/pdf-support.js, docs/word-docx.js

**Interfaces:**
- Browser test observes all request domains, methods and body metadata (NEVER persists actual text) before Analyze, during model download and after file import.
- Threat-model document enumerates trust boundaries: same-origin page -> iframe, CDN runtime/ONNX model assets, untrusted uploaded parsers, Blob report exports, browser cache and extension interference.

- [ ] **Step 1: Write failing tests** no_remote_requests_before_optin, no_user_text_in_remote_post, untrusted_document_content_never_executes, spoofed_message_fail_closed, cdn_blocked_falls_back_to_editorial, and no_text_in_default_diagnostic. Use only disposable synthetic fixture text; assert no copied text in logs, artifact names or URLs.
- [ ] **Step 2: Run** node tests/analysis/privacy-network.test.cjs. Expected: FAIL before the new privacy guards/diagnostics are fully wired.
- [ ] **Step 3: Implement** least-privilege origin/source/request guards around the inference bridge; document model/runtime cross-origin asset downloads; make errors localized/retryable and remove any accidental source excerpt telemetry. Preserve necessary CDN model access after explicit opt-in and never imply allow-scripts+allow-same-origin gives hard process isolation.
- [ ] **Step 4: Run** node tests/analysis/privacy-network.test.cjs && node tests/security-static.test.js && node tests/browser-ai-engine.test.js. Expected: PASS with real editor still functional when model assets are blocked.
- [ ] **Step 5: Commit** with git commit -m "security: assert local document privacy and trusted on-device runtime messages".

### Task S2: Immutable model/dependency provenance gate

**Files:**
- Create: docs/security/DEPENDENCY_AND_MODEL_MANIFEST.json
- Create: tests/analysis/model-provenance.test.js
- Modify: .github/workflows/quality.yml, .github/workflows/live-browser-ai.yml
- Read-only: docs/fonts/*-OFL.txt, docs/vendor/JSZIP_LICENSE.txt, docs/vendor/pdfjs/LICENSE, docs/browser-ai-runtime.js, docs/index.html

**Interfaces:**
- Produces a human-reviewed inventory of first-party script paths, runtime CDN version, model IDs/revisions and declared source/trust/license status. Every dependency entry has type, source URI, locked version/revision, purpose, and evidence/limitations.
- Verification code verifyModelManifest(manifest,sourceFiles): {ok:boolean,violations:string[]} ensures runtime model constants and CDN package version exactly match expected pinned entries; no invented asset hash or SRI for a binary not actually hashed.
- Manifest license metadata is grounded in retrieved upstream license files; absent license is UNKNOWN and release-review blocking, never guessed.

- [ ] **Step 1: Write failing tests** primary_revision_must_match, secondary_revision_must_match, unknown_model_refused, transformers_runtime_version_pinned, first_party_font_license_present, no_unverified_model_license_marked_valid and no_unreviewed_cdn_swap.
- [ ] **Step 2: Run** node tests/analysis/model-provenance.test.js. Expected: FAIL before the manifest/verification interface exists.
- [ ] **Step 3: Implement** metadata inventory and checks; keep code and weights pinned. If a new upstream license, CDN route or model asset cannot be verified, record it as an unresolved release blocker rather than claiming that pinning alone proves supply-chain security. Vendoring executable code or SRI may be proposed in a separate reviewed change if feasible.
- [ ] **Step 4: Run** node tests/analysis/model-provenance.test.js && node tests/security-static.test.js. Expected: PASS only when all pin/license evidence matches actual files; do not weaken CSP to make a test green.
- [ ] **Step 5: Commit** with git commit -m "security: lock and audit runtime-model supply-chain metadata".

### Task S3: Reproducible desktop/mobile cold and warm performance bench

**Files:**
- Create: tests/analysis/performance-browser.test.cjs
- Create: docs/research/performance-baseline-schema.json
- Create: tests/analysis/performance-budget.test.js
- Modify: .github/workflows/quality.yml (lightweight deterministic mode only)
- Generate upon real runs: docs/research/performance-v6-baseline.json (aggregate data only; not a fabricated prefilled file)

**Interfaces:**
- Test command: node tests/analysis/performance-browser.test.cjs, with env TIS_PERF_REAL_MODEL=1 for explicitly authorized heavyweight real download; default is synthetic local runtime/mock, marked NON_REAL_PERFORMANCE.
- Metadata-only measurement JSON: {version,modelRevisions,deviceProfile,browserVersion,networkProfile,documentWordCount,documentCharacterCount,coldStart,downloadBytesIfObserved,medianMs,p95Ms,peakHeapBytesIfAvailable,measurementMethod,runs,notes}.
- Budget gate comparePerf(baseline,candidate,{maxRegressionRatio:1.20}={}): {pass:boolean,reasons:string[]} compares like-for-like real runs; unknown baseline => NO_BASELINE, not PASS. Never use data from different Chrome/network profiles as a performance improvement claim.

- [ ] **Step 1: Write failing tests** baseline_missing_is_unverified, mismatch_browser_profile_not_comparable, 21_percent_regression_requires_review, p95_vs_median_distinguished, peak_heap_unavailable_is_unknown, low_memory_cancel_responsive and no_source_text_in_artifacts. Include 150/2000/20000-word and near-120000-char fixtures.
- [ ] **Step 2: Run** node tests/analysis/performance-budget.test.js. Expected: FAIL because comparePerf and baseline schema do not exist.
- [ ] **Step 3: Implement** the reproducible benchmark harness with real vs mock flags, cold/warm cache policies, bounded input fixtures, abort/cancel probes and aggregate-only outputs. Establish V6 real baseline **BEFORE** optimizing the new modules and explicitly note unmeasurable peak heap metrics.
- [ ] **Step 4: Run** node tests/analysis/performance-budget.test.js && node tests/analysis/performance-browser.test.cjs. Expected: PASS for logic/fixtures. Run TIS_PERF_REAL_MODEL=1 node tests/analysis/performance-browser.test.cjs in a separately approved environment; do not claim actual real-model performance if not executed.
- [ ] **Step 5: Commit** tests/schema and only genuinely measured baseline metadata with git commit -m "perf: add reproducible runtime and memory regression harness".

### Task S4: Browser accessibility and bilingual/RTL safety review

**Files:**
- Create: tests/analysis/accessibility-browser.test.cjs
- Modify: docs/index.html, docs/v5-public.css, docs/analysis/humanize-ui.js (only if accessibility fixes are evidenced)
- Preserve: docs/app.css, docs/v5-public.js and existing one-button design
- Modify: .github/workflows/quality.yml

**Interfaces:**
- Reads HTML focus order, role/status live regions, keyboard controls, mobile geometry, locale labels and reduced-motion state; no new primary controls.
- Test screens: desktop 1440x900; desktop 1736x900 DOCX; mobile 390x844 in EN and AR RTL, including inconclusive evidence and open Humanize details.

- [ ] **Step 1: Write failing tests** rtl_long_docx_accessibility, keyboard_open_preview_undo, cancel_button_focus_kept, scan_status_screenreader_live_region, aria_labels_no_duplicate_primary_action and no_horizontal_overflow_at390. Check visible text and controls rather than pixel identity only.
- [ ] **Step 2: Run** node tests/analysis/accessibility-browser.test.cjs. Expected: FAIL before missing semantics/focus handling are corrected.
- [ ] **Step 3: Implement** only demonstrated accessibility fixes, including focus management after model completion/cancel, error announcements, contrast/focus-visible and Arabic label parity, without changing approved dark brand layout.
- [ ] **Step 4: Run** node tests/analysis/accessibility-browser.test.cjs && node tests/approved-v5-one-click.test.cjs && node tests/v6-docx-layout-and-evidence.test.cjs. Expected: PASS and screenshots with no clipped text.
- [ ] **Step 5: Commit** with git commit -m "a11y: preserve keyboard and RTL access during local text review".

### Task S5: Release gates, whole-project regression and rollback contract

**Files:**
- Create: docs/release/PATH_A_RELEASE_CHECKLIST.md
- Create: tests/analysis/public-postdeploy-contract.test.cjs
- Modify: .github/workflows/quality.yml, .github/workflows/live-browser-ai.yml, .github/workflows/deployed-ai-diagnostic.yml, tests/deployed-ai-runtime.test.cjs
- Verify read-only: .github/workflows/pages-build-deployment integration as returned by GitHub (do not invent a repository workflow file), backend/research/release_decision.py

**Interfaces:**
- Public smoke checker verifyPublishedApp({url,requiredReleaseMarker,fixtureMode:'public-nonprivate'}): {loaded,releaseMarkerMatched,modelInferenceObserved,consoleErrors,failedNetworkHosts,status}. The checker must inspect a unique shipped release marker and use real inference; PR preview checks may not substitute a baseline production check.
- Two distinct gates: Engineering GO (working experimental site) and Scientific HOLD (authorship-calibration claim blocked until signed review of independent data).
- Rollback contract: identify last known-good main commit and release marker before any merge; revert the candidate squash commit on failure. No private text, credentials or per-document AI scores in archived CI artifacts.

- [ ] **Step 1: Write failing tests** release_marker_must_match_candidate, baseline_site_is_not_candidate, real_model_required_not_mocked, spoofed_message_fail_closed, blocked_download_fails_gracefully, DOCX_OCR_regression_blocks_merge and research_hold_does_not_block_safe_ui_clarity_releases.
- [ ] **Step 2: Run** node tests/analysis/public-postdeploy-contract.test.cjs. Expected: FAIL until release marker/smoke gate are implemented.
- [ ] **Step 3: Implement** candidate-specific release marker wiring, live-model PR path filters including all new docs/analysis/*.js and Humanize modules, the deployed-origin post-Pages smoke, and a checklist separating engineering approval from scientific certification. Keep failure blocking, not continue-on-error, for main deployment checks. Preserve all preexisting Quality steps.
- [ ] **Step 4: Run** node tests/analysis/public-postdeploy-contract.test.cjs && node tests/deployed-ai-runtime.test.cjs with a controlled public fixture only after a genuine Pages deployment; trigger full Quality and Live optional AI browser model smoke via GitHub Actions. Expected: both real primary and secondary weights run successfully and the main public origin has the new release marker. Record actual link/commit/UTC time before claiming completion.
- [ ] **Step 5: Commit** with git commit -m "release: enforce genuine post-Pages and scientific-hold gates".

## Overall Release Gate — Complete Path A

- No implementation branch may merge while its required new/existing tests fail. For each task, an independent reviewer checks the exact change, its tests and its effect on other subsystems.
- Run baseline parity, state/cancel/revision, eligibility, raw evidence validator, coverage projection, editorial Humanize, protected claims, Word/PDF/OCR, RTL, privacy and research decision tests.
- Run true download/inference for both pinned ONNX models with actual browser assets. Stub-only smoke is insufficient.
- Compare measured performance on equal device/browser/network profiles, and investigate >20% runtime or memory regressions; do not invent numbers when real measurements are missing.
- Confirm first-party font/CSP/model licenses, no unconsented private text upload, no source snippets in diagnostics and no additional main UI button.
- After human-authorized merge, verify GitHub Pages and the candidate-specific public-origin runtime; record log URLs. Roll back on a public-site blocker.
- Keep research accuracy status EXPERIMENTAL/HOLD until independently verified cohort and calibration gates pass. The engineering release is explicitly separate from permission to assert “percentage of AI authorship.”

**Status:** IMPLEMENTATION PLAN FOR OWNER REVIEW; NO PRODUCT CODE CHANGES IN THIS PLANNING STEP.
