# Text Integrity Studio Independent Detector Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Produce independently auditable, reproducible research evidence about false alerts, missed AI-generated texts, uncertainty and model generalization, WITHOUT using weak labels or test splits to manufacture calibrated authorship percentages.

**Architecture:** Extend the existing offline Python benchmarking scripts and GitHub research workflows, separate from the static GitHub Pages inference app. Track license/label provenance, enforce group-disjoint splits, compute confidence-aware subgroup metrics and create a human-governed GO/HOLD/BLOCKED decision. Keep the public detector EXPERIMENTAL regardless of research script success until independent scientific release gates are met.

**Tech Stack:** Python 3.12 standard library plus existing NumPy 2.5.4 / scikit-learn 1.9.1 when needed for offline model calibration, Python unittest and existing Hugging Face Hub research scripts, GitHub Actions, frozen actual browser ONNX inference.

**Spec:** docs/superpowers/specs/2026-10-13-tis-path-a-reliability-design.md, sections 2, 6, 8, 9, 11-12. Independent of the JavaScript core and Humanize tasks; can be reviewed and delivered without deploying a new detector to visitors.

## Global Constraints

- Baseline public model: onnx-community/tmr-ai-text-detector-ONNX revision b9aa251e5bcda7e429fcc936767d921435945b60. Historical second detector revision 54895bd11f34b47a01369d25b2255224717409b8 is a comparator, not verified ground truth.
- Existing external 2026 vendor-labeled dataset showed 5/64 human high alerts (7.8%, two-sided 95% Wilson upper approximately 17%), and HC3 recorded 13/24 (54.2%). Different weak-label cohorts are NOT before/after evidence and cannot justify model calibration or sales promises.
- The existing research-only evaluator backend/research/evaluate_model_outputs.py remains authoritative for raw score metrics; extend or wrap it, do not erase historical diagnostics or change the fixed research 80% alert threshold without a preregistered new experiment.
- Label certainty tiers: public source claim; machine-inferred; independently verified WITH auditable evidence. Never allow an unreviewed metadata flag to assert independent verification.
- TRAIN / CALIBRATION / VALIDATION / untouched RELEASE_TEST are separate; no threshold choice, weight fitting, feature selection, or calibration fitting on RELEASE_TEST.
- Group leakage must be blocked across exact duplicates, author, originating article, prompt/template and source-family as appropriate. Unseen-generator claims additionally hold out generator families explicitly.
- Per proposed language/domain approval cohort: research design targets at least 400 independently verified human and 400 independently verified AI examples, subject to independent power/design review. This does NOT claim that such a cohort is currently available.
- Promotion requires a preregistered operating point with one-sided 95% upper human FPR <=1% for EACH approved cohort, and prespecified recall, abstention and subgroup limits. Calibrated probability claims additionally require ECE <=0.10 and Brier <=0.20 on untouched target-domain test data, after fitting only on CALIBRATION data. None is currently demonstrated.
- All output artifacts are aggregate and metadata only. Do not commit user documents, raw third-party text, sample excerpts, IDs enabling reidentification or per-document private scores.
- Evaluation success DOES NOT automatically authorize a probability claim or a model change on GitHub Pages; a separate owner/model-risk decision is required.

## Review Focus

1. Identical text appearing under distinct IDs or in near-identical article/prompt groups must not leak across CALIBRATION and RELEASE_TEST. Tasks E1/E2 test duplicate_group_leakage.
2. A synthetic “INDEPENDENTLY_VERIFIED” metadata string with no reviewer evidence must fail provenance validation, not count toward the 400+400 gate. Tasks E1/E5 test fabricated_ground_truth_flag.
3. When all high human signals are suppressed by INCONCLUSIVE, report abstention and selective risk explicitly; never call it 0% total error. Task E3 test abstention_is_not_true_negative.
4. Two generators with identical prompts but different model families must be group-controlled; unseen-generator generalization cannot be inferred from a random sample split. Task E2 test unseen_generator_holdout.
5. An unseen formal/ESL cohort or no independently verified Arabic records must yield a HOLD/BLOCKED state, not 100% claimed precision. Tasks E3/E5 test missing_subgroup_blocks_release.

