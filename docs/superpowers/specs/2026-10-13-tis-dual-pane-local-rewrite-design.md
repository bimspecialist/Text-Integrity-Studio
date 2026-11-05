# Text Integrity Studio — Dual-Pane Editor and Fully Local Generative Rewriting

**Status:** OWNER-APPROVED DIRECTION (2026-10-13); DETAILED DESIGN FOR REVIEW; NO PRODUCTION CHANGES.
**Baseline:** existing main V6 8d08635bd2adf3e32e22ba3735a0049ea6b22b4c.
**Parent:** docs/superpowers/specs/2026-10-13-tis-path-a-reliability-design.md, including its natural-writing subsection 6.1.

## 1. User goal and constraints

Make one Text Integrity Studio website with the workflow strengths of Humbot (original/revised side-by-side), GPTZero (explainable AI evidence) and QuillBot (editable writing suggestions). Do not copy trademarks, proprietary UI assets, paid services, fake ratings or unverifiable detector promises. Maintain GitHub Pages, existing dark theme, Manrope and IBM Plex Sans Arabic, EN/AR RTL, the existing ONE prominent Analyze Text action, local-first privacy, and Word/PDF/TXT/OCR/edit/export.

**New explicit decision:** The full rewriting model executes ENTIRELY in the user's browser/on-device, not on external inference servers. Static library/tokenizer/model files may download via consented network GET; user source text, prompt containing text, and rewritten text never go to an external inference endpoint or third-party API. Full offline operation after download is contingent on intact, complete local cache and browser support; offline cannot be promised unconditionally.

**Scientific truth:** Arabic/English rewrite assistance is separate from the existing English-only AI authorship detector. A rewritten result does not become human-authored just because the raw research-model signal changed; no target-AI-percent optimization or automatic repeated scoring.

## 2. Considered architectures

| Choice | Pros | Cons | Decision |
|---|---|---|---|
| A: Local WebGPU/ONNX generation inside a same-origin Worker, plus deterministic editing fallback | Fully on-device inference, static hosting and editable local before/after drafts | Hundreds of MB first download, WebGPU/memory/device limits, uncertain Arabic output quality | SELECTED, pending real-device and license gates |
| B: Rules-only advisor | Works fast on modest devices, minimal download | Cannot satisfy full local generative document rewrite | Keep as graceful fallback without mislabeling |
| C: Cloud LLM/hosted rewriting | Potential quality/speed on weak devices | Violates owner constraint and changes privacy/hosting architecture | REJECT |

If no licensed candidate passes browser, English/Arabic writing quality, memory and network privacy tests, the product shows Full local rewrite unavailable rather than using remote AI or a fake deterministic rewrite.

## 3. Research candidates, NOT selected production dependencies

**Candidate 1 — evaluation only:** onnx-community/Qwen3-0.6B-ONNX, Transformers.js text-generation with device=webgpu and quantization q4f16. Its ONNX repository lists a 570 MB q4f16 model file; tokenizer, library overhead, caching and total device/GPU memory are additional and unmeasured. Base model Qwen/Qwen3-0.6B is published with Apache-2.0 license and described as multilingual; neither model-card description nor licensing of upstream weights alone proves converted ONNX artifact redistribution/license, Arabic fidelity, performance or browser deployment viability.

**Candidate 2 — evaluation only:** onnx-community/Qwen2.5-0.5B-Instruct ONNX q4f16 asset listed at about 483 MB. Verify original and converted license chain, immutable SHA, current WebGPU pipeline support, and task-specific results. Smaller/CPU alternatives may be researched but are never presumed feasible.

**Selection gate:** record real model/license manifest including source URL, exact immutable revision, SHA/file hashes where available, total observed transfer, exact runtime version, WebGPU requirements, cold/warm latency and RAM/GPU observations when measurable. Benchmark genuine English and Arabic passages on Chromium with controlled academic/formal/general fixtures. An independent review must explicitly approve the selected model. Unknown compatibility/license/quality => HOLD, not selection.

External technical references:
- https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX
- https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX/tree/main/onnx
- https://huggingface.co/Qwen/Qwen3-0.6B
- https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct
- https://github.com/huggingface/transformers.js/blob/main/packages/transformers/docs/source/guides/webgpu.md

## 4. User experience: two working panes, three views, one prominent action

**Large desktop (width >=1100px):** Top bar shows title, private-on-device indicator and EN/AR switch. Three simple peer tabs: AI Detection, Humanize, Writing Editor, all bound to ONE active DocumentSession. Below them: SOURCE PANE at inline-start (paste/upload, original text, status/word count) and OUTPUT PANE at inline-end (AI evidence when detecting, reviewed reworded draft when Humanizing, corrections when writing). In Humanize, both original and proposed text remain visible side by side, with aligned sections/diffs.

**Primary action:** Preserve ONE prominent global Analyze Text; this scans current text using local editorial rules and optional eligible English detector. The large generative model MUST NOT download automatically with ordinary Analyze.

