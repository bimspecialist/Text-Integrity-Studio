# Text Integrity Studio Core Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace duplicate detector state and eligibility logic with one locally controlled lifecycle and strictly validated measured evidence, without changing pretrained models or the existing one-button workflow.

**Architecture:** Preserve the GitHub Pages scripts and the current TIS_BROWSER_AI_V1 iframe protocol. Add small UMD/CommonJS-compatible pure modules, test their contracts independently, then migrate the existing UI through one controlled compatibility adapter. Preserve DOCX/PDF/OCR semantics and avoid a full front-end rewrite.

**Tech Stack:** Plain JavaScript ES2022, browser DOM and CustomEvent, same-origin iframe/postMessage, ONNX via pinned Transformers.js runtime, Node.js 22 assertions, Puppeteer Chromium, GitHub Actions.

**Spec:** docs/superpowers/specs/2026-10-13-tis-path-a-reliability-design.md, sections 2-7, 9-12. Coordinate with docs/superpowers/plans/2026-10-13-tis-natural-writing-advisor.md after task R2.

## Global Constraints

- Existing V6 live production baseline: main 8d08635bd2adf3e32e22ba3735a0049ea6b22b4c. Do not change main until all release gates pass.
- Exactly ONE visible primary Analyze Text action, original dark EN/AR/RTL styling, hidden advanced controls and working DOCX/PDF/OCR/export.
- Existing model ID and pinned revision: primary onnx-community/tmr-ai-text-detector-ONNX @ b9aa251e5bcda7e429fcc936767d921435945b60; secondary historical onnx-community/roberta-base-openai-detector-ONNX @ 54895bd11f34b47a01369d25b2255224717409b8.
- Eligibility and sampling policy fixed in this release: 120-word English minimum; max 120000 JavaScript UTF-16 code units; max 448 model tokens per window; 12 sampled windows by default or 96 extended; withhold document-wide number below 60% actual sampled-word coverage. Do not silently change any existing comparison threshold.
- Keep classifier signal labeled NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE, never “percent AI-authored.” INCONCLUSIVE/UNSUPPORTED/ERROR/CANCELLED have no document-wide number.
- Browser model loading remains opt-in and local; no upload, user-text logging, new cloud endpoint, login, or persistent original document storage. External model/runtime downloads are different from sending text.
- Outer CSP stays script-src 'self', connect-src 'self', style-src 'self'; review iframe runtime CSP independently.
- Original model result channel TIS_BROWSER_AI_V1 remains compatible initially. New modules are first-party UMD/CommonJS; do not introduce a bundler.
- Regression commands on repository root: node tests/ai-evidence-core.test.js; node tests/browser-ai-engine.test.js; node tests/browser-ai-ui.test.js; node tests/v6-docx-layout-and-evidence.test.cjs; node tests/approved-v5-one-click.test.cjs. Real downloaded-model smoke: node tests/browser-ai-live.test.js with puppeteer-core@25.13.0 and Chromium configured as existing workflow.
- Each task receives its own tests, a reviewer gate and a small commit. Keep a rollback-compatible refactor branch. Never mix model weight/threshold changes with these PRs.

## Review Focus

1. Same-length content edits containing surrogate pairs or Arabic combining marks must increment a snapshot revision; stale results never appear. Task R2 tests test_same_length_utf16_edit.
2. READY/RESULT/ERROR messages delivered late after Cancel or a new iframe must not start or complete an old request. Tasks R5/R6 tests test_old_ready_and_result_ignored and test_cancel_then_late_error.
3. Loading a DOCX while ONNX is analyzing must immediately invalidate the old result without changing the user's original Word bytes. Tasks R2/R8 tests test_import_during_inference.
4. NaN, Infinity, unknown model revisions, invalid offset ranges or contradictory score/status combinations must fail closed, with no “0% fallback.” Task R4 tests test_invalid_evidence_fail_closed.
5. Long mixed RTL/Latin text with a stray emoji or UTF-16 boundary near a token-window edge must keep exact source offsets; unseen fragments remain unscored. Tasks R2/R7 tests test_utf16_offsets_and_unscanned_spans.

---

### Task R1: Freeze current V6 contracts before refactoring

**Files:**
- Create: tests/analysis/baseline-parity.test.js
- Modify: .github/workflows/quality.yml
- Read-only reference: docs/ai-evidence-core.js, docs/browser-ai-runtime.js, docs/ai-score-ui.js

**Interfaces:**
- Consumes: current TISEvidenceCore.eligibility, partitionWindows, consensus; public DOM IDs source, scanAI, aiMeter, studioAiQuickValue.
- Produces: fixed characterization tests/fixtures that subsequent tasks must preserve.

