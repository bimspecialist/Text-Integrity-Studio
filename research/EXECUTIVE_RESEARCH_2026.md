# TEXT INTEGRITY STUDIO
## Executive research, system strategy, roadmap and evaluation proposal
**Revision:** 1.0 | **As of:** 12 October 2026 | **Owner:** Text Integrity Studio project | **Status:** Research-backed design / prototype; classifier validation not started.

> **Decision summary:** Keep a free, local-first GitHub Pages editor for document forensics, transparent editorial suggestions and exports. Develop AI-text detection as an optional, separately validated research capability with abstention, domain statements, subgroup error rates and provenance support. Do not promise “0% AI”, guaranteed origin, watermark deletion, or automatic humanization through deliberately added mistakes.

### Executive decision matrix

| Decision | Recommendation | Why |
|---|---|---|
| User-facing value | Document integrity + writing quality first | Measurable without guessing authorship |
| AI classification | Defer public percentages until model and calibration gates pass | False-positive and domain-shift evidence is substantial |
| Arabic | First-class MSA, Saudi/Gulf dialect and code-switch testing | English scores cannot be transferred across languages |
| Rewrite workflow | Opt-in, tracked, meaning-preserving edits | Helps author voice without manufactured errors |
| Hosting | GitHub Pages + local browser analysis | No recurring hosting requirement for the baseline |
| Advanced inference | Optional isolated, authenticated backend, only if a benchmark justifies it | Privacy, performance, quota and cost boundaries |
| Academic integrity | Never accuse or clear an author based solely on a detector | Outputs are probabilistic and contextual |

## 1. Scope and methodology
This report reviews (a) peer-reviewed and official academic literature, (b) vendors' published operating constraints, (c) practitioner narratives, and (d) the actual deployed GitHub repository. Retrieval period: October 2026; published materials cited by year below. Unverified vendor marketing claims and unverified online anecdotes are not treated as experimental results. The immediate product baseline is the owner-managed public repository https://github.com/bimspecialist/Text-Integrity-Studio and its GitHub Pages site.

**Observed baseline (repository audit):** bilingual Arabic/English page; Unicode and writing-quality checks; DOCX Open XML local extraction; preview and safe Unicode cleanup; Word download; GitHub Actions DOCX roundtrip/Chrome smoke tests. The current implementation now supports **reviewable tracked Word edits for simple main-document text runs**, but not complex OOXML redlining. It does not ship a calibrated AI classifier, a full contextual grammar engine, or true graphical/statistical watermark removal. A separate offline classifier-training research pipeline exists but no pretrained model is deployed.

**Assumptions:** One maintainable product; English and Arabic are priority; hosting should remain free where feasible; academic writers, engineers and document authors are primary users; confidential document text must not silently leave the user's browser. Vendor availability, prices, model licenses, and rules may change.

## 2. Landscape: products and methods
| Tool or method | Useful role | Risk / limitation | Proposed project response |
|---|---|---|---|
| Turnitin AI Writing Report | Institution-integrated AI-writing indicator and eligible-passage report | Requires supported prose/language/word count; not proof of misconduct | Explain coverage and uncertainty rather than imitate a vendor score |
| GPTZero | Accessible external detector and educational workflows | Vendor-specific threshold and false-positive handling require independent validation | Optional manual cross-check only, never automatic upload |
| Copyleaks | Commercial detection and API candidate | Integration, pricing, dataset and privacy review required | Consider as benchmark comparator if approved |
| Originality.ai, Pangram | Comparative detector candidates | Commercial claims may not generalize outside the vendor's benchmark | Test blind holdouts with same input samples |
| QuillBot | Separate proofreading, paraphrase and free detection workflows | Paraphrase can alter technical meaning; vendor scoring is not calibrated for our samples | Preserve original wording and record each accepted edit |
| LanguageTool | Multilingual grammar/style suggestions and documented HTTP API | External request transmits input; free quotas and commercial-use terms must be checked | Optional consented provider or local server deployment |
| MS Word Editor | Office-native grammar and revision history | Requires suitable Office workflow; may not be free for all features | Treat tracked revisions/version history as contextual provenance |
| RAID / M4 / EvoBench | Published evaluation data and methodology | Benchmark accuracy is not production accuracy | Use domain/model/locale holdouts |
| SynthID Text | Origin-specific text watermarking in supported generation pipelines | Not a universal watermark detector; arbitrary Unicode cleaning cannot decode it | Keep watermark, Unicode, and authorship signals separate |