**Contextual action:** On Humanize view or after reviewing suggestions, expose Rewrite locally as a secondary in-pane action. First use requests informed permission to download model/runtime assets with honest measured/estimated size, origin, and device support. This is NOT a second prominent global Analyze button. Controls: Natural, Clearer, Shorter, Longer. Longer cannot invent claims, numbers, sources or examples; when additional factual detail is needed, ask the user to provide it rather than hallucinate.

**Draft controls:** Preview/compare; Accept reviewed change; Undo; Copy; Download. Show source/draft difference, warnings, source-length and covered sections. No auto overwrite. Every edit invalidates prior detector evidence. Read-only original DOCX bytes remain unchanged unless existing safe user-authorized Word editing/export workflow is used; plain-text output is available.

**Mobile below 900px:** Stack Source then Output logically, provide pane-navigation or scroll target without hiding Analyze behind fixed controls. Support 390px RTL with mixed Arabic/Latin engineering terms, numbers, units and citations. Preserve keyboard, visible focus and WCAG 2.2 AA target.

**Advanced only:** optional model comparison, tokenizer coverage, performance detail and long-document modes. More document tools continues to own PDF/Word/OCR/cleanup/report options. No redundant switches or fictitious subscription controls.

## 5. Exact flows, states and recovery

1. Input pasted/imported -> immutable DocumentSession snapshot revision N. Read-only import notice if DOCX.
2. Analyze Text -> existing writing review + eligible EN local detector, with research signal or INCONCLUSIVE/UNSUPPORTED. No generator loading.
3. Humanize/Rewriting -> choose style and explicit Rewrite locally.
4. CONSENT_REQUIRED first-use dialogue -> show size, source, WebGPU/memory caveat. Reject consent keeps local light editorial suggestions.
5. CAPABILITY_CHECK -> WebGPU/security/device prerequisites, with unknown memory handled cautiously. Browser without WebGPU gets MODEL_UNAVAILABLE; no silent remote fallback.
6. DOWNLOADING_ASSETS -> only allowlisted static GET requests for weights/tokenizer/audited libraries; source never appears in URL, request bodies, headers, logs or telemetry; show measured bytes when available.
7. MODEL_READY -> local ONNX model resides in same-origin Worker or isolated browser runtime; source text is passed only through checked same-origin messages. Avoid concurrent heavyweight detector and rewriting model sessions on memory-constrained devices.
8. GENERATING -> sequential bounded chunks with deterministic source-span mapping, cancel token, request ID and revision, real chunk progress (completed/total).
9. DRAFT_READY or PARTIAL -> render only local draft and section diff; any lost/skipped sections are explicitly UNPROCESSED. Do not call PARTIAL a full rewrite.
10. USER_REVIEW -> factuality/protected-range flags; Accept requires manual reviewed chunks and current revision. Original is preserved and Undo available.
11. Optional second Analyze -> new explicit click; compare only compatible uncalibrated research-model signals and NEVER label as increased “human percentage.”
12. ERROR / CANCELLED / STALE -> clear late output, keep source intact, free resources where possible and allow retry of unfinished chunks.

**State union:** NOT_REQUESTED, CONSENT_REQUIRED, CAPABILITY_CHECK, MODEL_UNAVAILABLE, DOWNLOADING_ASSETS, MODEL_READY, GENERATING, PARTIAL, DRAFT_READY, REVIEWING, ACCEPTED, ERROR, CANCELLED, STALE. All states have localized text and recovery action. No fixed fake inference progress.

## 6. Logical module boundaries and contracts

Text adapters -> DocumentSession (revision) -> three independent consumers:
A. AnalysisController -> existing English ONNX detector -> EvidenceValidator.
B. NaturalWritingAdvisor -> local deterministic, suggestion-level editing.
C. LocalRewriteController -> capability policy -> model registry -> Worker bridge -> token chunking -> protected-facts checker -> dual-pane user review.

**New module contracts:**
- RewriteCapabilityPolicy.assess({navigatorInfo,deviceInfo,manifest}) returns {supported:boolean,reason,deviceProfile}. No hardcoded assumption that WebGPU or sufficient RAM exists.
- LocalModelRegistry.select({language,deviceProfile,manifest}) returns {modelId,revision,dtype,estimatedTransferBytes} or {blockedReason}. No unreviewed candidate enabled by default.
- RewriteChunkPlanner.plan(snapshot,{maxInputTokens,overlapTokens,language,sourceKind}) returns {chunks:[{id,start,end,text,tokenCount}],sourceCoverage:{coveredCharacters,totalCharacters},uncoveredSpans}. Reserve system prompt, continuity context AND output tokens inside each model context window. Overlapping source context must never double-count or duplicate final output.
- RewriteBridge.create({runtimeOrigin,workerFactory,registry,onEvent}) -> load({consentToken,modelId,revision}), generate({jobId,revision,chunks,style}), cancel(jobId), dispose(). Events are versioned, source/worker origin checked and fail closed.
- LocalRewriteController.create({session,capability,registry,bridge,planner,integrity,clock}) -> requestRewrite({style,context}), approveChunk(id), acceptReviewed(), undo(). Generation lifecycle is independent of detector scoring but observes DocumentSession revisions.
- RewriteIntegrityCheck.compare(original,proposed,{protectedRanges,locale}) -> {safeToApply,flags,protectedChanges}. Warn and block automatic Apply if dates/units/numbers/URLs/citations/quoted text visibly drift. It cannot prove semantic equivalence.
- DualPaneEditor.mount({source,outputRoot,resultsRoot,session,analysisController,rewriteController,locale}) -> {dispose}. All outputs rendered with textContent, never untrusted HTML.

