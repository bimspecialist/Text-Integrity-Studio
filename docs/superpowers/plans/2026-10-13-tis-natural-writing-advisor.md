# Text Integrity Studio Natural-Writing Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** After Analyze Text, provide local, bilingual, source-grounded suggestions for clearer, more natural writing with user-approved Before/After edits, safe Undo and an optional honest rescan comparison. This FAST editorial-advisor subsystem feeds the separately approved two-pane, local-generative workflow, but does not pretend to provide full model rewriting by itself.

**Architecture:** Extend the already-local editorial rules and insights as a small advisor. Keep suggestions separate from AI authorship evidence and never optimize edits against classifier output. Use the canonical DocumentSession from the core reliability plan for revision-safe edits, preserving the read-only Word bridge and the sole prominent Analyze button. The OPTIONAL full ONNX generator and dual-pane integration are specified separately in docs/superpowers/plans/2026-10-13-tis-local-generative-dual-editor.md (L1-L8) and cannot be falsely fulfilled by these H1-H4 heuristics.

**Tech Stack:** Plain JavaScript UMD/CommonJS, existing docs/writing-rules.js and docs/studio-insights-core.js, existing docs/writing-lab.js / TextIntegrityWordBridge, DOM/RTL CSS, Node 22 assertions, Puppeteer Chromium.

**Spec:** docs/superpowers/specs/2026-10-13-tis-path-a-reliability-design.md, subsection 6.1, sections 7, 9-12.

## Global Constraints

- Local-first: never send a pasted document or proposed edit to an inference API. Within H1-H4 no new CDN models; the separate L1-L8 full local generation workstream may download **static** audited ONNX model assets only with explicit user consent. No mandatory backend, user login, hidden text telemetry or persisted private source.
- One prominent Analyze Text button remains unchanged. Humanize is a nonblocking optional follow-up section: **Make writing more natural / اجعل الكتابة أكثر طبيعية**, up to 3 top suggestions initially.
- English and Arabic advice supported, including academic/formal writing and appropriate dialect. The AI authorship detector remains English-only, >=120 words and <=120000 JS UTF-16 characters.
- No invented personal observations, references, figures or sentences presented as facts; no deliberate mistakes/forced slang; protect quotes, citations, dates, units, numbers, URLs, names and technical terms.
- Suggestions are editorial heuristics, NOT evidence that any sentence was written by AI. Their quality KPI is verified clarity/factual preservation and user acceptability, not a lower raw detector score.
- Never automatically apply, automatically rescan, or show “human percentage” as a result of editing. A new Analyze Text click invalidates and refreshes previous evidence.
- Preserve existing DOCX read-only extraction and the explicit approved Word editing/export path; source DOCX bytes are not modified on input.
- Use DocumentSession from docs/analysis/document-session.js and AnalysisController from the approved core reliability plan. If that plan is not complete, this branch may implement pure H1 code/tests, but integration must wait.
- Preserve existing formatting/RTL/current dark design and original Word/PDF/OCR cleanup capabilities. CI and real ONNX smoke must remain green.

## Review Focus

1. A formal engineering paragraph with a date, ISO reference, unit and numeric result must not be silently rewritten or lose citation meaning. Task H1 test protected_academic_claims.
2. A same-length edit between preview and Apply must reject stale ranges, even if the original excerpt still exists elsewhere. Task H2 test same_length_revision_changed.
3. A read-only Word extraction must offer a safe preview/Word export path, never mutate the source textarea or original DOCX bytes. Tasks H2/H3 test docx_requires_word_bridge.
4. A dialectal Arabic sentence should not be force-converted into formal Arabic; explanations may be bilingual without claiming Arabic AI detection. Tasks H1/H3 test dialect_unchanged.
5. When the AI engine is unsupported, incomplete or INCONCLUSIVE, editorial advice still appears and comparison remains unavailable; no “0% human” is shown. Tasks H3/H4 test inconclusive_and_arabic_suggestions.

---

### Task H1: Build the local, human-reviewable suggestion contract