**Product-status verification:** Turnitin's current help page lists eligible long-form prose of 300–30,000 words in English, Spanish, Japanese and Arabic, with a file under 100 MB; eligibility and rollout can vary by account. Its guidance notes lower-percentage false-positive risk. QuillBot's June 2026 help article says its detector is free with different batch-upload convenience. LanguageTool's public HTTP API documents 20 free requests per minute and 20,000 characters per free request, plus additional conditions. Sources: [S8][S9][S10]. Never silently send university or company text to these services.

## 3. Research synthesis and findings
| Research / evidence | Date | Evidence and scope | Product implication |
|---|---|---|---|
| OpenAI discontinued AI Text Classifier | 2023 | Reported 26% true positives and 9% false positives on its challenge set; classifier withdrawn for low accuracy | No universal or definitive score label [S1] |
| Liang et al., Patterns | 2023 | Seven detectors averaged 61.3% FPR on 91 human-written non-native TOEFL essays; specific population and products | Require non-native English FPR audits and appeals [S2] |
| Weber-Wulff et al., IJ Educ Integrity | 2023 | Evaluated 14 tools; concluded their tested tools lacked sufficient reliability across conditions | Do not use output as sole misconduct evidence [S3] |
| RAID, ACL | 2024 | Over 6M generations; 11 models, 8 domains, 11 attacks, 4 decoding methods; generalization vulnerabilities | Test domain, model, decoding and robustness independently [S4] |
| M4, EACL | 2024 | Multi-generator / multi-domain / multilingual corpus; cross-model/domain shifts are challenging | External test splits need unseen topics/models [S5] |
| Learning2Rewrite, ACL | 2025 | Detector method based on editing-distance signal across diverse domains | Keep experimental detector branch separate from writing editor [S6] |
| EvoBench, ACL | 2025 | 14 methods evaluated across evolving LLM versions; models lost generalization | Time-indexed and model-version holdouts [S7] |
| AraGenEval, ArabicNLP | 2025 | >47K authorship-related paragraphs; shared Arabic authorship/detection tasks | Valuable Arabic dataset but not universal dialect accuracy [S11] |
| AbjadGenEval, EACL | 2026 | Arabic/Urdu shared task: best Arabic F1 .93 and Urdu .89 on the task; transfer remained challenging | No extrapolation from news benchmarks to Saudi university essays [S12] |
| Kashif-AI, AbjadNLP | 2026 | Validation-to-blind-test generalization gap despite augmentation | Use untouched blind holdouts [S13] |
| Who wrote this?, IJ Educ Integrity | 2026 | 160 constructed documents; compared GPTZero, Pangram, Copyleaks and Turnitin; detected differences across full AI, hybrids and transformed AI | Hybrid authoring must be its own label category [S14] |

**Interpretation:** Some contemporary detectors can work well on narrowly defined evaluation sets, and a 2024 ETS study found favorable results for carefully constructed detectors on one GRE setting [S15]. The correct conclusion is not “no detection ever works”; it is “performance is distribution- and method-dependent.” The product must expose the tested operating domain, actual false-positive uncertainty and conditions for abstaining.

## 4. Common user issues and failure taxonomy
1. **False positives:** Human academic or second-language writing flagged because it is formulaic, short, heavily edited, highly predictable or resembles training-domain text.
2. **False negatives:** AI output missed after domain shift, hybrid authorship, translation, post-editing, different model version or unfamiliar sampling.
3. **Score confusion:** Users read “80% AI” as “80% of words from a chatbot” or as an 80% posterior probability without proper calibration.
4. **Document processing errors:** DOCX text boxes, headers, hidden text, comments, revision history, tables, footnotes, image-based pages and corrupted ZIP content.
5. **Arabic and dialect gaps:** Missing vowel marks, Gulf dialect, Arabic-script homoglyphs, code-switching, punctuation, diacritics, morphology and false segmentation.
6. **Rewrite damage:** Loss of citations, numbers, proper names, engineering units, qualifiers and nuanced claims; overly uniform style.
7. **Privacy confusion:** Copying private assignments, engineering project reports or personal data into external APIs without a suitable decision.
8. **Overreliance:** A single score triggers penalties despite human revision histories and contradictory evidence.