- [ ] **Step 1: Write characterization assertions** for English >=120 words, short English MIN_WORDS, Arabic and mixed UNSUPPORTED_LANGUAGE, >120000 UTF-16 characters TEXT_TOO_LONG, 448-token upper bound and 12/96 sample caps, 59.9% abstention vs 60% eligibility, model disagreement => null overall score. Use Node assert/strict and the actual exported core functions.
- [ ] **Step 2: Run** node tests/analysis/baseline-parity.test.js. Expected: PASS on existing V6 behavior; if it fails, fix the fixture or document an actual defect before implementing a new policy.
- [ ] **Step 3: Register this file** under a “Frozen V6 detector characterization” step in .github/workflows/quality.yml. Keep all existing steps.
- [ ] **Step 4: Run** node tests/analysis/baseline-parity.test.js && node tests/ai-evidence-core.test.js. Expected: both PASS, no unexpected source file changes.
- [ ] **Step 5: Commit** only the characterization test and CI registration: git add tests/analysis/baseline-parity.test.js .github/workflows/quality.yml && git commit -m "test: freeze V6 detector behavior before lifecycle refactor".

### Task R2: Introduce immutable local DocumentSession

**Files:**
- Create: docs/analysis/document-session.js
- Create: tests/analysis/document-session.test.js

**Interfaces:**
- Produces UMD global TISDocumentSession and Node module export with createDocumentSession(initialText='',sourceKind='paste').
- Returned Session implements read(): frozen DocumentSnapshot; replaceText(text,sourceKind='paste'): DocumentSnapshot; subscribe(listener): unsubscribe function. Snapshot fields: revision (nonnegative increasing integer), text (exact UTF-16 string), sourceKind one of paste/txt/docx/pdf/ocr, paragraphs frozen array of {start,end}, createdAt. No automatic browser storage.
- Later tasks use read().revision and read().text to reject old evidence.

- [ ] **Step 1: Write failing tests** test_same_length_utf16_edit, test_import_during_inference, test_utf16_offsets_and_unscanned_spans, test_original_text_not_normalized, test_source_kind_changes_revision, test_read_snapshot_frozen and test_subscription_unsubscribes. A same-length swap (e.g., letter changed but equal length) changes revision; an emoji counts two JS code units; imported DOCX paragraph offsets match exact source substrings.
- [ ] **Step 2: Run** node tests/analysis/document-session.test.js. Expected: FAIL because document-session.js or createDocumentSession does not yet exist.
- [ ] **Step 3: Implement** createDocumentSession and pure paragraph-boundary extraction in docs/analysis/document-session.js; use explicit [start,end) offsets, preserve CRLF/text exactly and freeze snapshot objects. Notify subscribers only when an actual text/source-kind change happens.
- [ ] **Step 4: Run** node tests/analysis/document-session.test.js && node tests/word-docx.test.js. Expected: PASS; no production DOM wiring yet.
- [ ] **Step 5: Commit** document-session.js and its tests with git commit -m "feat: add immutable revisioned local document snapshots".

### Task R3: Unify eligibility into one shared decision policy

**Files:**
- Create: docs/analysis/eligibility-policy.js
- Create: tests/analysis/eligibility-policy.test.js
- Modify: docs/ai-score-ui.js, docs/studio-insights-ui.js, docs/index.html

**Interfaces:**
- Consumes TISEvidenceCore.eligibility(text) from docs/ai-evidence-core.js.
- Produces TISEligibilityPolicy.assess(text,sourceKind='paste') returning {eligible:boolean,reason:'NONE'|'NO_TEXT'|'MIN_WORDS'|'TEXT_TOO_LONG'|'UNSUPPORTED_LANGUAGE'|'UNSUPPORTED_FORMAT',words:number,characters:number,languageClass:'en'|'ar'|'mixed'|'other'|'unknown',policyVersion:'TIS_ELIGIBILITY_V2'}.
- The iframe runtime already loads and uses docs/ai-evidence-core.js. The OUTER docs/index.html does NOT currently load that core: R3 must add ai-evidence-core.js as a same-origin parent-page script BEFORE eligibility-policy.js. The outer page mirrors the same core result; languageClass is descriptive and must not override the decision.

