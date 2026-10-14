# Independent release-test protocol — Text Integrity Studio V7

**Status:** UNREGISTERED / HOLD. This is a preregistration template, **not** a completed study, certificate, authorization, or claim of calibrated AI-authorship probability. Implemented as a research-only guard in `backend/research/release_decision.py`.

## Freeze these decisions **before looking at RELEASE_TEST labels or results**

1. **System identity:** PIN exact primary and secondary ONNX model SHAs, tokenizer/runtime revisions, evidence-contract version, language eligibility policy, source-code Commit SHA, device/backend configurations, and whether secondary model/sampling is enabled.
2. **Operating point:** Record the fixed 80% research alert threshold or a separately justified pre-registered alternative, explicit abstention conditions, confidence-bound formula and desired risk trade-off. **Never** use RELEASE_TEST to tune threshold, fit calibration, optimize prompts, select datasets or select a best-performing model.
3. **Predefined cohorts:** Specify each exact language + domain combination to be approved, including English academic, formal and ESL where proposed and Arabic only if a tested Arabic classifier exists. Record target text-length bands, observed length distribution, editors, human-generated versus generated provenance, and generator-family holdouts.
4. **Label provenance and legal reuse:** Author/content consent or source rights, exact pinned source dataset revision and license, deterministic content fingerprint, separate auditable independent reviewer record for each label and a review adjudication protocol. *A string saying “INDEPENDENTLY_VERIFIED” is not verification*. The current E1 verifier only checks structural review-reference matches and licenses; external authentication/signature verification is required.
5. **Group separation:** Run E2 group-connected splitting across digest, author, article, prompt/template and source family. TRAIN, CALIBRATION, VALIDATION and RELEASE_TEST must be disjoint. Do not allow unseen-generator families, paraphrases or near-duplicate templates to leak from training to test. An E2 `split_manifest` contains **unsalted group digests**: keep it in a controlled private research workspace, never upload or publish it.
6. **Sample plan:** As a proposed planning baseline per approved language+domain cohort, at least **400 independently corroborated human** and **400 independently corroborated AI** examples, subject to power and subgroup review. Small vendor-labeled or HC3 examples are historical diagnostics, **not** independent ground truth. Sample numbers alone do not establish power when source groups are correlated.
7. **Required metrics on untouched cohorts:** Report FPR, FNR, precision, recall, F1, AUROC, assessed-only and all-eligible denominators, abstention/coverage, Wilson one-sided 95% human false-positive upper, and source-cluster uncertainty. Run by language, domain, academic/formal/ESL, length, generator family and unseen-generator exposure. Mark non-estimable subgroups explicitly. When human texts abstain, worst-case FPR count includes those unassessed samples; never credit abstention as a correct human prediction.
8. **Proposed acceptance limits:** One-sided 95% upper human FPR **<= 0.01** for each approved cohort, preregistered minimum conservative recall and maximum abstention, plus inspected subgroup limits. For any **calibrated probability claim**, separately fit on CALIBRATION and independently validate on target-domain samples with ECE **<= 0.10**, Brier **<= 0.20**, credible label proof and independent final review. A good research-only ECE or Brier is not proof of an authorship probability.
9. **Research release decision:** Run `decide_release(audit, metrics, calibration, criteria)` using metadata-only evidence with frozen protocol ID, model revision and RELEASE_TEST hash. Decisions are `BLOCKED`, `HOLD`, or `REVIEW_REQUIRED`. There is **no automatic READY** state. A reviewer must verify supporting raw proof in a privately authorized setting, then obtain explicit product-owner approval separately from this program.
10. **Publication and privacy:** Export only count/statistical aggregate tables and bounded, non-identifying evidence metadata. Never upload source text, case IDs, raw per-document predictions, author names, unsalted group hashes, reviewer identities, license-attestation document contents, or documents from user sessions to GitHub Actions artifacts or Pages. Existing `main` public AI signal remains experimental and not a calibrated authored-by-AI percentage.

## Required evidence bundle (controlled research workspace, not git)

- Frozen signed protocol with `protocol_id` and `model_revision`.
- Researcher-approved dataset/license inventory, review attestation registry, adjudication outcomes, release-test fingerprint and group-disjoint split proof.
- Independently executed inference outputs for the pinned models (private), aggregated metrics and subgroup confidence intervals (shareable after privacy review).
- Separate calibration/validation study with frozen train/calibration/test partitions.
- Human-reviewed release committee assessment and explicit owner authorization *after* all technical/safety/reliability gates.

## CI boundary

The CI `test_research_release_decision.py` fixtures are synthetic and deliberately cannot grant a release authorization. Current verification can prove **code gates and regressions**, not independent authorship labels, model generalization, or compliance in a real target population. External public-source vendor-label audits are research diagnostics only and may not automatically modify deployed weights, show a verified AI percentage, or merge the branch.

**Current decision: HOLD / no production detector probability claims** until every cohort’s real evidence and independent review have passed.
