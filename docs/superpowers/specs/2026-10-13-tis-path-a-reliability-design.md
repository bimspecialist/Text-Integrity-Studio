# Text Integrity Studio — Path A: Reliability-First Architecture

**Status:** PATH A APPROVED; DUAL-PANE + LOCAL GENERATIVE REWRITING DIRECTION APPROVED 2026-10-13; REVISED DETAIL/PLANS FOR REVIEW; NO PRODUCT CODE AUTHORIZED.  
**Date:** 2026-10-13  
**Baseline:** main at 8d08635bd2adf3e32e22ba3735a0049ea6b22b4c (V6)  
**Scope:** Existing GitHub Pages application and its offline evaluation pipeline; no new project or mandatory hosted inference service  
**Decision owner:** Repository owner; approval required before an implementation plan or product-code changes

## 1. Purpose, accepted direction and scope

The owner approved **Path A**: improve scientific honesty, reliability, user comprehension and maintainability while retaining the existing minimal dark bilingual website, its **one primary Analyze Text action**, local-first privacy, and Word/PDF/OCR/reporting tools. The 17 requested thinking methods are used as an architecture-review checklist, not as magic CLI commands or substitutes for code tests.

**User-visible outcome:** Paste/upload a document, press one primary button, see local writing observations and an honest optional AI research signal **only if actually supported**. A contradictory or insufficient scan must display a plainly explained **INCONCLUSIVE** state rather than a fabricated AI-written percentage.

**Engineering outcome:** The document identity, eligibility decision, analysis lifecycle, numeric evidence validation, and presentation state have one defined owner apiece. AI inference remains genuinely executed by pinned, locally running ONNX models in the browser, not a synthetic widget. Evaluation remains research-only until independently sufficient evidence exists.

**Explicitly in scope:** state and module boundaries; diagnostics and retry; tokenizer/coverage correctness; bilingual/RTL and long DOCX preservation; privacy/supply-chain checks; reproducible accuracy/fairness evaluation; performance baselines; acceptance and rollback; **opt-in natural-writing suggestions with reviewed edits, a two-pane original/output workspace, and locally executed generative full-document rewriting after model-capability/consent checks**. The complete separate design is docs/superpowers/specs/2026-10-13-tis-dual-pane-local-rewrite-design.md.

**Explicitly out of scope:** selling detection as certified authorship proof; training/deploying probabilities on weak labels; adjusting scores to match commercial detectors; deliberately introducing grammar mistakes or inventing personal experiences to trick detectors; a paid cloud backend, user accounts, team permissions or document cloud storage; a speculative Arabic detector; introducing React/Next.js into the GitHub Pages front end; replacing the website's entire design; deleting working tools.

## 2. Verified current baseline and architectural friction

Sources: docs/ai-evidence-core.js; docs/browser-ai-runtime.js; docs/ai-score-ui.js; docs/studio-insights-core.js; docs/studio-insights-ui.js; docs/v5-public.js; docs/index.html; docs/V6_ISSUE_AUDIT.md; backend/research/EXTERNAL_2026_EVALUATION.md; tests and workflows under .github/workflows.

| Current fact | Verified implementation | Architectural implication |
|---|---|---|
| Model partitioning | Real tokenizer; 448-token cap; 12 windows default or 96 extended; document coverage calculated from sampled words | Preserve this proven bounded design; profile and verify skipped fragments |
| Abstention | An overall signal withheld below 60% coverage, for variable/conflicting passages or strong primary/secondary disagreement | Never coerce null into 0%, 50%, or a human-authorship claim |
| Baseline models | Primary onnx-community/tmr-ai-text-detector-ONNX at b9aa251e5bcda7e429fcc936767d921435945b60; optional historical comparator at 54895bd11f34b47a01369d25b2255224717409b8 | Keep the comparator optional and clearly identified as GPT-2 era |
| Intertwined UI state | ai-score-ui.js emits tis:ai-status, tis:ai-progress, tis:ai-evidence; studio-insights-ui.js and v5-public.js each manage some state and render the same result area | Canonicalize lifecycle, validate one result contract, avoid conflicting renderers |
| Duplicate eligibility | ai-evidence-core.eligibility(), ai-score-ui.eligible() and studio-insights-ui.readinessNote() have separate checks | Adopt one shared decision policy with identical messages and tests |
| Language comment drift | ai-evidence-core.js comment says 5%+ Arabic while its effective threshold uses Latin-character ratio 0.02 | Resolve comment/code discrepancy explicitly; do not silently alter existing eligibility |
| Coverage units differ | Core document coverage counts sampled words; V5 section overlay measures covered UTF-16 characters | Name each denominator explicitly; do not mix them into a single confidence |
| Stale-result defenses | Request IDs, input-snapshot comparison and cancel already exist; presentation also checks source length | Retain protections and add monotonic document revisions, including equal-length edits |
| Runtime loading | On-demand Transformers.js v3.8.1 via CDN with model assets downloaded on request; model runs in a same-origin iframe | Preserve opt-in; threat-model third-party executable runtime, cache and postMessage |
| Document utilities | DOCX readonly import with paragraph boundaries, PDF/OCR and export live in optional disclosure | Preserve format and source offsets with regression fixtures |
| Public delivery | GitHub Pages, Quality CI, genuine model smoke and deployed-origin diagnostic all succeeded for V6 | Continue gates and measure real published behavior, not only branch mocks |