**Memory policy:** At most one active heavyweight generator job; prevent the English detector and generator from accumulating multiple large GPU models concurrently on constrained devices. Offer release/unload/cancel; if cleanup cannot be guaranteed, report it, and preserve ordinary local editor.

## 7. Whole-document coverage and DOCX constraints

A “full rewrite” status REQUIRES 100% of eligible source-text spans accounted for, correct section order and every planned chunk completed. Process long source in controlled tokenizer-aware chunks, with prompt/output budgets and paragraph continuity. Report exact unprocessed ranges; no silent truncation, invented bridging paragraphs or hidden rewriting of sources. PARTIAL may be exported as explicitly partial draft with source selection; never falsely claim completion.

For uploaded DOCX, the extracted source can omit table structures/footnotes/track changes. Offer text draft and safe Word review/export only where existing mapping is supported; preserve original bytes, content citations and formatting when safe. PDF OCR uncertainty and mixed RTL document caveats are visible. There is no guarantee of lossless reconstruction of every arbitrary file type.

Arabic and English model tasks are separately benchmarked. Arabic rewriting may be enabled if the model passes local quality review, but this never enables Arabic AI detection. Mixed-language segments and technical terms get explicit source-preservation and manual review.

## 8. Privacy, prompt-injection safety and release rules

- No mandatory API keys, remote AI inferencing, server storage, document-body network requests, ads analytics or document telemetry.
- External downloads need separate explicit consent and provenance. Audit outgoing requests for synthetic source sentinel in URL/headers/body; no persistent user-text test artifacts. Initial downloaded weights may stay in browser cache independently of private documents.
- Untrusted source passages containing embedded “ignore prior instructions” or links are always *data*; rewrite prompts follow fixed developer instruction, Worker has no tools/plugins/network access other than audited model static assets.
- Review same-origin messages, sandbox/Worker isolation, CSP, trusted runtime supply chain, exact model revisions/licenses, unsafe HTML and source-modification boundaries. No claims of perfect isolation from malicious browser extensions or compromised upstream code.
- Output from a local generative model is untrusted until user reviewed; do not promise fully accurate claims/citations.
- Releasing reliable UI/editorial improvements is distinct from releasing experimental local generation. If generative quality/privacy/device gates fail, HOLD the generator and leave deterministic tools working.
- Publishing a statistically calibrated AI-authorship percentage remains independently BLOCKED/HOLD pending scientific benchmark and calibration evidence.

## 9. Acceptance gates and proof artifacts

- Real pinned, license-reviewed candidate runs **genuine** WebGPU generation on a medium desktop Chromium; record first download (570 MB q4f16 is file-level estimate only), warm/cold latency, observed RAM/GPU and actual supported device profile. A model card alone is not proof.
- No text-bearing third-party request before, during, or after generation; deny consent => no generator assets downloaded.
- Test actual Arabic and English academic/formal/general passages with a preregistered, source-grounded human quality rubric. Evaluate clarity, fluency, hallucinated facts, user review effort and protected-token preservation; no fabricated improvement or 99% figure.
- Same-length edit/new Word input/cancel/timeout/worker crash all invalidate stale drafts, retain source and enable controlled retry.
- All generated chunks mapped or explicitly PARTIAL; no source portions silently missing. Protect dates/figures/citations/units/proper names and review diff.
- One top-level Analyze, contextual local rewrite only, correct 390px mobile RTL, no horizontal overflow, accessible Apply/Undo.
- Word/PDF/OCR/export/previous real two-detector Chromium tests remain green.
- Separate real-generator integration smoke and release-specific public GitHub Pages availability check. Degraded WebGPU and blocked-network paths tested.
- Never substitute mock generator output for real production acceptance; if unsupported, show feature unavailable instead of fake completion.

## 10. Approval scope

The user approved the **product direction** of a dual-pane site plus a fully on-device generator with NO text submitted to external servers. The exact ONNX model and quantified quality/performance are not yet approved or proven, and are subject to feasibility gates. This document updates design and execution plans only; does not authorize product-code edits, merging into main or deploying.

**Status: NEW DETAILED SPEC AND EXECUTION PLANS FOR OWNER REVIEW.**