**Files:**
- Create: docs/analysis/natural-writing-advisor.js
- Create: tests/analysis/natural-writing-advisor.test.js
- Read-only references: docs/writing-rules.js, docs/studio-insights-core.js

**Interfaces:**
- Consumes TISDocumentSession.read() snapshot, TextIntegrityRules.analyze(text,mode) and TextIntegrityStudioInsights.analyzeDocument(text,options).
- Produces TISNaturalWritingAdvisor.suggest(snapshot,{locale='en',mode='academic',limit=20}={}): {revision:number,suggestions:EditorialSuggestion[],isPartial:boolean,disclaimer:string}.
- EditorialSuggestion fields: id, revision, category ('clarity'|'rhythm'|'repetition'|'specificity'|'grammar'), section, start, end, original, proposedReplacement:string|null, reason, reasonBasis:'LOCAL_EDITORIAL_HEURISTIC', locale, risk:'low'|'manual', reference:string|null.
- Null proposedReplacement means “human should supply a real example/detail”; never emit invented sample facts as replacement.

- [ ] **Step 1: Write failing tests** protected_academic_claims, avoid_invented_personal_examples, dialect_unchanged, no_deliberate_typos, sentence_length_guidance_no_random_split, repeated_terms_technical_exception, and suggestions_are_source_derived. Test fixture text includes “ISO 9001”, “450 kPa”, quoted speech, equation variables, year 2024, a citation and Arabic academic/dialect phrases. Assert no automatic replacement intersects a protected span.
- [ ] **Step 2: Run** node tests/analysis/natural-writing-advisor.test.js. Expected: FAIL while TISNaturalWritingAdvisor.suggest is missing.
- [ ] **Step 3: Implement** deterministic extraction/ranking of existing rule/insight observations, protected-range checks extended beyond existing unit-marked numbers to unqualified engineering figures and dates, conservative replacement safety and manual-only writing prompts. No detector scores are inputs. Retain original offsets and explicit partial-report flag.
- [ ] **Step 4: Run** node tests/analysis/natural-writing-advisor.test.js && node tests/writing-rules.test.js && node tests/studio-insights-core.test.js. Expected: PASS; all authorship probability fields absent.
- [ ] **Step 5: Commit** via git add docs/analysis/natural-writing-advisor.js tests/analysis/natural-writing-advisor.test.js && git commit -m "feat: local bilingual natural-writing advice without detector optimization".

### Task H2: Safe review, preview, apply and undo in one editing session

**Files:**
- Create: docs/analysis/editorial-review.js
- Create: tests/analysis/editorial-review.test.js
- Verify existing integration: docs/writing-lab.js, docs/word-docx.js

**Interfaces:**
- Consumes session.read(), session.replaceText(), advisor.suggest(), sourceKind and optional TextIntegrityWordBridge.
- Produces TISEditorialReview.createEditorialReview({session,advisor,wordBridge=null}), with methods getSuggestions(), preview(id):{before,after,revision,risk}, apply(id):{applied:boolean,reason?,snapshot?}, undo():{restored:boolean,reason?}, dismiss(id):void, refresh():void.
- Preview never edits text; Apply requires that original revision matches current. Manual-only suggestions cannot be applied. For sourceKind='docx', apply returns {applied:false,reason:'WORD_READ_ONLY'} and provides safe preview and explicit existing Word bridge route; no blind fallback to mutating readonly extraction.
- Undo restores an in-memory prior snapshot only if the current revision matches the edit it reverses. In-memory history is bounded (max 15), session-only, with no storage or automatic exported passages.