**Scientific baseline (NOT a production claim):** The 2026 external, vendor-labeled corpus had 104 documents (64 human-labeled, 40 AI-labeled). At the frozen raw >=80 threshold, 5/64 human documents gave high signals (7.8%; 95% Wilson upper bound approximately 17.0%) and 29/40 AI documents gave high signals (72.5%). AUROC was 0.925 on that particular source-labeled sample. The earlier HC3 corpus instead had 13/24 human high alerts (54.2%). The corpora differ and cannot be compared as a before/after accuracy improvement. Labels are not independently certified. The public detector remains **research / NOT independently validated**.

## 3. Considered architecture alternatives (first-principles, SCAMPER, devil's advocate)

**A1 — Incremental modularization with compatibility adapters (CHOSEN).** Keep existing statically hosted UI, ONNX iframe, format tools and tests. Introduce small pure contracts and one lifecycle controller; migrate responsibilities behind adapters one at a time. Benefits: lowest migration risk, preserves the one-button workflow and privacy. Cost: a short transitional period where old adapters coexist behind a single owner.

**A2 — Full front-end replacement.** Rewrite as a framework-based SPA and redesign state from scratch. Benefits: potential long-term component consistency. Costs: substantial regression risk to PDF/DOCX/OCR, asset delivery, accessibility, performance, CSP and manually reviewed UI. Reject while Path A is focused on reliability.

**A3 — Server-driven detection.** Upload documents for model inference/calibration on a backend. Benefits: broader hardware compatibility and centralized model administration. Costs: private document transfer, hosting/security overhead and departure from user-approved GitHub Pages/local-first design. Reject for this release.

**Tradeoff decision:** A1. Do not expand product features until the reliability gates below are met; this is not authorization to rewrite previously accepted working features.

## 4. Proposed target architecture (logical boundaries, not code yet)

    GitHub Pages public shell — dark EN/AR, one Analyze Text action
        |
        +-- Input Adapters: paste / TXT / DOCX / PDF / OCR
        |       |  [read-only import warnings; no mutation of original file]
        |       v
        +-- DocumentSession: immutable snapshot + monotonic local revision
                |  (source text held only in browser memory)
                v
            AnalysisController — ONE state machine, ONE cancellation owner
                |------> WritingReviewAdapter -> editorial observations
                |                 |
                |                 v
                |           NaturalWritingAdvisor -> suggested revisions
                |                                    (user review + undo)
                |------> EligibilityPolicy  -> unsupported reason / opt-in
                |                            |
                |                            v
                |                       InferenceBridge
                |                        same-origin iframe
                |                        pinned ONNX runtime/models
                |                            |
                |                        Tokenizer window selection
                |                        Primary + optional legacy comparator
                |                        Consensus / abstention
                |                            |
                +<---------- EvidenceValidator <------+
                |
                +----> EvidenceProjection: source offsets, coverage, segments
                +----> ResultsPresenter: one visible result state; Advanced Details
                +----> DiagnosticExporter: explicit user download, no source text

    Offline ONLY: versioned public dataset/label manifest
               -> group-disjoint split and locked test set
               -> research calibration/evaluation
               -> human-reviewed release decision
               (never a default production endpoint)

**Boundary rules:**
- Input adapters can create a snapshot, not directly update an AI score.
- EligibilityPolicy is the only source of accepted language/length/policy decisions in the page and model runtime. Existing behavior stays frozen until a documented, separately tested policy change.
- AnalysisController alone controls run, cancel, retry, request ID, document revision and user-visible completion status.
- InferenceBridge alone exchanges run/progress/cancel/result messages with the iframe. Preserve current TIS_BROWSER_AI_V1 protocol initially; upgrade only behind versioned compatibility tests.
- EvidenceValidator is pure and fail-closed. It validates model identity, schema/version, calibration disclaimer, finite signal bounds, text offset bounds, document revision, length, coverage basis and allowed state/score combinations **before** publishing a result to any view.
- EvidenceProjection maps valid evidence to paragraphs and heatmap, preserving the exact source offsets. It does **not** independently decide whole-document authorship or change core consensus.
- ResultsPresenter alone formats the compact card, ring and warning text. It never infers a score from a progress percentage, a URL, text genre or the decorative UI.
- Backend/hybrid_detector remains explicitly separate research/reference infrastructure. It is not silently wired into the GitHub Pages user workflow.

