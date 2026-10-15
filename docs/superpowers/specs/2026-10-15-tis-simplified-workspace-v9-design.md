# Text Integrity Studio — Simplified Professional Workspace V9 Design

**Status:** DRAFT FOR OWNER REVIEW — design specification only; implementation, merge, and deployment are NOT authorized.
**Date:** 2026-10-15.
**Repository:** bimspecialist/Text-Integrity-Studio.
**Evidence baseline:** feature/path-a-m0-core-reliability at 815fa4ff033ba4c26bd173ca38a202c2a5fe13a9, PR #16 (draft); public main at 8d08635bd2adf3e32e22ba3735a0049ea6b22b4c.
**Decision already approved:** option 2, “Simplified Professional Workspace”: a calm, professional, dark bilingual interface with three understandable modes and progressive disclosure. This does not constitute approval of this detailed document or permission to modify product code.
**Related pre-existing design:** docs/path-a-reliability-architecture-20261013, PR #15, especially the dual-pane local-rewrite specification. That draft lives on a DIFFERENT branch and is not assumed merged.

## 1. Goal, users, non-goals, and evidence

### Goal

Reduce the visible choices and cognitive load without deleting existing capabilities. A first-time user should paste text or import a document, select one obvious action, understand a truthful result, and then review, copy, apply, undo, or export without learning the internal architecture. The site remains a static, GitHub Pages-compatible, local-first document tool—not a copy of a competitor.

Primary user groups: student reviewing Arabic/English coursework; professional editing large, technical Word/PDF documents; writer comparing an original with a manually edited draft; researcher interpreting experimental English-only detector evidence.

### Confirmed repository facts

- docs/index.html currently has one canonical #source, one #file, a primary #scanAI, three tabs (#tisTabDetection, #tisTabHumanize, #tisTabEditor), and #tisRevisedText with reviewed Apply/Undo.
- Core owners already exist: docs/analysis/document-session.js (canonical revisioned document), analysis-controller.js (analysis lifecycle), evidence-contract.js, evidence-projection.js, app-adapter.js, and dual-pane-editor.js.
- docs/index.html currently loads app.css, v5-public.css, dual-pane-editor.css, and workspace-v8.css. Additional navigation/header/disclosure structures have accumulated. This is a maintenance and hierarchy risk, not proof of any specific observed performance regression.
- Automated Chromium tests and Quality Actions exist for desktop/mobile RTL, DOCX, PDF, OCR, cancellations, long input, stale revisions, and protected facts. A historical green CI run is evidence for THAT SHA only.
- Browser detector is experimental, English-only, and uncalibrated. Source README documents a >=120-English-word eligibility threshold and real false-alert risk; a research model signal is NOT an authorship percentage.
- The generative local rewriter is NOT enabled: local-rewriter-worker.js deliberately rejects LOAD with MODEL_NOT_VERIFIED; productionDefault in the research manifest is null. A simulated rewrite is prohibited.

### Assumptions to be validated at implementation time

- The existing static HTML/first-party JavaScript stack remains the preferred and lower-risk solution over replacing the site with React or a new hosted backend.
- Mode labels can be relabeled for clarity while keeping existing tab IDs, state ownership, and semantics.
- Moving existing controls into a more direct layout is preferable to rebuilding document parsers or model code.

### Unknown/unverified

No new first-time-user usability study, WCAG audit, real-device cross-browser performance measurement, independent authorship calibration, or licensed generative WebGPU acceptance is claimed by this document. They remain explicit validation tasks rather than presumed achievements.

## 2. Competitor-workflow comparison (inspiration only)

- GPTZero publicly documents paste/upload -> scan -> an explained result with relevant highlighting. Retain its short path and result explanation; DO NOT copy its numeric claims or visual identity. Reference: https://support.gptzero.me/articles/9172706201-how-do-i-use-gptzero
- QuillBot describes source entry, an optional writing mode, and side-by-side output/copy. Retain discoverable writing modes and an editable second pane; DO NOT imply that our disabled generator paraphrases anything. Reference: https://quillbot.com/paraphrasing-tool
- Humbot's Arabic page presents text entry, sample, upload, a mode, an action, and output. Retain a low-friction form and source-to-result transition without copying assets, proprietary layout, trademarks, or bypass claims. Reference: https://humbot.ai/ar/humanize-ai