**Practitioner reports:** Student and teacher Reddit threads from 2025–26 describe false flags, anxiety and students intentionally lowering writing quality. These are self-reported anecdotes, useful for discovering pain points but not representative measures of actual detector FPR [S16][S17].

### Error priority
| Category | Severity | Mitigation |
|---|---|---|
| False allegation on verified human text | Critical | Abstain, low-FPR threshold, human review and recorded appeal |
| Undisclosed transfer of document to another vendor | Critical | Local default, explicit consent, provider disclosure |
| Corrupted DOCX or lost references | High | ZIP limits, non-destructive copy, byte-level fixture tests |
| Changes that alter numbers, citations, safety claims | High | Protected spans, diff + explicit approval |
| Arabic dialect over-normalization | High | Dialect setting + non-prescriptive suggestions |
| Unreliable short-text classification | High | Minimum support warning + no-score state |
| UI fails in Arabic RTL or mobile | Medium | Bilingual keyboard/mobile regression tests |

## 5. Technical approaches to detection
**Stage D0: No classifier.** Provide document forensics, quality checks, provenance assistance and “Not evaluated” state. This is the correct state of the current prototype.

**Stage D1: Transparent baselines.** Benchmark TF-IDF character and word n-grams with logistic regression, entropy/perplexity baselines, and an explicitly calibrated transformer candidate (e.g., XLM-R for multilingual). Baselines should be audited in English/Arabic independently. Do not assume a generative model is necessary to obtain a useful baseline. Record model licensing and training-data provenance.

**Stage D2: Generalization and ensemble experiments.** Compare on RAID, M4, AraGenEval/AbjadGenEval, and independent academic-domain documents. Inspect performance on unseen generator families, time updates, bilingual text and hybrid authorship. Calibrate only on a separate validation set, then lock thresholds.

**Stage D3: Conditional user signal.** If all release gates pass, label a result as “Classifier signal; calibrated within tested domain,” with model version, date, adequate input length, confidence interval or calibrated range, explanation of false-positive testing and an explicit “uncertain” output. A score never becomes definitive authorship proof.

**Probability vs score:** A raw 0.86 model signal is not automatically P(AI-written | text)=0.86. Calibration, population prior and operating domain matter. Distinguish model score, confidence band, threshold, predicted class, and passage fraction. Abstention is preferable to invented precision.

**Authorship evidence:** When legitimately available, user-authorized revision history, document timestamps, source drafts and an author's explanation can support review. Do not claim cryptographic proof from ordinary DOCX metadata. SynthID is a specific generation-time statistical watermark approach, not a string of invisible Unicode characters [S18].

## 6. Writing improvement and ethical practice
The goal is **stronger writing that faithfully reflects the author's own ideas and evidence**, not deceptive authorship spoofing. Keep a review-first sequence:
1. Extract text and identify its language, dialect, structure and protected spans.
2. Run Unicode/security and grammar checks; show location, original text, suggested revision, rationale and confidence level.
3. Suggest concise alternatives, redundancy removal, paragraph flow and punctuation only where compatible with tone. For Arabic, make dialect-to-MSA changes opt-in and avoid forcing one dialect.
4. Apply only accepted edits; retain undo history, original copy and change log.
5. Verify citations, numerical quantities, names, quotations, modality (“may” versus “must”) and engineering/legal meaning.
6. Export a Word/text copy without overwriting the original.

**Human-like quality, not fabricated mistakes:** Natural, authentic author voice can involve sentence-length variation, context-specific examples, precise technical terms and original argument structure. The product must not generate intentional typographic errors or cycle transformations solely to reduce a detector score. Defensive evaluation may test such transformations on **authorized benchmark samples** to assess detector robustness, but that is not a user-facing “evasion service.”

**Legal/ethical boundaries:** Respect academic institution disclosure rules, third-party terms, copyrighted text, consent, and applicable data protection requirements. No automatic upload to detector APIs. The current site does not render legal advice and cannot certify compliance. Saudi deployment with personal data should assess the Saudi PDPL and implementing regulations before remote processing [S19].

## 7. Product UX / user journeys
### Information architecture
- **Workspace:** Paste/type or load DOCX/TXT/MD; source status and file size; clear consent language.
- **Integrity:** Invisible Unicode and direction controls; Word hidden runs and tracked changes; before/after diff; copy/export.
- **Writing Lab:** Issue filters (grammar, spelling, punctuation, clarity); individual approve/reject; review-in-context; structured change log.
- **AI Signal (future):** “Not evaluated” until validated; later input eligibility, calibrated uncertainty, sample caveat, decision help and appeal text.
- **Report:** Summary with method/version/covered sections, exclusion list, reproducible diagnostic JSON and human-readable Markdown/PDF.
- **Settings:** Arabic/English and RTL/LTR, theme, local-only default, provider consent and opt-out; accessible labels and keyboard navigation.