## 5. Component contracts and file impact (proposed, no files modified)

| Boundary | Proposed owner/file or adapter | Public contract | Must never do |
|---|---|---|---|
| DocumentSession | docs/analysis/document-session.js (new pure unit) | createSnapshot, getCurrentRevision, invalidate; immutable revision + extracted-source metadata | Persist pasted text, export a hash as telemetry or silently truncate |
| EligibilityPolicy | factor existing docs/ai-evidence-core.js logic into reusable docs/analysis/eligibility-policy.js | assess(text) -> eligible/language/reason/counts | Issue English model scores for Arabic/mixed input or change limits without tests |
| AnalysisController | docs/analysis/analysis-controller.js | dispatch(event), getState(), subscribe(listener) | Render DOM directly, load model script or invent numeric scores |
| InferenceBridge | adapter around docs/ai-score-ui.js and browser-ai-runtime.js | run(snapshot, options, requestId), cancel(requestId), progress, result/error | Accept stale/cross-origin messages or send document text to remote detector API |
| EvidenceValidator | docs/analysis/evidence-contract.js (pure) | validate(result, snapshot) -> accepted result or typed failure | Treat NaN, null, low coverage, disagreement as a human score |
| NaturalWritingAdvisor | new thin module reusing docs/writing-rules.js and docs/studio-insights-core.js | suggest(snapshot, locale) -> structured editorial suggestions with local before/after preview | Optimize against the detector as a target; invent facts; add intentional errors; change text without user approval |
| EvidenceProjection | extraction from docs/v5-public.js and docs/studio-insights-core.js | sectionOffsets, modelWindows, coverageUnits, mappedEvidence | Convert character coverage to word coverage or omit skipped sections silently |
| ResultsPresenter | existing compact visual layer, migrating docs/studio-insights-ui.js and v5-public.js | render(state) from one owner | Maintain a competing AI lifecycle or add extra primary buttons |
| ResearchEvaluation | existing backend/research and backend/hybrid_detector scripts | manifest + pinned model run -> aggregate metrics and signed/reviewed decision | Deploy calibration fitted from test samples by default |

**Compatibility approach:** New pure modules may be written in the same IIFE/UMD style used by the current static site, loaded as first-party scripts with CSP-safe ordering. Avoid bundler dependency and preserve the existing DOM IDs and on-page tests while adapters migrate. Delete old duplicate state/eligibility code only after contract tests show parity.

## 6. Canonical data contracts (normative semantics)

**DocumentSnapshot:** session-local monotonically increasing revision (integer), exact extracted text (UTF-16 JavaScript string), sourceKind (paste/txt/docx/pdf/ocr), display metadata, extracted paragraph spans [start,end), file warnings, createdAt. The original uploaded bytes are not mutated. **Never derive document identity from length alone.** A same-length edit increments revision.

**EligibilityResult:** eligible boolean; reason one of NO_TEXT / MIN_WORDS / TEXT_TOO_LONG / UNSUPPORTED_LANGUAGE / UNSUPPORTED_FORMAT / NONE; counts (words, characters); language class (en/ar/mixed/other/unknown); limits/method version. UI copy is localized presentation, not policy.

**AnalysisRun:** unique requestId and revision, optional-deep/full-scan flags, state, start/finish timestamps, error code, progress stage. No input text is logged or exported as an automatic diagnostic. The backend model's existing message protocol remains wrapped at the bridge.

**MeasuredEvidence:** schema version, exact primary/secondary model IDs and pinned revisions, raw (uncalibrated) model signals, coverage denominator and raw value, tokenizer window offsets in UTF-16 code units, number of sampled/unsampled windows, optional warnings and consensus status. All window spans must lie within [0, snapshot.text.length] and cannot be NaN or overlapping in a way that double-counts coverage.

**Outcome — a discriminated union, not one overloaded percentage:**
- NOT_EVALUATED / UNSUPPORTED: score = null, reason required; editorial observations may still exist.
- RUNNING: score = null, progress stage may be known; never show fictitious progress.
- RESEARCH_SIGNAL: score is finite in [0,100]; calibration = NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE; label explicitly **model signal, NOT percent AI authorship**.
- INCONCLUSIVE: score = null, reason must identify COVERAGE / PASSAGE_CONFLICT / MODEL_DISAGREEMENT / OTHER_INTEGRITY.
- CANCELLED / ERROR: score = null; recoverable, descriptive error/retry behavior.
- STALE: no result rendered after any source revision change.

**Important denominator distinction:** documentCoverage = percentage of source WORDS actually processed by the model tokenizer windows; perParagraphCoverage = percentage of that paragraph's source-character span intersected by valid model windows. UI must label both precisely and cannot apply a word-denominator threshold to the character metric. A section signal is only a window-weighted diagnostic, not a claim that a given fraction of the paragraph was generated.