**Positioning:** Clearer writing and transparent research evidence. No 100% human claim, detector-evasion promise, invented statistics, or silent replacement of authored text.

## 3. Information architecture and navigation

One header, one mode switcher, one main task region, one lightweight footer. Remove the SECONDARY sidebar navigation as a competing first-level system, the obsolete hero and three-step banners, duplicated export/navigation links, redundant call-to-action buttons, and repeated warning blocks in the default state. Preserve every underlying function through one predictable “More document tools / أدوات المستند” expandable entry.

**Header:** Text Integrity Studio brand at the start; language switch at the end; restrained local-privacy hint. No account, subscription, dashboard, or project selector added. Documentation/Privacy links live in the footer or more-tools menu, not beside the primary action.

**Modes:** exact three visible tabs (one AR/EN label per locale); keyboard navigable, one active selection:
1. AI Detection / كشف AI — source on left; summary and evidence on right after analysis. Empty right pane shows one actionable explanation, not analytics placeholders.
2. Improve Writing / تحسين الكتابة — source + revised draft; deterministic local writing suggestions and review controls. “Rewrite locally” is visibly unavailable with an accurate explanation until a separate model gate is approved.
3. Writing Editor / محرر الكتابة — source + revised draft; manual editing, find/replace, diff preview, copy, TXT export, Apply/Undo, and explicit DOCX read-only limitations.

Only #scanAI is visually primary in the working area in any one mode. Its label changes to reflect mode without creating additional execution authorities; in detection it invokes the existing analysis controller, in writing modes it invokes writing-only review. During active supported scan it becomes the same controller's Cancel control. Existing secondary #aiRun / #studioAiQuickRun and tool actions remain nonprimary and must never initiate duplicate analysis.

## 4. Page layout wireframes and responsive rules

### Desktop >= 901 CSS px

    +---------------------------------------------------------------------+
    | T. Text Integrity Studio                        Private | العربية    |
    | [AI Detection] [Improve Writing] [Writing Editor]                    |
    +---------------------------------+-----------------------------------+
    | SOURCE                          | CONTEXTUAL RESULT / REVISED DRAFT |
    | Upload DOCX/PDF/TXT  Paste       | Empty hint / research result     |
    | Source textarea                 | OR revised textarea             |
    | Word count and selected file    | Review, difference, copy        |
    | [      Analyze Text       ]     | Contextual next action          |
    +---------------------------------+-----------------------------------+
    | More document tools (collapsed, full capability preserved)          |
    +---------------------------------------------------------------------+

Maintain roughly balanced columns with minmax(0, 1fr), practical editor reading widths and no wasted half-page at 1150px RTL. On very wide displays, cap main task content near 1440px while allowing comfortable margins. No unnecessary 170px sidebar remains.

### Tablet 561–900 CSS px and mobile <= 560 CSS px

Single-column flow: compact header -> modes -> upload/paste + source -> one primary action -> contextual result or revised draft -> advanced tools. Results must be visible/reachable directly after the action; do not hide a completed result under an unrelated disclosure. At 320px and 390px, no horizontal page overflow, clipped labels, off-screen Apply/Undo, or obstructing sticky overlays. If tab labels do not fit, fit or wrap within the viewport, not a page-level horizontal scroller. Arabic uses the same order, logical CSS properties, and appropriately mirrored directional icons.

### Visual tokens (design targets to verify)

Preserve the approved V8 dark family, Manrope for Latin and IBM Plex Sans Arabic for Arabic, self-hosted only. Start from existing V8 references: background #0b0d13, surface #141721, text #f3f3fb, muted #a5acc4, accent #9487ff, positive #75d9b2, 10–16px radii. Move to one semantic token namespace under a scoped V9 root, then remove superseded overrides after regressions. Do not add gradient, glassmorphism, icon packs, fonts, or runtime CDN dependencies.

Suggested spacing scale: 4/8/12/16/24/32px; body type typically 14–16px; readable mobile typography; visible high-contrast focus ring; primary and destructive actions visually distinct. Values are implementation targets, not untested contrast or pixel-perfect claims.

## 5. Canonical data flow and integration boundaries