---

### Task E1: Add license and label-provenance manifest validation

**Files:**
- Create: backend/research/dataset_manifest.py
- Create: tests/test_dataset_manifest.py
- Modify: backend/research/build_textsight_benchmark.py (metadata reporting only)
- Preserve: backend/research/EXTERNAL_2026_EVALUATION.md

**Interfaces:**
- Produces validate_manifest(records:list[dict],licenses:dict)->dict metadata-only audit; audit returns {records_total,label_confidence_counts,licenses_checked,groups_total,release_eligible_labels,errors}, raising ValueError for structural contradictions.
- Every record must include stable surrogate ID, source/author/article/prompt grouping keys or explicit unknown, language, writing domain, known or source-claimed label, label_provenance, model_family for AI, source license, source revision, and an evidence_reference for independent verification.
- Independent label confidence requires an auditable evidence_reference accepted by a separate review process; public vendor claims never become independent by metadata alone. Never return raw text in the audit.

- [ ] **Step 1: Write failing tests** fabricated_ground_truth_flag, absent_license_rejected, missing_author_provenance_is_unknown_not_verified, duplicate_group_leakage, labels_with_review_references, and raw_text_not_in_audit. Use synthetic short fixtures with no real personal data.
- [ ] **Step 2: Run** python3 -m unittest discover -s tests -p 'test_dataset_manifest.py' -v. Expected: FAIL because dataset_manifest is missing.
- [ ] **Step 3: Implement** validate_manifest and a metadata-only adapter around existing TextSight preparation; fail if the same exact content digest is claimed independently across groups without a documented provenance relation. No new external dataset downloads during unit tests.
- [ ] **Step 4: Run** python3 -m unittest discover -s tests -p 'test_dataset_manifest.py' -v && python3 -m unittest discover -s tests -p 'test_external_benchmark.py' -v. Expected: PASS.
- [ ] **Step 5: Commit** with git commit -m "research: require traceable license and authorship-label provenance".

### Task E2: Deterministic group-disjoint splits and frozen release set

**Files:**
- Create: backend/research/cohort_split.py
- Create: tests/test_cohort_split.py
- Preserve: backend/research/evaluate_model_outputs.py

**Interfaces:**
- Produces split_cohorts(records:list[dict],seed:int=20261013,unseen_generator_families:set[str]|None=None)->dict with keys train,calibration,validation,release_test,split_manifest.
- Also produces audit_group_leakage(splits:dict)->dict listing crossed author/article/prompt/duplicate groups and generator leak when an unseen test is claimed.
- Each record appears in exactly ONE split. Split manifest records only ID hashes, counts, frozen random seed, grouping rationale and source revision (no raw text).
- Do not expose RELEASE_TEST labels to the calibration fitter; store the frozen test manifest under review-controlled artifacts, not mutable per-run threshold sweeps.

- [ ] **Step 1: Write failing tests** duplicate_group_leakage, shared_article_author_leakage, shared_prompt_across_models, unseen_generator_holdout, deterministic_same_seed and different_seed_still_no_leakage. Cross-linked group keys must be treated as one connected cohort, not split independently.
- [ ] **Step 2: Run** python3 -m unittest discover -s tests -p 'test_cohort_split.py' -v. Expected: FAIL because cohort_split is missing.
- [ ] **Step 3: Implement** deterministic group connected-components and stratified group assignment; preselect held-out generator families as required; emit a frozen redacted manifest. If group constraints prevent credible cohort balance, report insufficiency, not split a group to fake sample counts.
- [ ] **Step 4: Run** python3 -m unittest discover -s tests -p 'test_cohort_split.py' -v. Expected: PASS on linked-group and unseen-generator fixtures.
- [ ] **Step 5: Commit** with git commit -m "research: lock contamination-resistant splits and unseen generator tests".