**Model revision rule:** Inference output carries the actual checkpoint revision used. The validator must reject missing, mismatched or unknown revision when evidence is presented as pinned, not silently fall back to a default label. Existing historical raw reports can be handled as read-only legacy data with clear provenance limitation.

### 6.1 Post-scan natural-writing suggestions (`/humanize`) — user-requested design amendment

**User goal:** After Analyze Text, offer useful suggestions that make the writing more natural, clear, specific and true to the author's voice. Users may be interested in whether their next research-model scan changes, but **lowering an uncalibrated detector percentage is neither a guaranteed result nor the editorial quality objective**. The site must never market these edits as proven AI-detector bypasses or disguise an AI-generated passage as independently authored.

**Alternative design choices (updated per owner approval):** (1) a small local rule-based advisor building on `TextIntegrityRules.analyze` and `TextIntegrityStudioInsights.analyzeDocument` (**keep as fast default/fallback**); (2) a **fully local browser-based generative rewriter**, now approved as product scope, but gated by separate first-use model consent, genuine WebGPU/ONNX compatibility, performance, privacy, licensing, Arabic/English quality and factual-drift tests; (3) third-party cloud paraphrasing (**rejected**). The approved architecture is the combination of (1)+(2), with no unreviewed model deployed and no claim of detector evasion.

**When it appears:** The one existing **Analyze Text** button first runs the local writing review. On completion, cancellation, or unsupported Arabic/mixed/short text, editorial suggestions may still appear even when the AI detector displays INCONCLUSIVE/UNSUPPORTED. Do **not** use model-window values to infer which exact sentences were authored by AI. Suggestions derive from measurable writing features and optional user-supplied context, independent of classifier predictions.

**Minimal interface (English/Arabic/RTL):** Under the honest AI result and key notes, show **Make writing more natural / اجعل الكتابة أكثر طبيعية** as an optional section. Display up to **three most useful suggestions** by default; additional observations remain in an expandable list. Each card has the observed issue, location, short *why*, **Before / After** example, and user-controlled **Preview / Apply / Undo** only when a safe replacement exists. Cards without defensible automatic replacement offer a guided edit prompt rather than inventing text. These are secondary inline controls; **Analyze Text remains the sole prominent page action**.

**Conservative suggestion types and evidence:**
1. Sentence-length uniformity -> break or combine sentences where comprehension improves; do not vary length randomly.
2. Repeated generic terms/transitions -> replace only when the meaning is unchanged; preserve technical engineering terms and valid intentional repetition.
3. Dense academic phrasing/overlong sentences -> reorganize into clearer, active sentences *where appropriate for the domain*; do not automatically informalize formal assignments.
4. Vague claims or missing illustrative detail -> ask the user for a **real** example, observation, source or project-specific detail. Never create a personal anecdote, project figure or citation.
5. Mechanical/overly formal cadence -> offer a fluent paraphrase without changing scope, polarity, qualifiers, dates, units or citations, and do not introduce deliberate grammatical mistakes.

**Example English (illustrative only):** Before: “It is important to note that the experiment yielded results that were significant in nature.” After: “The experiment produced notable results; the report should explain which measurements support that conclusion.” This is an editorial clarity example, **not an asserted reduction in AI likelihood**.

**Example Arabic (illustrative only):** Before: “من المهم الإشارة إلى أن المشروع قد شهد العديد من التطورات المختلفة.” After: “شهد المشروع تغييرات في التصميم؛ حدّد التغييرات الفعلية وأسبابها.” Arabic writing assistance is allowed even while **Arabic AI-authorship scoring remains unsupported**.

**Required data contract:**
- `EditorialSuggestion` is local, versioned and associated with `documentRevision`, a stable rule ID, locale, scope/section, [start,end) UTF-16 span, original excerpt, observed feature, human-readable reason, optional safe proposed replacement, edit risk (low/manual), and explanatory basis (local editorial heuristic, **not an AI-authorship finding**).
- `SuggestionReview` records draft preview, accepted/rejected/dismissed action, undo snapshot and revision validation **in memory for the current editing session only**. Any intervening text change invalidates old spans; never apply to stale content just because text length is unchanged.
- When source is a read-only DOCX extraction, suggestions must NOT directly mutate the original DOCX, and the UI should offer a preview or route to the existing explicitly authorized Word editing/export workflow. Protected ranges (numbers, formulas, URLs, quotes, citations, names, dates and units) must not be silently rewritten.
- Sanitized exports may include rule counts/reason codes but must exclude original excerpts or private proposed text by default; the user must explicitly opt into a text-containing export.
- The advisor must not require CDN AI models, transmit text to third parties, or run a hidden repeated-detector optimization loop. Existing optional research inference downloads only on the user's main Analyze action.