- [ ] **Step 1: Write failing tests** test_same_reason_in_all_surfaces, test_short_english_vs_arabic, test_mixed_text_rejected, test_length_boundary_120000, test_no_text, test_supported_docx_import and test_unknown_sourcekind_unsupported. Assert byte-for-byte reason parity against core. Include review of the existing misleading Arabic threshold comment; do not alter behavior.
- [ ] **Step 2: Run** node tests/analysis/eligibility-policy.test.js. Expected: FAIL on missing TISEligibilityPolicy.assess.
- [ ] **Step 3: Implement** assess as a wrapper over the existing core decision and descriptive classification; load the first-party script after ai-evidence-core.js and before the two UI consumers. Replace ai-score-ui.eligible and studio-insights-ui.readinessNote duplicated decisions with assess calls while retaining localized message text. Ensure docs/index.html explicitly loads ai-evidence-core.js in the parent context before eligibility-policy.js; the iframe retains its existing separate import.
- [ ] **Step 4: Run** node tests/analysis/eligibility-policy.test.js && node tests/scan-ai-workflow.test.cjs && node tests/ai-evidence-core.test.js. Expected: PASS; no new model download for rejected inputs.
- [ ] **Step 5: Commit** with git commit -m "refactor: reuse canonical English eligibility across UI".

### Task R4: Strict versioned EvidenceValidator, fail-closed by construction

**Files:**
- Create: docs/analysis/evidence-contract.js
- Create: tests/analysis/evidence-contract.test.js
- Read-only references: docs/browser-ai-runtime.js model definitions, docs/ai-evidence-core.js statuses

**Interfaces:**
- Produces TISEvidenceContract.validateEvidence(raw,snapshot,meta).
- meta has requestId, revision, scanOptions:{deep:boolean,full:boolean,context:string}, expectedPrimaryId, expectedPrimaryRevision, optional expectedSecondaryId and expectedSecondaryRevision. Returns {ok:true,outcome:{kind:'RESEARCH_SIGNAL'|'INCONCLUSIVE',signal:number|null,reason:string|null,calibration,primary,secondary,segments,documentCoverageWordsPercent,scanOptions,requestId,revision}} or {ok:false,code:string}.
- Allow RESEARCH_SIGNAL only for raw.status SINGLE_UNCALIBRATED_MODEL / AGREEMENT_UNCALIBRATED / SECONDARY_UNAVAILABLE with finite 0..100 raw.score. Require null score for INSUFFICIENT_COVERAGE / HETEROGENEOUS_DOCUMENT / MODEL_DISAGREEMENT. All revisions are checked against the actual primary.revision and secondary.revision returned by the pinned model runtime. Do not allow a missing revision to be labeled pinned evidence.
- Do not conflate words-based document coverage with UTF-16 character coverage in an individual paragraph.

- [ ] **Step 1: Write failing tests** test_invalid_evidence_fail_closed (NaN, Infinity, negatives, >100), test_unknown_model_revision, test_conflicting_score_status, test_bad_segment_offset, test_out_of_range_coverage, test_mismatched_request_and_snapshot_revision, test_valid_primary_and_optional_legacy, test_scan_options_preserved_for_comparison and test_inconclusive_stays_null. Construct synthetic raw results using exact V2 property names, including primary.model_id, primary.revision and raw.calibration.
- [ ] **Step 2: Run** node tests/analysis/evidence-contract.test.js. Expected: FAIL because TISEvidenceContract.validateEvidence is missing.
- [ ] **Step 3: Implement** validateEvidence as a pure module with an explicit allowed-status map; reject invalid records rather than coerce. Validate source spans as JS UTF-16 [start,end), full model revisions, and numeric coverage denominator. Do not assume a result is independently calibrated.
- [ ] **Step 4: Run** node tests/analysis/evidence-contract.test.js && node tests/browser-ai-engine.test.js. Expected: PASS; original model calculation unchanged.
- [ ] **Step 5: Commit** with git commit -m "feat: validate raw detector evidence before UI projection".

### Task R5: Isolate the existing iframe protocol inside InferenceBridge

**Files:**
- Create: docs/analysis/inference-bridge.js
- Create: tests/analysis/inference-bridge.test.js
- Read-only: docs/ai-runtime.html, docs/browser-ai-runtime.js

**Interfaces:**
- Produces TISInferenceBridge.createInferenceBridge({documentObject,origin,container,src='ai-runtime.html',onEvent}).
- Returned Bridge: run(snapshot,{deep=false,full=false,context='general'},requestId):void; cancel(requestId):void; dispose():void. onEvent receives {op:'READY'|'PROGRESS'|'RESULT'|'ERROR'|'CANCELLED',requestId,payload}; dispatches no user text to external origins.
- Must keep channel TIS_BROWSER_AI_V1, same-origin source checks, one active iframe and the runtime's existing cancellation protocol. Run state is owned by the controller in R6, NOT by this transport.