### Task E3: Report selective prediction, subgroup uncertainty and true denominators

**Files:**
- Create: backend/research/selective_metrics.py
- Create: tests/test_selective_metrics.py
- Modify: backend/research/evaluate_model_outputs.py (additive fields only, no removal of historical keys)

**Interfaces:**
- Produces compute_selective_metrics(rows:list[dict],alert_threshold:float=.8,bootstrap_seed:int=20261013)->dict, and one_sided_wilson_upper(errors:int,total:int,alpha:float=.05)->float.
- Metrics: confusion matrix, human FPR and AI FNR on ALL eligible labelled texts, assessed-only false-alert/recall, rate of abstentions and reasons, AUROC where both classes present, length/domain/ESL/formal and unseen-generator breakdowns, and cluster-bootstrap confidence intervals by source/prompt/author group. ECE/Brier for raw model signals must be labelled **uncalibrated diagnostics** until a calibration validation stage.
- Use z=1.6448536269514722 for a ONE-sided 95% Wilson upper bound; keep existing two-sided Wilson historical function unchanged. A subgroup lacking enough effective groups returns UNESTIMABLE with denominator, not a persuasive decimal.

- [ ] **Step 1: Write failing tests** abstention_is_not_true_negative, one_sided_wilson_zero_errors_n400, one_false_alert_n400, all_abstained_rates_unestimable, group_bootstrap_correlation, missing_subgroup_blocks_release and raw_signal_brier_not_certified_calibration. Assert numeric denominators and absence of author-identifying fields in output.
- [ ] **Step 2: Run** python3 -m unittest discover -s tests -p 'test_selective_metrics.py' -v. Expected: FAIL on missing module/functions.
- [ ] **Step 3: Implement** compute_selective_metrics using existing auc/ece and a separate exact or one-sided Wilson interval, deterministic group bootstrap for uncertainty, and explicit assessed/all denominators. Maintain legacy output names for historical comparisons and append research-only metrics.
- [ ] **Step 4: Run** python3 -m unittest discover -s tests -p 'test_selective_metrics.py' -v && python3 -m unittest discover -s tests -p 'test_detector_benchmark.py' -v. Expected: PASS with historical benchmark fixtures unchanged.
- [ ] **Step 5: Commit** with git commit -m "research: quantify abstention, subgroup risks and uncertainty".

### Task E4: Research-only calibration cross-check, never trained on release test

**Files:**
- Create: backend/research/calibration_validation.py
- Create: tests/test_calibration_validation.py
- Modify: backend/requirements-research.txt only if necessary (prefer pinned existing scikit-learn 1.9.1)

**Interfaces:**
- Produces fit_research_calibrator(calibration_rows:list[dict],method:'platt'|'isotonic'='platt')->CalibratorArtifact and evaluate_calibration(artifact,validation_rows:list[dict])->dict.
- Artifact holds model revision, calibration split hash, fitting method, library revision and aggregate metadata. It does NOT overwrite browser ONNX weights, thresholds or frontend signal display.
- Fitting must reject any record sharing author/source/article/prompt/content group with VALIDATION or RELEASE_TEST or having uncertain labels; never read the RELEASE_TEST manifest in fit_research_calibrator.

- [ ] **Step 1: Write failing tests** calibration_disjoint_from_release_test, reused_prompt_group_rejected, insufficient_labels_blocks_fit, calibrated_brier_ece_are_labeled_research, no_implicit_ui_deployment and unchanged_raw_model_signal. Use synthetic logistic/isotonic fixtures with known scores and splits.
- [ ] **Step 2: Run** python3 -m unittest discover -s tests -p 'test_calibration_validation.py' -v. Expected: FAIL because calibration_validation.py is missing.
- [ ] **Step 3: Implement** offline Platt and optional isotonic fits through scikit-learn; produce aggregate validation reliability diagrams/tables and immutable metadata-only provenance. Training on RELEASE_TEST or writing new docs/AI runtime probability assets is prohibited.
- [ ] **Step 4: Run** python3 -m unittest discover -s tests -p 'test_calibration_validation.py' -v && python3 -m unittest discover -s tests -p 'test_detector_benchmark.py' -v. Expected: PASS, no changed docs/browser-ai-runtime.js or docs/ai-score-ui.js.
- [ ] **Step 5: Commit** with git commit -m "research: add separately trained offline calibration evaluation".