**After a user-approved edit:** Show the changed passage in the editor, preserve undo and invalidate all previous source-specific AI evidence. The user may explicitly click **Analyze Text** again. If both runs produced valid, comparable, same-version model signals with equivalent scan options and comparable coverage, the UI may show a labeled **before/after change in raw research signal**, **never a “more human” percentage**, improvement guarantee or proof of origin. If either run was INCONCLUSIVE, unsupported or incomparable, display *comparison unavailable*.

**Quality and product outcomes:** Evaluate readability, user-rated clarity, factual/technical preservation, user acceptance/rejection of proposals, explanation comprehension and successful undo. **Do not** use “percentage AI score decreased” as the optimization target or release KPI; that can incentivize misleading detector gaming. Compare benchmark performance independently on a frozen dataset, never on user-adapted live documents.

**Error and protection cases:** no suggestion when there is insufficient evidence; “no issues found” must not mean “written by a human”; preserve ESL, Arabic dialect, author voice and academic tone; avoid forced colloquialisms; disable Apply on read-only/imported sources unless their supported editing workflow permits it; handle large documents and same-length edits; support keyboard/RTL/reduced motion.

### 6.2 Dual-pane UI and fully local generative rewriting — approved direction

The owner approved a **two-pane source/output editor**, with unified task tabs for AI Detection, Humanize and Writing Editor, and **full-document local generative rewriting on the user's device**. The complete component/UX/data/privacy/whole-document/release contract is in docs/superpowers/specs/2026-10-13-tis-dual-pane-local-rewrite-design.md; its implementation tasks are in docs/superpowers/plans/2026-10-13-tis-local-generative-dual-editor.md.

**Boundary:** The existing ONE prominent Analyze Text action remains for writing + eligible detector checks. Rewriting is separately and explicitly user-requested via a contextual **Rewrite locally** action with separate consent before a large model download; no automatic external LLM call or text upload. Arabic rewrites require local human-quality tests, while Arabic AI authorship scoring remains unsupported. Full rewrite status requires complete mapped source coverage, otherwise PARTIAL. Every draft is reviewed before Apply, and every accepted change invalidates stale research-model signals.

**Candidate NOT committed:** onnx-community/Qwen3-0.6B-ONNX q4f16 (public file approximately 570 MB) may be tested with WebGPU; exact revision/converted license/total transfer/peak memory and bilingual quality remain release blockers until independently verified. Rule-based editorial help must continue on unsupported browsers or denied model-download consent. Do not market raw score changes as a higher "human" percentage.

## 7. Deterministic lifecycle, retry and failure policy

| Event | Required transition | Visible feedback |
|---|---|---|
| Empty -> paste/import | EMPTY -> READY, revision++ | Editor/word count, no detector percentage |
| Analyze on short/Arabic/mixed/unsupported | READY -> WRITING_ONLY / UNSUPPORTED | Local writing notes + precise no-AI reason, zero model downloads |
| Analyze on eligible English | READY -> LOADING -> ANALYZING | One primary button becomes Cancel; genuine downloading/inference state |
| Valid measurable evidence | ANALYZING -> RESEARCH_SIGNAL | Uncalibrated model diagnostic + actual sampled coverage |
| Low coverage/conflicting passages/models | ANALYZING -> INCONCLUSIVE | No overall number; clear reason + measured passages in details |
| Edit text (even same length) / new import | Any -> STALE -> READY; revision++ and cancel | Immediately clear old ring/heatmap and reject late result |
| Cancel | LOADING/ANALYZING -> CANCELLED | One-click retry possible; late message ignored |
| Runtime/CDN/inference timeout | LOADING/ANALYZING -> ERROR | Error code explained; reset damaged child runtime if necessary, retry safe |
| Invalid schema or mismatched version | Any result -> ERROR / INTEGRITY_BLOCK | No number, no stale result; local sanitized diagnostic |

**Progress rules:** stage-specific loading spinner and only REAL percent when download runtime supplies it. Do not present 0–100% inference progress as authorship probability; progress and classifier signal use distinct labels and aria roles. Preserve the existing 30s iframe-start, 180s inactivity and 540s absolute watchdogs until profiling justifies an explicit change.

**Multiple requests:** Controller enforces one active run, monotonically ordered revision/request, and a single latest accepted outcome. The older iframe READY event cannot cause duplicate RUN messages. All event types must be tested for ordering, race, retry, cancel, and read-only import behavior.

## 8. Scientific benchmark, independent verification and deployment rules

**Scientific objective:** reduce falsely confident reports and quantify real classification performance; do not confuse increased abstention with reduced classification error.