### States / accessibility
Explicit empty, parsing, analyzing, partial, unsupported, successful, failed, too-large and offline states. WCAG 2.2 AA target; native buttons and form labels; visible focus; responsive panels; no color-only state; reduced motion. Important copy: “AI percentage unavailable” instead of displaying an invented bar. Privacy promise is limited to document *content*: GitHub Pages itself may log a visitor IP for security [S20].

### Key workflows
A. University assignment: upload DOCX → Unicode/Word audit → optional writing suggestions → reviewer approves → download clean DOCX or TXT and report → retain author drafts.

B. Engineering report: protect units, section references and equipment IDs → check ambiguous phrasing → no automatic number changes → download revised copy and issues list.

C. Arabic bilingual submission: automatic RTL/LTR with explicit dialect option → prevent false “grammar” corrections to Gulf dialect → keep mixed Latin numbers and citations intact.

## 8. Architecture and API boundaries
### Current no-server baseline
    Browser / private document memory
      ├─ DOCX ZIP parser + OOXML reader (bundled JSZip)
      ├─ Unicode scanner and safe cleanup
      ├─ Writing rules engine and review UI
      ├─ Evaluation-independent quality indicators
      └─ DOCX / TXT / JSON / Markdown exports
    Static deployment: GitHub Pages
    No model API key, database or document upload required.

### Optional future architecture
    Web SPA (static Pages or hosted frontend)
          └─ POST /v1/analysis/jobs (consented, authentication required)
                 ├─ job queue + size/quota/PII validation
                 ├─ stateless worker, pinned detector model version
                 ├─ optional private proofreading model
                 ├─ calibrated scoring + abstention & provenance report
                 └─ short-lived encrypted result (retention default OFF)
    Monitoring: aggregated latency/cost/error metrics only; no raw text logging.

**API contract proposal:** request {document_hash, locale, domain, consent_scope, text_or_encrypted_reference, model_version}; response {job_id, status, model_version, coverage, calibrated_score_or_null, score_status, confidence_method, findings, disclaimers}. Mandatory 401/403 auth and quotas, 413 size enforcement, 422 unsupported text, 429 rate limits, 503 degraded. Idempotency per hash/job only with a documented retention policy. Do not expose provider tokens in JavaScript.

**Security baseline:** HTTPS, CSP without inline script after refactor, local first, safe text rendering (textContent, not user-controlled HTML), archive size/decompression controls, no macros, dependency SBOM and pinning, automated tests, versioned audit logs without document contents, rate limits and anti-abuse for any backend. Align risk inventory to OWASP LLM 2025 when remote generative models are introduced [S21].

**Scalability:** Static local analysis scales with visitors because CPU/RAM work stays on client devices; GitHub Pages has published site and soft bandwidth limits [S22]. A future backend needs queue, per-user concurrency, streaming progress, caching only with consent and deletion contracts. Do not add Kubernetes or GPUs until measured demand warrants it.

## 9. Technology and cost options (USD)
| Phase | Indicative deployment | Approximate recurrent infrastructure | Notes |
|---|---|---|---|
| P0 current browser-only | GitHub Pages; bundled JavaScript | $0/mo for qualifying public repo | Browser device bears processing cost, domain optional [S20] |
| P1 small remote API (optional) | CPU VM, 2 vCPU / 4 GiB | about $24/mo baseline compute | Example DigitalOcean Basic listing as of Oct 2026; excludes backups, transfer overages, AI vendor charges [S23] |
| P2 lightweight consented edge functions | Cloudflare Workers Free if supported | $0/mo inside documented quotas | 100,000 requests/day and constrained CPU; unsuitable for heavy model inference [S24] |
| P3 self-hosted large NLP inference | GPU instance / model server | QUOTE REQUIRED | Cost depends on model memory, concurrent throughput, region, idle utilization and provider. Benchmark before purchase |