### Task E5: Research release gate and privacy-safe CI publication

**Files:**
- Create: backend/research/release_decision.py
- Create: tests/test_research_release_decision.py
- Modify: .github/workflows/external-detector-audit.yml
- Create: backend/research/RELEASE_TEST_PROTOCOL.md
- Verify unchanged production page and detector weights

**Interfaces:**
- Produces decide_release(audit:dict,metrics:dict,calibration:dict|None,criteria:dict)->dict with {decision:'BLOCKED'|'HOLD'|'REVIEW_REQUIRED',reasons:list[str],cohorts:list[dict],evidence_revision:str}.
- Never return READY automatically; verified release additionally requires an independent signed human review and owner approval outside this research script.
- Criteria include independently verified 400+400 samples PER proposed cohort (subject to power-review), one-sided 95% human FPR upper <=.01, ECE <=.10 and Brier <=.20 before ANY calibrated probability claim, and preregistered recall/abstention limits for each use case. Missing ground truth or cohort -> BLOCKED/HOLD.
- Existing vendor-labelled/HC3 research reports remain clearly weak-label historical evidence, never labelled gold standards.

- [ ] **Step 1: Write failing tests** missing_subgroup_blocks_release, fabricated_ground_truth_flag, insufficient_400_class_samples, excessive_false_alarm_upper_bound, inadequate_recall_with_abstention, calibration_missing_for_probability_claim, no_auto_ready_even_if_synthetic_passes, and aggregate_export_contains_no_raw_text.
- [ ] **Step 2: Run** python3 -m unittest discover -s tests -p 'test_research_release_decision.py' -v. Expected: FAIL on missing decision engine.
- [ ] **Step 3: Implement** metadata-only decision gate and preregistration template under RELEASE_TEST_PROTOCOL.md. Extend the existing research workflow to run tests and upload aggregate metrics plus anonymized provenance manifest only. Do NOT allow GitHub Actions to publish a new calibrated public detector after successful tests.
- [ ] **Step 4: Run** python3 -m unittest discover -s tests -p 'test_research_release_decision.py' -v && python3 -m unittest discover -s tests -p 'test_detector_benchmark.py' -v && python3 -m unittest discover -s tests -p 'test_external_benchmark.py' -v. Expected: PASS; all existing public dataset labels still marked unverified.
- [ ] **Step 5: Commit** with git commit -m "research: block unsupported detector reliability claims with auditable release gate".

## Evaluation Subsystem Completion Gate

- Synthetic metric-unit tests pass, reproducible metadata manifests checked, no split leakage and no release-test contamination.
- Existing historical metrics remain reproducible, clearly labelled source-claimed, and never advertised as “accuracy before/after.”
- Real licensed data may be loaded by explicit research workflow; CI emits AGGREGATE evidence only, no raw text/private user data.
- Run the external audit workflow via explicit dispatch when approved; there is no claim of new independent ground truth merely because its unit tests pass.
- The research code must report BLOCKED or HOLD if independently reviewed 400+400 per cohort, subgroup recall/abstention, FPR bound, and calibration evidence are missing. No automatic production model promotion.
- Deliver a concrete human-review report: measured numbers, cohorts, confidence intervals, label uncertainty, model revisions, comparison limitations and any STOP reasons. A statistically unverified detector stays experimental, even if UI/reliability tasks deploy successfully.

**Status:** RESEARCH IMPLEMENTATION PLAN FOR OWNER REVIEW; SCIENTIFIC PRODUCTION CLAIMS REMAIN BLOCKED.