**Datasets and provenance:** Build licensed, independently inspectable human and AI texts across engineering/academic/formal/ESL and more ordinary writing, diverse lengths and genuine recent unseen generator families. Record originating document/author/prompt/generator/edit path, license and label certainty, language, domain, document date and grouped provenance. Treat HC3 and the existing vendor-labeled 2026 corpus as weak/external evidence, not certified test truth.

**Splits:** separate TRAIN, CALIBRATION, validation/development and a truly untouched RELEASE TEST; group-disjoint by source, author, prompt/article, duplicated text, and generator family where unseen generalization is claimed. No fitting thresholds, score mappings, prompt transforms or ensemble weights on the release TEST. Keep immutable dataset and model revisions; secret/private source texts are never committed as public CI artifacts.

**Metrics (all with denominators):** confusion matrix, FPR/FNR, precision/recall/F1 at preregistered thresholds, AUROC with uncertainty, Brier/ECE/reliability curves only with clearly labeled uncalibrated or fitted probabilities, stratified length/domain/ESL/academic results, abstention rate and reasons, selective risk/coverage trade-offs, and generator-family generalization. For independent binary proportions report Wilson intervals; where samples share prompts/authors/sources use grouped bootstrap/cluster-aware uncertainty, not pretend they are i.i.d. All comparisons before/after must use the same frozen evaluation set and definition, and distinguish raw-model improvements from UI suppression of scores.

**Research-to-production promotion gates (future, not achieved):**
1. Independently verified, licensed ground truth with sufficient group independence. The current research proposal calls for at least 400 independently verified human and 400 AI examples **per proposed language/domain release cohort**, plus frozen unseen-generator and formal/ESL subgroups; require a documented power/design review before using sample sizes as guarantees.
2. A preregistered operating threshold meets a one-sided 95% **upper confidence bound on human FPR <=1%** in each approved target cohort, not merely a small observed FPR.
3. Calibrated probability claims additionally require demonstrated reliability, including ECE <=0.10 and Brier <=0.20 on untouched target-domain data, with calibration trained only on separate CALIBRATION data. These numerical targets are research gates, not current site scores.
4. Precommitted recall/false-negative and selective-abstention targets set by use case before unblinding release TEST; reviewer confirms the cost of excessive INCONCLUSIVE rates.
5. Independent model-risk approval, explicit scope/language disclosures and human review; **no automated academic misconduct accusations**. A model missing any gate stays EXPERIMENTAL and never produces a certified authorship percentage.

**Arabic:** current English-only AI policy remains. Arabic can receive local writing/editing metrics. An Arabic detection model may be proposed only as a separate, licensed, locally runnable research candidate with independent Arabic Fusha/academic benchmark and its own release decision. No silent English-model fallback.

## 9. Privacy, application security and supply-chain architecture

- Pasted document text and imported source stay in session memory; no server upload, analytics tracking, automatic localStorage persistence or user-text logging. Explicit user-directed downloads remain permitted. Source text in postMessage is sent only to the intended same-origin inference context and never to a detector API.
- Document bytes, excerpts and sensitive filenames must not be exported in default performance/CI logs. Diagnostic export defaults to aggregate numbers, model IDs/revisions, coverage and failure codes; any excerpt export requires a separate explicit user choice, not hidden telemetry.
- Enforce CSP, trusted script origins, input/DOM escaping via textContent, postMessage event.source/event.origin validation, requestId/version guards, sandbox boundary review and document/file size caps. Do not describe allow-scripts+allow-same-origin as an impenetrable security sandbox.
- Audit optional third-party Transformers.js code and Hugging Face model download origins, exact versions, licenses and pinned revisions. Assess same-origin vendoring/SRI where technically feasible before changing runtime. Unknown labels/revisions or failed integrity checks must fail closed.
- Handle parser/HTML/PDF/DOCX/OCR as untrusted input. Scan errors may degrade to **writing-only** or **unsupported**, never a fake AI signal. Preserve original DOCX, readonly source for Word structural edits and file-content isolation.
- Browser caches may retain downloaded model/runtime assets; this is distinct from intentionally storing the user's document text. Privacy disclosure must explain it accurately.
- All new telemetry and diagnostic metrics are local/sanitized by default. No new third-party analytics service in Path A.

## 10. Performance, accessibility and minimal interface

**Measured baseline first:** record cold and warm model startup/download size, peak browser heap (when available), main-thread responsiveness, text-to-first-feedback and analysis time for fixed 150-word, 2,000-word, 20,000-word and eligible near-limit documents on reproducible desktop and memory-constrained/mobile Chromium profiles. Compare changes only on equal hardware/browser/network fixtures. Proposed regression alarm: >20% deterioration in median or p95 runtime/memory on the fixed bench, requiring review rather than automatic marketing claims. Establish absolute budgets only after first reproducible baseline.

