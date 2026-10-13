# Text Integrity Studio V3 — evidence-first delivery and release dossier

**Baseline:** main @ 5355be821d53f399ace47bda2e7225229e862516 (13 Oct 2026)
**Change surface:** docs/index.html, app.css, local insights modules, research UI model events, existing safe text importer, tests.
**Status:** browser editor enhancements implemented in PR #10. Detection accuracy **NOT scientifically certified**. This is a living release record: CI status is source-of-truth.

## Product contract — what is and is not implemented

| Capability | Status | Evidence / limitation |
| --- | --- | --- |
| Existing DOCX, PDF, scanned PDF OCR, TXT/MD/CSV/JSON | Retained | Existing public Chrome/Word/PDF/OCR regression suites |
| Plain-text file imports including TSV, LOG, YAML, TEX, SRT, VTT | Implemented | Extension/3 MB allowlist. Files are read as **plain text**; markup is not interpreted |
| Any file format whatsoever | **Not possible safely** | Proprietary binaries, encrypted files and arbitrary executable formats require dedicated, licensed parsers; refuse unsupported formats |
| Local file metadata | Implemented | Only extension, bytes, last-modified timestamp exported; **file name stays in tab only** |
| Local bilingual editorial profile per paragraph | Implemented | Section offsets, sentence lengths, lexical diversity, repeated-word heuristic; bounded to 120k UTF-16 units and first 500 sections by default with explicit partial flags |
| Full syntactic parsing / verified author fingerprint | **Not claimed** | Rule-based descriptive cues are not a dependency parser or biometric author identification |
| Model-sourced colored excerpt map | Implemented | Uses only real opt-in ONNX window offsets; unscanned spans neutral; text changes instantly invalidate stale results. Preview capped and labeled |
| Per-section AI research window evidence | Implemented with restrictions | Overlap-weighted mean shown **only** at >=60% local window coverage; it is *not* a calibrated paragraph authorship probability |
| On-device English ONNX / optional second detector | Retained | Real opt-in inference; historic GPT-2 model cannot prove modern generator coverage |
| Per-document **calibrated probability and statistical confidence margin** | **BLOCKED** | Needs independent representative provenance-audited calibration/holdout; no invented uncertainty or fake scores |
| Writing suggestions and editorial before/after | Implemented | Deterministic hints and existing writing-lab with user review. No automatic invented personal facts or deliberate typos |
| Local writing report, editor history | Implemented | JSON omits original text/file name; history labels live in memory this tab only |
| Secure cross-user team management on GitHub Pages | **NOT IMPLEMENTED** | Static pages cannot enforce trusted membership, access control or secure shared files |
| Arabic AI authorship probability | **NOT SUPPORTED** | No validated Arabic model+holdout; English detector is intentionally blocked for Arabic and mixed writing |

The public site must remain **simple by default**: upload/paste → Check → basic editorial observations; the heavyweight on-device classifier remains a clearly labeled voluntary research tool. Deep model comparisons and section details stay in disclosure panels.

## Multi-discipline responsibility matrix (engineering review roles)

These are **roles and review checklists**, not a claim that a separate paid team or human committee was convened.

| Role | Responsibility | Release evidence |
| --- | --- | --- |
| NLP engineer | Sentence/token segmentation, Arabic/English text boundaries, preserve offsets and semantic context | Unicode/RTL examples, token/segment unit tests, no silent text loss |
| Data scientist | Source provenance, deduplication, group-disjoint splits, FPR/FNR/precision/recall/F1/AUROC/Brier/ECE and Wilson/bootstrap CIs | Frozen real ONNX benchmark and untouched holdout |
| UI engineer | Dark editor, right review rail, heatmap, accessible progress/status and responsive RTL | Chromium desktop/390px browser screenshots and interaction assertions |
| Backend engineer | Bounded file parsers, private API, team membership enforcement, report contracts | Authenticated API tests, MIME/magic verification, tenant isolation |
| UX designer | 3-step core flow, progressive disclosure, non-accusatory warnings, no false precision | Structured usability/A/B protocol and accessibility audit |
| QA engineer | RED/GREEN history, integration, performance, privacy and cancellation/stale-state regressions | Passing immutable-commit CI and human review of failures |
| ECC methods reviewer | Research-first change, tests before implementation, security review, diff review and verification loop | Failed RED checkpoint, passing GREEN checkpoint, security checklist, no implicit auto-deploy |

