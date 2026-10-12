# Text Integrity Studio — Development Roadmap
Version 1.0 / 12 October 2026. **Dates and staffing are planning assumptions, not commitments.**

## Product objective
Ship a maintainable, bilingual, privacy-first writing and document-integrity website. Do not publish AI-authorship percentages before independent validation. Treat rewrite quality and AI detection as separate capabilities.

## Work package table
| ID | Priority | Duration (planning) | Owner role | Deliverable | Acceptance / exit |
|---|---|---|---|---|---|
| WP01 | P0 | Weeks 0-2 | Web + test | Browser Word/TXT importer and ZIP checks | No DOCX corruption in fixture suite; user files remain local |
| WP02 | P0 | Weeks 0-2 | Web + language QA | Bilingual writing suggestions and diff review | English/Arabic rule regression passes; no unreviewed changes |
| WP03 | P0 | Weeks 0-2 | NLP/eval | Research register + independent benchmark scorer | Metrics report uncertainty and missing evidence as INCONCLUSIVE |
| WP04 | P1 | Weeks 2-3 | Web/UX | Protected segments (quotes, citations, units), in-context word suggestion cards | 0 unapproved edits to protected spans in test fixtures |
| WP05 | P1 | Weeks 3-5 | Web/OOXML | Rich DOCX editorial edit mapping and tracked changes | Complete word-run tests; no broken tables/images or citations on examples |
| WP06 | P1 | Weeks 3-5 | Security/privacy | CSP refactor, dependency review, privacy disclosure, appeal workflow | Threat review completed and consent transfer tests pass |
| WP07 | P2 | Weeks 5-7 | NLP + independent reviewer | Representative English/Arabic human-vs-AI benchmark | Provenance, licensing and group-split audit passed |
| WP08 | P2 | Weeks 7-10 | NLP | Baselines, calibration, dialect/length/domain stress tests | Release gates pre-registered, all group CIs reported |
| WP09 | P3 optional | Weeks 10-13 | Backend/DevOps | Isolated opt-in inference API with quotas + no text logs | API security test, version pinning, deletion and rollback accepted |
| WP10 | P3 | Weeks 13-18 | Product + UX researcher | Pilot and blind writing A/B study | Blind quality improves without higher semantic-error rate; critical failures zero |

## Current state
- **Implemented:** GitHub Pages site, local Unicode/Word inspection, DOCX preview/export, bilingual writing rules and review UI, benchmarking script and test suites.
- **Partially implemented:** Editorial suggestions for extracted DOCX (plain-text preview/copy/export; **not** rich-text DOCX rewrite).
- **Not implemented:** production grammar model, calibrated detector, provider API, PDF extraction/OCR, user accounts, external model data transfer.
- **Documentation:** research/EXECUTIVE_RESEARCH_2026.md and evaluation/README.md.

## Resourcing
Baseline hosting: free GitHub Pages in public repository (subject to documented limits). For any opted-in remote CPU service, use measured demand before choosing capacity; a 2-vCPU/4-GiB DigitalOcean Basic VM is listed around $24/month as of Oct 2026, excluding backups, bandwidth excess and inference usage. A large self-hosted model budget is **unknown until model selection and load testing**.

Illustrative team: 1 web developer (primary), 1 NLP evaluator (benchmark phases), part-time Arabic proofreader, privacy/security reviewer and UX tester. A single-person implementation is possible with a longer schedule; do not pretend the same elapsed time applies.

## Definition of done for public AI score
Must pass independent gold-label provenance review; sample/group sufficiency; FPR upper Wilson bound target <=1% declared domain and <=2% major named groups; calibrated probability or unambiguous raw-score label; >=90% eligible domain coverage; abstention; human review; zero critical privacy failures. Any missing gate -> **INCONCLUSIVE**, no public percentage.

## A/B hypotheses (not observed results)
Baseline A: scan + Unicode cleanup. Candidate B: scan + optional Writing Lab.
Measure blind quality, semantic fidelity, time-to-final, reversal rate, protected-term preservation and completed downloads. Planning hypothesis: >=10% gain in reviewed edit completion with no significant rise in fidelity failures. Do not use “decrease detector score” as writing success metric.

## Risk register
| Risk | Status | Containment |
|---|---|---|
| False accusation from uncalibrated detector | OPEN | Do not show percentages; test holdouts and enable abstention |
| Compromised or private document sent to a vendor | CONTROLLED in baseline | No document upload API, consent gate for future connectors |
| OOXML editor corrupts Word file | OPEN for rich edits | Never overwrite source; regression files; cautious opt-in |
| Arabic dialect changes are mistakenly treated as errors | OPEN | Optional MSA normalization; native locale reviewers |
| Static site dependency or browser memory exhaustion | CONTROLLED in baseline | Bundled ZIP library; size/expansion caps; partial review limits |
| Unlicensed benchmark data or API plan | OPEN | License/permission register and procurement check |

## Documentation and release gates
- Every pull request: JavaScript syntax, writing-rule tests, DOCX fixtures, Chrome upload/export smoke, Python metric tests.
- Every model candidate: register dataset license, sample demographics, time/model holdouts, frozen threshold and group confidence intervals.
- Every publication: changelog with explicit unsupported features; no unverified performance figures.
- Roll back the JS modification using GitHub's previous known-good commit if the new tests fail; never keep a failing Pages release unannounced.

See: research/EXECUTIVE_RESEARCH_2026.md, evaluation/README.md, .github/workflows/quality.yml.