- [ ] **Step 1: Write failing tests** test_old_ready_and_result_ignored, test_cancel_then_late_error, test_reject_cross_origin_and_wrong_source, test_one_run_per_ready, test_worn_out_iframe_recreated_after_timeout, and test_optin_only_model_loading. Use a minimal fake document/iframe or Puppeteer fixture; never make a genuine remote model call for unit tests.
- [ ] **Step 2: Run** node tests/analysis/inference-bridge.test.js. Expected: FAIL because createInferenceBridge is missing.
- [ ] **Step 3: Implement** iframe lifecycle, origin/source/channel checks, run/cancel/abort bookkeeping and a single progress callback. Keep readiness/inference timeouts centralized at the controller boundary; do not copy user text into logs.
- [ ] **Step 4: Run** node tests/analysis/inference-bridge.test.js && node tests/browser-ai-engine.test.js. Expected: PASS with unchanged runtime protocol.
- [ ] **Step 5: Commit** with git commit -m "refactor: isolate same-origin on-device model transport".

### Task R6: Canonical AnalysisController and race-safe state machine

**Files:**
- Create: docs/analysis/analysis-controller.js
- Create: tests/analysis/analysis-controller.test.js

**Interfaces:**
- Consumes session.read() and .subscribe(), policy.assess(), bridge.run()/cancel(), contract.validateEvidence().
- Produces TISAnalysisController.createAnalysisController({session,policy,bridge,validator,onState,onWritingReview,clock=Date}). Methods analyze({deep=false,full=false,context='general'}={}):void; cancel():void; getState():frozen state; dispose():void.
- Legal states: EMPTY, READY, WRITING_ONLY, UNSUPPORTED, LOADING, ANALYZING, RESEARCH_SIGNAL, INCONCLUSIVE, CANCELLED, ERROR, STALE. State includes requestId/revision, signal or null, eligible reason, progress stage, error code and never raw text.
- Watchdogs initially 30000ms iframe init; 180000ms inference inactivity; 540000ms absolute runtime. Deterministic fake clock for tests.

- [ ] **Step 1: Write failing tests** test_exactly_one_active_run, test_same_length_text_edit_stales_result, test_import_during_inference, test_cancel_then_late_error, test_loading_watchdogs_and_retry, test_no_text_leads_writing_only_without_bridge, test_deep_option_preserved, test_null_abstention_preserved and test_state_never_contains_text. Use a fake bridge and fake clock; exercise status and requestId ordering.
- [ ] **Step 2: Run** node tests/analysis/analysis-controller.test.js. Expected: FAIL on missing createAnalysisController.
- [ ] **Step 3: Implement** a pure reducer and event dispatcher that owns all state transitions and timers; initialize EMPTY/READY from session; writing review callback is allowed for all nonempty text; eligibility controls optional inference only. On any session revision change, cancel and mark STALE; validate raw RESULT through R4.
- [ ] **Step 4: Run** node tests/analysis/analysis-controller.test.js && node tests/analysis/inference-bridge.test.js. Expected: PASS without a browser UI.
- [ ] **Step 5: Commit** with git commit -m "feat: introduce single revision-safe analysis lifecycle".

### Task R7: One coverage projection and truthful result presentation

**Files:**
- Create: docs/analysis/evidence-projection.js
- Create: tests/analysis/evidence-projection.test.js
- Modify: docs/v5-public.js, docs/studio-insights-ui.js

**Interfaces:**
- Consumes DocumentSnapshot.paragraphs and validated Outcome from R4.
- Produces TISEvidenceProjection.projectEvidence(snapshot,outcome,{maxOverviewSections=8}={}): {sections:[{id,start,end,windowSignal:null|number,coveredCharacters:number,paragraphCoverageCharactersPercent:number}],documentCoverageWordsPercent:number|null,hasPartialSampling:boolean}.
- UI retains real V6 labels and sources. For overlapping windows, compute union character coverage (avoid double counting). A paragraph with <60% measured character coverage must show null local signal. Long-document overview distributes selected paragraphs across the document, not just its first page. Word-based global coverage remains separate.