## Phased delivery (estimates; not elapsed progress claims)

1. **P0 — Baseline / ECC RED-GREEN (1–2 days estimated).** Freeze main SHA, add failing regression contract, implement the minimum correct code. Exit: reproducible RED and GREEN evidence with unchanged Word/PDF/OCR.
2. **P1 — Local editor V3 (3–5 days estimated).** Responsive panel, per-section profile, safe evidence map, editable text, in-tab change history and text-free export. Exit: all desktop/mobile/RTL/evidence-staleness tests green. This PR delivers this code path.
3. **P2 — Evaluation upgrade (1–3 weeks estimated).** Licensed, original or independently auditable samples across engineering reports, native-language drafting, academic texts, short/long text and unseen generators. Exit: frozen splits, source manifests, FPR upper 95% by group, model-version pin and fairness/coverage evidence.
4. **P3 — Calibrated ensemble (conditional).** Train/calibrate on **training + calibration splits**, pre-register abstention thresholds; demonstrate value over primary-only on untouched release holdout. No score weights or model rollout if a measured improvement cannot be demonstrated.
5. **P4 — Authenticated teams and additional parsers (separate server deployment).** Design/implement multi-tenant access control and backend processing only after privacy/security approval and cost review.
6. **P5 — Controlled UX experiment and progressive launch.** Validate responsive layouts, screen-reader focus, research notices, error recovery, retention consent and release monitoring. Roll back a measured protected regression.

## Scientific metrics and release gates

Thresholds apply **only** when sample provenance/split integrity have been independently checked. The uncalibrated research signal at 80% is never a user-facing "probability of AI writing".

- Count raw TP/FP/TN/FN and **separately** the UI's explicit INCONCLUSIVE outcomes.
- Report FP/(FP+TN), FN/(TP+FN), precision, recall, F1, AUROC, Brier, ECE with denominators, **95% intervals**, dataset revision, model revision and subset provenance.
- Report each relevant language/domain/document-length group, edited/mixed documents, human non-native academic drafts, and generators held out entirely from fitting.
- Candidate gate (to be pre-registered, not retrospectively tuned): Wilson **upper** 95% FPR <=1% in each high-impact human-document group, with a useful pre-registered sensitivity floor, and **no materially worse** abstention/coverage in protected groups. A zero-FP group may still fail due to small sample uncertainty.
- Require grouped authors/article/prompt, deduplication, train/calibration/test isolation, and **no** weight/threshold fitting on external evaluation TEST cohorts.
- Compare baseline and candidate on the **same untouched holdout**, with identical model settings and document coverage rules. "Increase in detection accuracy" = only if confidence intervals and error analysis support it; otherwise INCONCLUSIVE.
- **Observed research limits:** external vendor-sourced 2026 104-text corpus saw 5/64 human false high-signals, 29/40 AI high-signals and 10/104 abstentions (3 human / 7 AI), measured from actual browser UI on 13 Oct 2026. These are not representative certified test labels and did not demonstrate error reduction; do not publish as product accuracy.

## Editorial assistance and responsible "humanization"

Improving clarity or authentic voice must preserve facts, citations, technical terminology and user agency. Refer to the before/after examples in the live Writing Techniques panel and the existing opt-in grammar tool.

| Technique | Before | After | Safeguard |
| --- | --- | --- | --- |
| Readable sentence rhythm | We measured the site. We logged the results. We checked the data. | We measured the site and logged the results. We then checked the figures against field notes. | Never change a causal or numerical claim |
| Specific lived detail | Our experiment was successful. | Our team compared readings from two runs; add actual values if available. | Do not fabricate a personal experience |
| Audience-appropriate phrasing | The aforementioned process was subsequently completed. | We then completed the process described above. | Use local idioms only when natural and accurate |
| Careful paraphrase | This solution may potentially enhance project outcomes. | This solution may improve outcomes if the measurements support it. | Preserve citations and attribution |
| Intentional typos | Add mistakes to look human. | Correct errors and write in an authentic voice. | Deliberate mistakes are discouraged; no detector-evasion promises |