**Correctness targets:** 0 silent dropped windows within the declared sampling strategy; exactly reproducible source offsets and coverage (display roundoff at most 0.1 point); zero stale accepted results in cancellation/edit stress tests; zero default third-party requests prior to explicit opt-in; one visible primary Analyze Text action; no uncalibrated score mislabeled as a reliable probability.

**Accessible UX:** retain Manrope and IBM Plex Sans Arabic, dark style, EN/AR/RTL, usable focus order, descriptive errors/labels, accessible progress and reduced-motion handling. Test 390px RTL and desktop 1440/1736px with DOCX/PDF and long academic text. Core: input/upload -> one Analyze action -> result/abstention and important notes. Secondary evidence/model comparison and utility tools stay behind Advanced Details / More document tools.

**Long documents:** keep normal scan stratified and disclose unsampled coverage; allow opt-in extended 96-window scan without asserting it is more accurate. If memory/time limit or partial extraction occurs, show partial/unsupported status; no accidental passage-wide or document-wide claim.

## 11. Acceptance matrix and independent QA obligations

| Quality gate | Evidence required to pass |
|---|---|
| Architectural state parity | Pure reducer/eligibility/evidence contract unit tests; no duplicate active run or conflicting visible state |
| One-button workflow | Mock-driven and real Chromium: English eligible, short English, Arabic, mixed, edited, cancelled, retry, timeout, stale same-length edit |
| Post-scan natural-writing advisor | Suggestions shown without verified AI score; source-derived before/after; locale and academic-tone preservation; protected figures, citations, quotes and technical terms; stale-revision rejection; user apply/undo; read-only DOCX safe path; no auto rescan, fake facts or score-decrease promise |
| Fully local dual-pane generation | Both original and draft visible on desktop; explicit model consent; real pinned browser WebGPU generation; no text on external network; 100% chunk/source-span coverage or PARTIAL; genuine Arabic/English tests; fallback with zero fake outputs; no change to English detector score logic |
| Tokenizer and extraction | Exact offsets, non-silent oversize tokens, short/long windows, UTF-16 handling, DOCX paragraph/read-only and PDF/OCR warnings |
| Consensus and report integrity | Conflict/coverage/missing model/null/nonfinite/out-of-range/revision mismatch => no invented number, truthful flags and units |
| Real inference | Pinned primary + opt-in legacy comparator executed in browser with true model assets, not fixture-only |
| Privacy and security | No unintended external document transfer; CSP origin tests, dependency and licensing audit, sanitized diagnostics |
| UX and localization | 390px RTL and desktop Chromium screenshots, accessible progress and one prominent Analyze button, Word/PDF/OCR unaffected |
| Performance | Reproducible warm/cold baselines, investigate >20% regressions, medium-resource test artifacts excluding source text |
| Research evaluation | Group-disjoint provenance, untouched release-test protocol, subgroup metrics and uncertainty, no unsupported uplift claims |
| Publication | PR quality + genuine model smoke pass; main merge only after review; GitHub Pages success and **post-deploy public-origin** AI smoke; revert on failure |

**Release decision:** Architecture refactor and UX clarity may ship as an EXPERIMENTAL research site after engineering gates. A trustworthy or calibrated authorship-percentage product is separately **BLOCKED** until scientific promotion gates succeed. These are two different approvals.

## 12. Rollout boundaries, rollback and risk register

**Sequencing constraints (not yet an implementation plan):** first freeze V6 fixtures/metrics; then canonical contracts and eligibility; then controller/bridge and compatibility tests; then presenters/section projection; then privacy/performance audit and evaluation refresh; finally release verification. Implementation tasks, sequencing by commit and effort estimates are intentionally deferred until this spec is approved.

| Risk | Severity | Containment |
|---|---|---|
| Users interpret raw signal as factual AI percentage | Critical | Uncalibrated labeling, required disclaimer, INCONCLUSIVE, separate scientific release |
| Humanize suggestions inadvertently change factual claims or appear to certify “human-written” status | Critical | User-controlled previews, protected spans, explicit non-guarantee, no hidden detector optimization and regression tests |
| Incorrect score on academic/ESL human text | Critical | Independent subgroup benchmarks, high-confidence-bound FPR release gate, human review |
| Controller migration breaks Word/PDF/OCR | High | Preserve existing IDs/adapters and fixtures, reversible incremental PRs |
| Same-length edits or late iframe messages leak stale results | High | Monotonic revision + requestId and race tests |
| CDN/script/model tampering or unconsented remote requests | High | Exact revision/allowlist/license review, consent and CSP tests, fail closed |
| Slow 96-window scans freeze medium device | High | Profiling, cancellation, memory/time limits, declared sampling |
| Duplicated eligibility or mixed coverage units | High | Single pure policy, strongly named denominators, contract tests |
| Test labels leak between train/calibration/release | Critical | Provenance manifest, source/prompt/author group split and independent release review |
| GitHub Pages cache/CI discrepancy | Medium | Immutable first-party asset versions, deployed-origin post-merge smoke, rollback |
| Unsupported Arabic scored with English model | High | Unified language gate and explicit writing-only UI |