Developer workstation for P0: modern 4-core CPU, 8-16 GB RAM, Windows/macOS/Linux; no GPU required for browser rules. Experimental local transformer training: 16-32 GB RAM, optional >=12-24 GB GPU VRAM for modest fine-tuning; verify the chosen model rather than treating specs as universal. Budget staffing separately; **planning assumption**: 1 web developer + 1 NLP evaluator + part-time UX/privacy reviewer for the advanced phase. Published cloud prices can change.

## 10. Tests, A/B experiments and success targets
### Current prototype tests
- JavaScript syntax / bilingual writing rules
- Word XML parsing, safely handling ZIP archives, preserving media
- Chrome: DOCX upload, preview, downloadable DOCX, Arabic switch, responsive smoke
- Python: confusion matrices, Wilson 95% intervals, abstention, AUROC, strata and inconclusive gates
All tests must run on every pull request; report which tests actually passed, not just that the workflow exists.

### Independent evaluation
The executable framework is at evaluation/score_detector.py; full protocol in evaluation/README.md. Establish a consented human-written and AI-written test set split by document, author, topic and model family. Recommended first sample **>=400 verified human + 400 AI passages per major language**, plus domain/dialect holdouts; refine power based on the desired upper false-positive bound. Report FPR and Wilson 95% confidence intervals per group; TPR, precision (with base rate), AUROC, coverage/abstain; ECE/Brier only on calibrated probability outputs.

**Proposed gates (not achieved):**
- overall FPR 95% upper bound <=1% in the *declared* domain,
- FPR 95% upper bound <=2% in supported language/dialect groups,
- >=90% coverage on eligible material,
- zero critical document/data-leakage failures,
- no unreviewed substantive changes to engineering quantities/references,
- no classifier-origin conclusions used alone for accusations.
If evidence is missing: **INCONCLUSIVE**.

### A/B editorial workflow
A = raw cleanup only; B = opt-in Writing Lab. Randomize consented users by session and blind reviewers to variant. Primary KPIs: editor preference, correction usefulness, meaning preservation, time to reviewed output, accepted versus reversed suggestions, DOCX export completion. Sample-size calculations must use measured baseline variance. Set an experimental planning goal of **>=10% improvement in reviewed editing completion** without a statistically meaningful rise in meaning errors. This is a hypothesis, not observed performance.

**Detector-score reduction targets:** do not target a lower score as the product's writing success metric. Detector drift under authorized rewrites can be evaluated as a research *robustness* metric and reported with original/rewritten confusion matrices; optimizing to 0% would reward gaming rather than truth.

## 11. Development roadmap and GO/NO-GO points
| Phase | Planned window | Owner | Deliverable | Gate |
|---|---|---|---|---|
| P0: Research and browser rules | 0-2 weeks | Web + NLP | Evidence report, writing rules, Word QA, eval runner | Stable regression tests |
| P1: Document workflow | 2-5 weeks | Web + UX | Accepted-edits DOCX export, comments/notes detection, rich diff, source tracking | Word formatting and citation preservation |
| P2: Data & ethical detector benchmark | 5-10 weeks | NLP + reviewer | Dataset provenance manifest, baseline models, multilingual calibration and fair comparison | Pre-registered FPR/CIs, licensed data |
| P3: Optional model service | 10-14 weeks | Backend + security | Privacy opt-in endpoint, quota, isolated workers, model/version audit | Threat model + secured launch |
| P4: Limited pilot | 14-18 weeks | Product + academic reviewer | A/B study, appeal workflow, drift report | GO only if no critical failures |

**Stop conditions:** severe false positives without safe abstention, unconsented third-party transfer, corrupted Word exports, unexplained model provenance, unverifiable data rights, or inability to explain a score's operating domain. Do not publish AI classification as “reliable” before data supports it.

## 12. Deliverables and acceptance status
| Deliverable | Location | State |
|---|---|---|
| Executive research and references | research/EXECUTIVE_RESEARCH_2026.md | Prepared in repository |
| Bilingual editorial prototype | docs/index.html + docs/writing-rules.js + docs/writing-lab.js | Implemented, regression validation required |
| Existing DOCX/Unicode scanner | docs/word-docx.js | Existing implementation, regression protected |
| Detector scoring framework | evaluation/score_detector.py | Implemented; NOT an AI model |
| Measurement protocol | evaluation/README.md | Proposed release gates |
| Working model + validated AI probability | Future work | NOT IMPLEMENTED — explicitly NOT EVALUATED |
| Word Track Changes for eligible simple text runs | docs/docx-editor.js + docs/writing-lab.js | IMPLEMENTED / BROWSER QA; limited scope |
| Rich editorial support for hyperlinks, field-coded paragraphs, existing revisions and all OOXML structures | Future work | NOT IMPLEMENTED |
| Local optional baseline classifier training, calibration and A/B metrics | evaluation/train_baseline.py + evaluation/ab_editor.py | IMPLEMENTED as research utilities; no model released |
| No-network CSP and privacy disclosure | docs/index.html + docs/privacy.html + SECURITY.md | IMPLEMENTED; header-level protections unavailable on GitHub Pages |

