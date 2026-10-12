# Text Integrity Studio — Evaluation Protocol
Version 1.0 • 12 October 2026 • Proposed validation framework (NOT a measured detector result)

## 1. Release question
Can an explicitly versioned AI-text classifier deliver a useful *uncertain signal* in a defined language/domain while avoiding unacceptable false accusations? A classifier is not an authorship adjudicator.

No model has been trained or certified in this repository. The website currently has no AI-score predictor. An unavailable measurement must be marked NOT EVALUATED rather than silently manufactured.

## 2. Evidence streams
- **Provenance:** Verified source history (authorized document revisions, author process evidence, model generation logs where available); cannot prove authorship by itself.
- **Detection:** A model score interpreted only against a representative held-out, independently labeled dataset.
- **Content quality:** Human assessment of readability, factual accuracy, references, terminology and meaning preservation.
- **Security/privacy:** Local processing and adversarial DOCX/Unicode tests, data-leakage checks, explicit external transfer consent.

Keep these streams separate in the UI and reports.

## 3. Data contract
Use CSV columns id,label,score,split,language,domain,dialect,author_group,model_family,edit_type. Label is HUMAN or AI with documented authorship provenance. A blank score means abstention. The optional score value must be between 0 and 1 but is **not a probability** unless independent calibration has been conducted and validated.

Recommended additional confidential dataset manifest (do not commit personal text to public repo): document_hash, provenance_ref, consent_scope, data_license, generation_model_id, model_version, decoding_method, collected_at, length_words, prompt_group, topic_group, annotation_guidelines_version, adjudication_status.

## 4. Sampling plan
- English original human writing from multiple proficiency levels, plus short/long/formal writing.
- Modern Standard Arabic and Gulf/Saudi dialect; include Arabic/English code switching, STEM and humanities.
- LLM-generated writing across independent model families and prompts; preserve model version/time, source domain, decoding settings.
- Hybrids: human writing with authorized AI proofreading; human-edited AI; translation; paraphrasing; intentional mistakes; highly formulaic legal/academic prose.
- Adversarial robustness corpus separate from representative evaluation. Never optimize user-facing rewrites to beat detectors.
- Author and source document must not cross train/validation/test split. Also group by source prompt/topic and model family where OOD evaluation requires it.
- Lock independent calibration, validation and untouched test partitions *before* selecting thresholds.
- Minimum **~400 human examples per language** as a first planning target for a useful zero-false-positive 95% upper bound around 1%; many more are needed if any false positives occur. Target >=400 AI examples per major language, and stratify further where risk justifies. This is a planning assumption, not a claim of statistical power for all subgroups.

## 5. Metrics and confidence
At a threshold frozen on validation data, report:
- FPR = false AI accusations / all *scored* verified-human cases; Wilson 95% CI.
- TPR = correctly flagged / all *scored* AI cases.
- AUROC, macro F1, balanced accuracy, precision at a *stated base rate*, and full confusion matrix.
- Coverage/abstention; detection is inconclusive below support thresholds, out of domain or without calibrated confidence.
- If and only if scores are calibrated probabilities: Brier score, 10-bin expected calibration error and calibration diagrams.
- Language/domain/dialect/word-length-specific FPR and CIs, not just pooled accuracy.
- Model change drift, new-model holdout and last-30-day feedback review. Human-verified user reports are evidence of failures, not an unbiased population sample.

Important: a displayed 72% AI-like classifier score is neither a 72% fraction of AI-written words nor proof of authorship.

## 6. Proposed release gates (not achieved)
- G0 dataset provenance/licensing validated, no leakage.
- G1 >=400 independently verified human test examples per supported language and sufficient AI holdout.
- G2 FPR upper 95% CI <= 1% overall and <=2% in each named protected writing group; otherwise INCONCLUSIVE.
- G3 coverage >=90% in the declared operating domain and explicit abstention outside it.
- G4 no critical privacy/Unicode/DOCX/meaning-preservation failures.
- G5 no material performance regression vs frozen previous release or new model-family holdout.
- G6 calibrated probabilities validated and reviewer agreement established if a numeric probability is shown.
- G7 human oversight and appeal; results never used alone for academic discipline.
All numerical gates are project **targets**, not evidence of current performance.

## 7. Evaluation script
Run with no third-party Python dependencies:

    python3 evaluation/score_detector.py path/to/held_out_test.csv --threshold 0.7 --split test --output result.json

Only when independent calibration is documented:

    python3 evaluation/score_detector.py path/to/held_out_test.csv --threshold 0.7 --split test --calibrated

Example CSV headers:

    id,label,score,split,language,domain,dialect,author_group,model_family,edit_type
    test-001,human,0.08,test,en,engineering,,writer-1,,original
    test-002,ai,0.82,test,en,engineering,,source-2,model-family-x,original
    test-003,human,,test,ar,essay,gulf,writer-3,,human-proofread

The three illustrative rows above are synthetic software examples, **not a valid benchmark**.

The script computes point metrics, Wilson uncertainty, stratification and evidence gaps. It deliberately reports INCONCLUSIVE until independent calibration and provenance review are documented.

## 8. Writing quality experiment
Compare version A (existing text cleanup) versus version B (opt-in suggestion review):
- primary: blind editorial quality ratings, semantic equivalence, original claims/numbers preserved, reviewer accept/reject rates;
- guardrails: altered citation/reference rate must be 0 without explicit approval; accidental deletion of user text must be 0 in regression corpus;
- performance: median/95th percentile local analysis latency and Word export success by file complexity;
- privacy: 0 unconsented content transfers;
- user learning: % suggestions accepted, corrections reversed, reviewer complaints.
Do **not** use lower AI-detector output as success for writing improvements. Track score changes only as a research robustness signal, with frozen detectors and explicit consent.

## 9. Sources (source-to-test traceability)
- RAID / ACL 2024: https://aclanthology.org/2024.acl-long.674/ (domain, model, attack splits).
- M4 / EACL 2024: https://aclanthology.org/2024.eacl-long.83/ (multilingual, cross-generator).
- EvoBench / ACL 2025: https://aclanthology.org/2025.findings-acl.754/ (evolving models).
- AraGenEval / ArabicNLP 2025: https://aclanthology.org/2025.arabicnlp-sharedtasks.1/ (Arabic).
- AbjadGenEval / EACL 2026: https://aclanthology.org/2026.abjadnlp-1.68/ (Arabic-script and domain shift).
- Liang et al. / Patterns 2023: https://doi.org/10.1016/j.patter.2023.100779 (non-native English false positives).
- NIST AI RMF Generative AI Profile: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence (governance and risk).