Do not replace backend or change model scoring to improve the redesign. Source session and analysis remain the single authorities:

    #file / #source input
        -> existing import/parser or input event
        -> TISDocumentSession revision/sourceKind
        -> TISAnalysisController (only in detection mode)
        -> validated TISEvidenceContract + TISEvidenceProjection
        -> existing presenter + new concise result shell

    #tisRevisedText (local, unsaved draft)
        -> TISDualPaneEditor preview/review/protected-fact checks
        -> explicit #tisDraftApply after validation
        -> TISDocumentSession revision change
        -> old detector evidence invalidated; Undo guarded

TISDualPaneEditor continues to OWN active modes via body[data-tis-mode] and tabs; V9 presentation reads this state and never creates a second document or analysis controller. Avoid duplicate event listeners, hidden duplicate ID elements, cloned textareas, or separate file loaders.

Existing public hooks used by app-adapter.js (TISWorkspaceV8.setAnalysisState, setWritingReviewResult) remain operational during migration through a small compatibility facade or a coordinated adapter switch AFTER focused tests pass. V9 owns ONLY layout and display copy, never scan decisions, model results, source revision, or document mutation.

## 6. Detailed actions, copy, and state contract

### Default / empty

Display concise title (“Check and improve your text” / “افحص النص وحسّن كتابته”), upload/paste affordance, editable source, one primary action, and a single hint (“Your text stays in this browser; optional models may download after your action” / “تتم معالجة النص محليًا، وقد يلزم تنزيل نموذج اختياري بعد موافقتك”). No score, empty card stack, oversized hero, false percentage, or automatic model request.

### Analysis

- EMPTY: prompt for source, not a failure label.
- READY: enable one #scanAI; prior result cleared.
- LOADING and ANALYZING: clear in-progress label, honest progress if known, cancel control and no duplicate request.
- WRITING_ONLY / UNSUPPORTED: show useful local writing observations, explain unsupported Arabic/mixed/short research detector. Never show an overall score.
- RESEARCH_SIGNAL: explicitly “Experimental, not a verified AI-authorship probability”; show coverage context; only actually evaluated passages may be highlighted.
- INCONCLUSIVE: show reason and explanation; no numeric overall signal.
- STALE: source changed; invalidate previous model result immediately, preserve user draft when possible, require new user-initiated scan.
- ERROR and CANCELLED: specific localized recovery message, original text unaffected; retry remains available.

### Editing / review

Original and revised panes remain separate. Suggestions require Preview -> Review -> explicit Apply; Undo and draft-reset recovery honor the existing revision guard. Reject changed citations, engineering units, dates/numbers/URLs and unsupported personal claims under existing protected-fact rules; do not claim semantic equivalence. If an edit happens during OCR/import/model execution, last valid source revision wins and stale completions are discarded. Unsaved revised drafts must not silently disappear when the user switches modes or requests Undo.

DOCX originals remain read-only for unsupported editing and preserve original OOXML; permit the existing tracked revision workflow, or plain-text draft copy/export, with limitations stated. PDF remains an extraction/OCR source rather than promising exact PDF re-authoring. Preserve TXT/MD/CSV/JSON and other currently accepted types.

### Consent and generative honesty

English experimental inference uses the EXISTING opt-in/user action and genuine local model. Plain writing-review modes MUST NOT trigger model download. The separately proposed large text generator stays disabled with clear copy; no cloud fallback, user-text egress, or invented replacement text. Heavy model assets, if ever approved separately, require new explicit informed consent for model download, artifact pin/license validation, WebGPU quality and security gates; beyond the scope of this V9 UX implementation.

## 7. Advanced tools and full-function inventory

Collapse less frequent actions behind one discoverable details region, grouped by user goal:
- Document processing: DOCX review/Track Changes/export, PDF text extraction and offline OCR (existing limits retained).
- Writing & review: grammar, local suggestions, cleanup safe/thorough preview, Unicode/security inspections, source/revised find/replace, history and report exports.
- Research details: supported English-only experimental model, model/coverage explanation, optionally second model, long-document sampling and research audit evidence.

All legacy control IDs and active event handlers remain reachable. A migrated action must have one visible route; no duplicate functional controls remain focusable when its panel is closed. Advanced details may be collapsed, but keyboard reachability and screen-reader semantics must remain correct.

Maintain existing documented limits unless a separate verified feature change is authorized: DOCX up to 18 MB, PDF up to 24 MB, PDF text extraction first 80 pages, OCR range at most 12 pages; detector eligibility >=120 supported English words and its existing length/coverage/window limits. If runtime limit differs from documentation, test and reconcile the conflict before changing UX copy.