- [ ] **Step 1: Write failing tests** same_length_revision_changed, original_word_bytes_unchanged, docx_requires_word_bridge, undo_only_last_owned_edit, stale_apply_no_mutation, manual_only_never_applies, protected_academic_claims and dismiss_not_persisted. Assert an edit invalidates model evidence by increasing session revision.
- [ ] **Step 2: Run** node tests/analysis/editorial-review.test.js. Expected: FAIL because createEditorialReview does not exist.
- [ ] **Step 3: Implement** revision-checked preview/apply/undo, call TextIntegrityRules.apply only for verified low-risk replacement spans, publish document revision updates through the shared session; never trigger AI scans in apply or undo.
- [ ] **Step 4: Run** node tests/analysis/editorial-review.test.js && node tests/docx-editor.test.js && node tests/word-docx.test.js. Expected: PASS with no changes to the source Word binary.
- [ ] **Step 5: Commit** with git commit -m "feat: user-controlled, revision-safe editorial preview apply and undo".

### Task H3: Minimal accessible post-scan Humanize Suggestions UI

**Files:**
- Create: docs/analysis/humanize-ui.js
- Create: tests/analysis/humanize-browser.test.cjs
- Modify: docs/index.html, docs/v5-public.css, docs/studio-insights-ui.js, .github/workflows/quality.yml
- Read-only: docs/v5-public.js, docs/writing-lab.js

**Interfaces:**
- Consumes advisor/editorial-review and AnalysisController snapshots through the existing app adapter. Exposes TISHumanizeUI.mount({root,session,review,controller,locale}):dispose.
- Required DOM: details#humanizeSuggestions > summary; #humanizeSuggestionCards; optional #humanizeReviewStatus. Cards contain source-derived issue/section, reason, actual Before, safe After if any, and Preview/Apply/Undo with independent accessible labels.
- Visible section title localized: “Make writing more natural” / “اجعل الكتابة أكثر طبيعية”. Render 3 suggestions initially; more by explicit disclosure; no additional primary banner action.

- [ ] **Step 1: Write failing Puppeteer tests** one_analyze_button_stays_primary, before_after_matches_source, keyboard_preview_and_undo, arabic_rtl_labels, inconclusive_and_arabic_suggestions, no_suggestions_not_human_certificate and docx_requires_word_bridge. Set viewport at 390px RTL and 1440px desktop; verify zero horizontal overflow and no false confidence.
- [ ] **Step 2: Run** node tests/analysis/humanize-browser.test.cjs. Expected: FAIL because humanizeSuggestions and cards do not exist.
- [ ] **Step 3: Implement** small section after the existing AI result/writing observations, preserving dark design and optional advanced tools; mount with the shared session and review; use textContent for all excerpts, show local-only provenance, protect read-only Word. Keep Apply/Undo available as per-card secondary controls and do not auto-rescan.
- [ ] **Step 4: Run** node tests/analysis/humanize-browser.test.cjs && node tests/approved-v5-one-click.test.cjs && node tests/v6-docx-layout-and-evidence.test.cjs && node tests/studio-insights-browser.test.js. Expected: PASS. Add humanize tests to Quality and new script to index.html with cache versioning.
- [ ] **Step 5: Commit** with git commit -m "ui: add optional post-scan humanize suggestions and transparent reviewed edits".

### Task H4: Honest opt-in before/after comparison and full workflow regression

**Files:**
- Create: docs/analysis/scan-comparison.js
- Create: tests/analysis/scan-comparison.test.js
- Create: tests/analysis/humanize-e2e-browser.test.cjs
- Modify: docs/analysis/humanize-ui.js, docs/index.html, .github/workflows/quality.yml, .github/workflows/live-browser-ai.yml

**Interfaces:**
- Produces TISScanComparison.compareSignals(before,after): {comparable:boolean,reason:'NONE'|'NO_VALID_SCORE'|'DIFFERENT_MODEL'|'DIFFERENT_OPTIONS'|'DIFFERENT_COVERAGE'|'DIFFERENT_CONTEXT',differencePoints:number|null}.
- Both before/after inputs are validated RESEARCH_SIGNAL evidence summaries with SAME pinned model IDs and revisions, context, deep/full settings and overlap-safe, >=60% sampled-word document coverage. Numeric comparability additionally requires <=5 percentage points difference in sampled-word coverage (chosen conservative UX criterion, NOT a scientific equivalence theorem).
- No source texts are stored in comparison summaries. differencePoints is signed difference of RAW model signal; UI labels “Change in uncalibrated research signal”; never uses “more human,” “detector bypass” or “guaranteed lower AI%.”