## 13. References and evidence register
- **[S1] OpenAI (2023).** New AI classifier for indicating AI-written text; discontinued July 20, 2023. https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/
- **[S2] Liang et al. (2023), Patterns.** GPT detectors are biased against non-native English writers. DOI 10.1016/j.patter.2023.100779. https://doi.org/10.1016/j.patter.2023.100779
- **[S3] Weber-Wulff et al. (2023).** Testing of detection tools for AI-generated text, International Journal for Educational Integrity. https://doi.org/10.1007/s40979-023-00146-z
- **[S4] Dugan et al. (2024), ACL.** RAID benchmark. https://aclanthology.org/2024.acl-long.674/
- **[S5] Wang et al. (2024), EACL.** M4 multilingual benchmark. https://aclanthology.org/2024.eacl-long.83/
- **[S6] Hao et al. (2025), ACL.** Learning to Rewrite: Generalized LLM-Generated Text Detection. https://aclanthology.org/2025.acl-long.322/
- **[S7] Yu et al. (2025), ACL Findings.** EvoBench. https://aclanthology.org/2025.findings-acl.754/
- **[S8] Turnitin Guides (retrieved October 2026).** Using the AI Writing Report. https://guides.turnitin.com/hc/en-us/articles/22774058814093-Using-the-AI-Writing-Report
- **[S9] QuillBot Help Center (June 2026).** Free AI Detector FAQ. https://help.quillbot.com/hc/en-us/articles/35295733817111-Is-Quillbot-s-AI-Detector-free-or-premium
- **[S10] LanguageTool (retrieved October 2026).** HTTP API documentation. https://languagetool.org/http-api/
- **[S11] Abudalfa et al. (2025), ArabicNLP.** AraGenEval shared task. https://aclanthology.org/2025.arabicnlp-sharedtasks.1/
- **[S12] Ezzini et al. (2026), AbjadNLP.** AbjadGenEval. https://aclanthology.org/2026.abjadnlp-1.68/
- **[S13] Emad Eldin (2026), AbjadNLP.** Kashif-AI. https://aclanthology.org/2026.abjadnlp-1.60/
- **[S14] International Journal for Educational Integrity (2026).** Who wrote this? Evaluating AI detection tools. https://link.springer.com/article/10.1007/s40979-026-00226-w
- **[S15] Computers & Education (2024).** Detecting ChatGPT-generated essays in a large-scale writing assessment. https://www.sciencedirect.com/science/article/pii/S0360131524000848
- **[S16] r/Teachers, November 2025 (anecdote).** https://www.reddit.com/r/Teachers/comments/1p85k9h/
- **[S17] r/Professors, March 2026 (anecdote).** https://www.reddit.com/r/Professors/comments/1rjl5u0/
- **[S18] Google DeepMind (2024).** SynthID for text/watermarks. https://deepmind.google/blog/watermarking-ai-generated-text-and-video-with-synthid/
- **[S19] SDAIA (retrieved October 2026).** Laws and regulations including Saudi PDPL and implementation. https://sdaia.gov.sa/en/SDAIA/about/Pages/RegulationsAndPolicies.aspx
- **[S20] GitHub Docs (retrieved October 2026).** What is GitHub Pages? https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- **[S21] OWASP (2025).** Top 10 for LLM applications. https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/
- **[S22] GitHub Docs (retrieved October 2026).** GitHub Pages limits. https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- **[S23] DigitalOcean (retrieved October 2026).** Basic Droplet prices. https://www.digitalocean.com/pricing/droplets
- **[S24] Cloudflare (retrieved October 2026).** Workers Free quotas and pricing. https://www.cloudflare.com/plans/developer-platform/

**Evidence policy:** Source links are direct primary publication / official documentation links wherever possible. All cited values are source-contextual. Product targets, costs and engineering schedules are proposals or indicative estimates, not observed results or guarantees.