## 8. Accessibility, localization, and security requirements

- Target WCAG 2.2 AA; keyboard-only mode switch, logical tab/tabpanel IDs, reachable upload, visible focus, aria-live status transitions, labeled textareas, correctly announced validation and progress, screen reader test, 200% zoom and reduced motion.
- No layout direction derived from icons or hard-coded left/right; document-root RTL affects visual flow while technical strings, file names, numbers, units and URLs use appropriate bidi isolation or dir=auto.
- Every actionable label and significant failure message has AR and EN; keep one language per active interface instead of simultaneous duplicated button text.
- Strict current CSP, no raw document logging/analytics, no user-text third-party requests on paste, typing, OCR, writing review, or optional local inference. First-party static assets preferred. Remote model/runtime supply-chain risk flagged independently in the current release checklist.
- No automatic storage of drafts in cloud/localStorage, no silent upload, no new accounts, no changes to detector thresholds, weights or calibration.
- Keep privacy.html and help.html aligned with actual behavior, not aspirational features.

## 9. Design acceptance matrix (measured at implementation time)

| ID | Acceptance assertion | Verification |
|---|---|---|
| UX-01 | One header, no redundant navigation rail, exactly one visible primary task action per mode | DOM/visual Chromium at 1440 and 1150 |
| UX-02 | Paste or supported file import -> one user action -> a stateful result; canonical revision updated exactly once | Browser integration |
| UX-03 | 901+ width shows balanced two-pane workspace in writing modes, with immediate contextual result in detection | Screenshots + layout geometry |
| UX-04 | 320/390/768 mobile/tablet + RTL have no page horizontal overflow and results follow the action | Browser geometry + screenshots |
| UX-05 | Mode switch never loses unsaved draft or fabricates new scan | Browser sequence tests |
| UX-06 | Original/DOCX protection, review/Apply/Undo, stale revision and protected facts remain correct | Existing editor tests + targeted new tests |
| UX-07 | Model states display honest eligibility/coverage; unsupported/INCONCLUSIVE have no overall number | Evidence tests + browser assertions |
| UX-08 | No outbound requests before optional consent; no user source text transmitted, even on exception/retry | Network interception privacy tests |
| UX-09 | PDF/DOCX/OCR/cleanup/export and accepted file variants remain reachable and operational | Existing browser/regression suites |
| UX-10 | AR/EN localization, tab focus, screen-reader labels, 200% zoom, keyboard navigation pass applicable QA | Automated + manual matrix |
| UX-11 | CSS tokens consolidated, duplicate selectors/obsolete default scaffolding reduced without hiding necessary controls | Static DOM/style audit + visual QA |
| UX-12 | Synthetic 20k-word source remains revision-correct; model performance is measured separately, not inferred | Existing long-editor test + same-run baselines |

UX metrics (proposed, not measured): within at most two deliberate user actions after entering text, the first-time user can start analysis; no hidden completed result; no secondary primary-looking AI action at rest; zero accidental source overwrites. Establish same-hardware V8 metrics before requiring an improvement claim.

## 10. Release, risk and rollback boundaries

V9 is a UI/UX modernization on the existing branch baseline. It is NOT scientific detector recalibration or a new model release. Separate Quality, real-model browser smoke, privacy, DOCX/PDF/OCR, RTL/mobile, accessibility manual review, CI, security assessment, owner approval, and actual postdeploy version verification are all required before public deployment.

High risks: CSS cascade conflicts; event duplication when relaying #scanAI; stale analysis displayed after input change; loss of unsaved drafts; DOCX changes masquerading as plain-text edits; consent accidentally bypassed by simplified copy; missed controls inside collapsed toolboxes. Each is assigned a regression test in the companion implementation plan.

Rollback: keep main at its independently observed good SHA until authorized; implement using a reviewable branch and commits; revert any candidate release by exact authorized commit and independently verify the restored Pages marker and UX. Never force-push main.

## 11. Review decision

Owner to review this entire design and companion DRAFT execution plan, request adjustments or approve both. Approval to REVIEW docs is not permission to merge into main or deploy. If the owner approves implementation, require selection of the available execution method and fresh baseline/release verification before any product-code edits.