**Rollback:** Revert the relevant refactor PR/squash in main; no user database migration or upload endpoint exists. Preserve V6 as last verified production baseline until new branch gates pass. Do not combine architecture changes with threshold/model-weight changes in the same release.

## 13. Traceability to the 17 requested methods

| Method | Concrete effect on design |
|---|---|
| /refactor | Split document session, controller, bridge, evidence validation, projection and view ownership |
| /debug | Race/timeout/cancel/source-edit/format and degraded-network reproduction gates |
| /expand | Optional future Arabic and longer text only after scientific/compatibility gates |
| /scamper | Substitute redundant actions with one CTA, combine writing and eligible AI flow, eliminate duplicate copy |
| /competitor | Compare disclosure, passage analysis and ease of use, not copy competitors' percentage calibration |
| /blue-ocean | Compete on local privacy, transparent coverage/provenance and honest inconclusive outcomes |
| /focus | Reliability and measurable harm reduction before feature expansion |
| /socrates | Demand provenance: What precisely does each percentage mean, and when is it warranted? |
| /six-hats | Include factual, user-empathy, negative-risk, benefits, creative alternatives and governance reviews |
| /first-principles | A statistical model signal is NOT certified authorship; keep model/data/UI roles distinct |
| /second-order | Analyze effects of extra models on RAM, bandwidth, user trust and abstention |
| /biases | Formal/ESL/academic and source-domain selection audits, not demographic assumptions |
| /devil-advocate | Block release claims when confidence bounds or provenance are insufficient |
| /5-whys | Trace score differences to model era/training population/token coverage/calibration and UI interpretations |
| /perspective | Student, researcher, editor, teacher, mobile/RTL user and privacy-reviewer journeys |
| /mental-models | Out-of-distribution generalization, base rates, selective prediction, source leakage and reversibility |
| /brainstorm | Evaluate three architecture routes, select minimal-risk incremental compatibility design; add transparent local-only post-scan natural-writing advice rather than an unverified automatic detector evasion engine |

These are **review frameworks**, not evidence that a panel of real outside experts met. Findings are traced to code, tests and the project's research reports.

## 14. Open decisions and required explicit review

**Recommended decisions for owner approval:**
1. Accept A1 incremental modularization with no new cloud upload/backend, no full redesign and no new primary buttons.
2. Keep current model weights and thresholds unchanged by this architecture release; investigate code/comment discrepancies and correctness first.
3. Keep raw research signals available with clearly labeled units; prefer no number over misleading certainty. A calibrated authorship percentage stays blocked by scientific gates.
4. Treat the existing V6 user experience (EN/AR dark editor, one button, optional tools) and real DOCX/PDF/OCR functionality as protected regression contracts.
5. Permit separate, future research proposals for Arabic and new models, but no automatic production model addition.
6. Approve the requested **post-scan natural-writing suggestions** as a small local-only editorial component with optional reviewed revisions. Do **not** authorize auto-humanization without review, fabricated anecdotes/errors, detector-score targeting, or any promise that the AI research signal will fall.
7. Approve the *direction* of **dual-pane editing and full locally executed generative rewriting** via consented model downloads; a specific ONNX model is NOT yet approved without measurable security/license/performance/English+Arabic quality gates. Remote text inference remains forbidden. Keep one global Analyze and a contextual Rewrite locally.

**Owner approval boundary:** The owner explicitly approved the Path A design and post-scan Humanize addendum on 2026-10-13. This authorizes writing detailed execution plans, which are now under docs/superpowers/plans/. It does NOT authorize modifying product code, model scores, merging into main or deploying. Implementation starts only after the owner reviews the written plans and selects a supported execution method.

## 15. Primary repository evidence

- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/docs/ai-evidence-core.js
- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/docs/browser-ai-runtime.js
- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/docs/ai-score-ui.js
- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/docs/studio-insights-core.js
- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/docs/studio-insights-ui.js
- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/docs/v5-public.js
- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/docs/V6_ISSUE_AUDIT.md
- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/backend/research/EXTERNAL_2026_EVALUATION.md
- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/backend/research/AI_DETECTOR_VALIDATION.md
- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/.github/workflows/quality.yml
- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/.github/workflows/live-browser-ai.yml
- https://github.com/bimspecialist/Text-Integrity-Studio/blob/main/.github/workflows/deployed-ai-diagnostic.yml

**Status at end of specification: PATH A AND LOCAL-DUAL-PANE DIRECTION APPROVED / REVISED DETAILED SPECS AND PLANS AWAIT OWNER REVIEW / NO PRODUCT IMPLEMENTATION AUTHORIZED.**