- [ ] **Step 1: Write failing tests** test_utf16_offsets_and_unscanned_spans, test_window_overlap_not_double_counted, test_paragraph_under60_unscored, test_long_doc_samples_begin_middle_end and test_inconclusive_shows_evidence_but_no_document_score. Use exact spans, a surrogate pair near a boundary, and a synthetic eight-section DOCX-equivalent string.
- [ ] **Step 2: Run** node tests/analysis/evidence-projection.test.js. Expected: FAIL because projectEvidence is missing.
- [ ] **Step 3: Implement** projection without changing the consensus score. Replace duplicated paragraph intersection calculations in v5-public.js and studio-insights-ui.js with this single result; keep exact existing DOM hooks and the INCONCLUSIVE em-dash ring.
- [ ] **Step 4: Run** node tests/analysis/evidence-projection.test.js && node tests/v6-docx-layout-and-evidence.test.cjs && node tests/studio-insights-browser.test.js. Expected: PASS.
- [ ] **Step 5: Commit** with git commit -m "refactor: centralize sampled-passage evidence projection".

### Task R8: Wire the controller to the one-button app, remove competing lifecycle owners

**Files:**
- Create: docs/analysis/app-adapter.js
- Create: tests/analysis/analysis-integration-browser.test.cjs
- Modify: docs/index.html, docs/ai-score-ui.js, docs/studio-insights-ui.js, docs/v5-public.js, .github/workflows/quality.yml, .github/workflows/live-browser-ai.yml, .github/workflows/deployed-ai-diagnostic.yml
- Verify without deleting: docs/word-docx.js, docs/pdf-support.js, docs/writing-lab.js, docs/app.js

**Interfaces:**
- Consumes createDocumentSession, assess, createInferenceBridge, validateEvidence, createAnalysisController and projectEvidence.
- Produces browser app adapter TISAnalysisApp.attach({source,scanButton,fileInput,resultsRoot}) returning {controller,dispose}; a single source of truth for the Analyze/Cancel label, progress, eligibility, result, advanced details and input revision.
- Keep DOM IDs scanAI, source, aiEvidence, studioAiQuickValue, v5BreakdownRows, v5Toolbox and original export hooks. Keep the same model/runtime protocol.

- [ ] **Step 1: Write failing integration browser tests** test_one_visible_analyze_button, test_short_and_arabic_writing_only, test_import_during_inference, test_double_click_and_cancel, test_same_length_edit_discards_late_result, test_true_result_shows_coverage, test_bad_revision_hides_signal, test_single_Cancel_label, and test_docx_pdf_ocr_accessible. Mock iframe only for fast integration; preserve the separate real-model test.
- [ ] **Step 2: Run** node tests/analysis/analysis-integration-browser.test.cjs. Expected: FAIL before app-adapter and its script binding exist.
- [ ] **Step 3: Implement** app-adapter; register first-party scripts in dependency order (core -> session -> eligibility -> evidence validator -> bridge -> controller -> projection -> app adapter -> presenters). Move existing ai-score-ui event/running logic behind the controller; keep its evidence DOM/export as a presenter-only compatibility adapter. Move old per-file lifecycle mutations out of studio-insights-ui.js and v5-public.js, and make display updates derive from controller state. Ensure all imported/file-edited text dispatches through the same session.
- [ ] **Step 4: Run** node tests/analysis/analysis-integration-browser.test.cjs && node tests/browser-ai-ui.test.js && node tests/scan-ai-workflow.test.cjs && node tests/v6-docx-layout-and-evidence.test.cjs && node tests/approved-v5-one-click.test.cjs && node tests/security-static.test.js. Expected: all PASS with zero accidental downloads before opt-in. Register new tests in Quality; extend Live optional AI browser model smoke path filters for docs/analysis/**/*.js; trigger the existing real ONNX and post-deploy gates in the isolated PR.
- [ ] **Step 5: Commit** via git add docs/analysis/ docs/index.html docs/ai-score-ui.js docs/studio-insights-ui.js docs/v5-public.js tests/analysis/ .github/workflows/ && git commit -m "refactor: connect one-button editor to canonical analysis controller".

## Subsystem Completion Gate

- All 8 task commits and code reviews complete, module signatures mutually consistent, and imported Word/PDF/OCR tests green.
- Run the full Quality workflow on the PR head; do not hide failures by making steps nonblocking.
- Run Live optional AI browser model smoke with actual downloaded weights for BOTH models.
- Confirm a 150-word eligible fixture returns measured evidence or an explicit abstention, never synthetic “authorship confidence.”
- Before merge, check same-length edit/cancel/request-race stress results, source offsets/coverage and no new source-text logs.
- After human-approved merge only, verify GitHub Pages success and deployed-origin smoke. Roll back on public regression; never merge the next subsystem over a failing gate.
- PASS on this engineering gate does NOT grant permission to advertise scientifically calibrated authorship accuracy.

**Status:** IMPLEMENTATION PLAN FOR REVIEW; NOT AUTHORIZATION TO CHANGE PRODUCT CODE.