**No rewriting engine can guarantee acceptance by commercial AI detectors.** Any evaluation against detectors is for bias/error research, not a strategy to defeat academic integrity screening.

Suggested editorial references: [U.S. Digital.gov plain-language guides](https://digital.gov/guides/plain-language), [Purdue OWL academic writing](https://owl.purdue.edu/owl/general_writing/academic_writing/index.html), and [Purdue OWL research/citation resources](https://owl.purdue.edu/owl/research_and_citation/resources.html).

## A/B usability validation: explicitly not yet run

- **A:** previous V2 layout; **B:** V3 dark editor/right-side actionable notes. Freeze identical editorial rule versions and detection controls.
- **Population:** consented independent English and Arabic desktop/mobile testers; assign at participant level; no instrumented user documents transmitted.
- **Primary outcomes:** median time to locate one actionable suggestion, task completion, erroneous AI-certainty interpretation, response to INCONCLUSIVE, and export success.
- **Secondary:** accessibility/RTL success, load time (cold/warm model separate), user comprehension of uncalibrated signal warning.
- **Guardrails:** no increase in confidential-document leakage, data loss, false authoritative AI claims, horizontal overflow, or broken Word/PDF/OCR interactions.
- **Analysis:** pre-specify sample size/power, randomization seed and stop conditions; compare by language/device without pooling away local regressions. **Not conducted** until participants and privacy consent exist.

## Team permissions: backend-authenticated design (not client-side placeholders)

- **Owner:** manage membership, retention and sharing. **Editor:** access permitted documents and apply changes. **Reviewer:** comment/approve only, no editing. **Viewer:** read explicitly shared reports only.
- Store team/document ownership on an authenticated service (Next.js private UI + API); enforce membership and document-level permissions **server-side on every request**, not based on a browser-controlled role.
- Tenant-bound document IDs; deny-by-default access, explicit invitations and revocation; short-lived sessions, CSRF/origin controls, audit events without raw text, encryption and deletion policy with consent.
- Verify owner/editor/reviewer/viewer role matrix, expired invites, revoked membership, tenant cross-access, URL ID enumeration and download authorization.
- **No team workspace/sharing control is exposed as functioning on the free GitHub Pages build.** A real backend and privacy/security review are prerequisites.

## Source safety and performance

- Plain-text imports must be extension-allowlisted, bounded (current 3 MB) and read as **text only**. Specialized DOCX/PDF/OCR modules remain in place, with their own size/type checks. Unsupported formats must report an error, never appear silently parsed.
- No app code may use untrusted text in innerHTML or dynamic script; suggestions, highlighted passages and report entries are generated with textContent.
- New local profile caps and preview limits are visible; never silently skip paragraphs or call preview coverage "full document coverage".
- Store only bounded, ephemeral in-tab history labels; reports omit raw document paragraphs, file names and auth tokens. Optional ONNX model downloads are opt-in, not confidential document uploads.
- Record cold download, warm inference, 1k/10k/120k-character profile CPU/heap measurements before making a medium-device speed claim; current browser smoke does **not** constitute full performance certification.
- Maintain rollback to the pinned main baseline if error, privacy, file parsing or responsiveness regressions emerge.

## Final decision meanings

- **ENGINEERING PASS:** declared static, unit, browser and integration gates succeeded on the specific HEAD.
- **RESEARCH ONLY:** per-section/classifier numbers are uncalibrated signals; confidence intervals on *corpus evaluation rates* must not be displayed as per-document confidence.
- **MODEL RELEASE HOLD:** any unsupported language, missing provenance/holdout, too-small sample, disagreement/heterogeneity or failed statistical gate must remain INCONCLUSIVE rather than fabricate a percentage.
- **TEAM FEATURE HOLD:** without server authorization, do not promise functioning team permission management.