- [ ] **Step 1: Write failing tests** comparable_same_model_and_coverage, inconclusive_and_arabic_suggestions, different_checkpoint_comparison_unavailable, changed_deep_mode_comparison_unavailable, missing_coverage_comparison_unavailable, different_context_comparison_unavailable, and no_automatic_detector_rescan. The browser test explicitly edits a fixture via Apply, confirms old AI result clears, then requires a human click on the existing #scanAI.
- [ ] **Step 2: Run** node tests/analysis/scan-comparison.test.js && node tests/analysis/humanize-e2e-browser.test.cjs. Expected: FAIL before comparison module/UI exists.
- [ ] **Step 3: Implement** comparison only after two user-authorized comparable scans; store previous metadata-only signal summary in memory, never upload text. The card either shows a signed raw-signal change with both uncalibrated disclaimers or “Comparison unavailable.” Do not use detector changes as the suggestion-ranking function.
- [ ] **Step 4: Run** node tests/analysis/scan-comparison.test.js && node tests/analysis/humanize-e2e-browser.test.cjs && node tests/security-static.test.js && node tests/browser-ai-ui.test.js && node tests/approved-v5-one-click.test.cjs. Expected: PASS and no unauthorized network requests. Run real ONNX smoke before merging as this changes the analysis-facing UI.
- [ ] **Step 5: Commit** with git commit -m "feat: optional source-independent raw-signal comparison after manual rescan".

## Relationship to approved dual-pane and full on-device rewriter

The owner additionally approved **full local generative rephrasing in two side-by-side original/revised panes**, subject to a separate real-browser model selection and quality gate. H1-H4 remain essential for instant, low-resource, source-grounded advice, protected-span edits and truthful detector-signal comparison; they are NOT the full rewriting engine.

- **L1-L3** add verified and consented on-device WebGPU/ONNX model loading via same-origin Worker, no remote inference or document transmission.
- **L4-L6** add complete-tokenizer source coverage, Arabic/English protected-facts checks, chunk-based review, user-approved changes and Undo.
- **L7-L8** implement the actual responsive dual editor, separate contextual Rewrite locally action, real local generation/privacy tests and deployment verification.
- Existing H3 writing cards appear as an optional section of the Writing Editor/Humanize output pane; no competing global Analyze control is created. If L1 feasibility fails, H1-H4 remain the honest available feature and the full rewriter shows UNAVAILABLE.
- **Do not** confuse enabling Arabic rewriting with enabling an Arabic AI authorship score.

Full technical contracts, research candidates and acceptance criteria: docs/superpowers/specs/2026-10-13-tis-dual-pane-local-rewrite-design.md and docs/superpowers/plans/2026-10-13-tis-local-generative-dual-editor.md.

## Humanize Subsystem Completion Gate

- All 4 task tests and independent reviews passed, including protected numeric/citation claims, same-length edits, Arabic RTL, DOCX preservation and undo.
- Count of visible primary analysis actions remains exactly one. Humanize does NOT mutate text before human review or trigger automatic repeated scans.
- No fabricated examples, citations, lab figures or deliberate errors in proposed edits. No classifier score or sentence-level AI percentage used for recommendation ranking.
- Unsupported/INCONCLUSIVE English and unsupported Arabic still show editorial observations without a false detector conclusion.
- User-approved edits preserve provenance, manual checkpoints and explicit Undo; safe export is metadata-only by default.
- Run Quality and real-model Chromium checks before human-approved merge, then deployed-origin smoke. No new product release accuracy claims.
- Optional research-signal difference is NOT an editing-quality KPI and is hidden when two scans cannot be meaningfully compared.

**Status:** IMPLEMENTATION PLAN FOR OWNER REVIEW; NO PRODUCT CODE MODIFIED OR MERGE AUTHORIZED.
