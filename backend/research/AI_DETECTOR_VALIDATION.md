# Deep AI Detection Review — TIS October 2026

**Scientific release status: RESEARCH / NOT INDEPENDENTLY VALIDATED.**
This record explains actual observations, model scope, concrete engine changes and next gates. It does **not** certify AI authorship or claim to reproduce commercial detector scores.

## 1. Why different websites produce very different percentages

An AI-text model produces a score specific to its training examples, model architecture, class priors, token limits, transformations and calibration. Distinct detectors, even legitimate ones, can return widely different values on the identical human document. Modern studies document large false-positive variation for non-native academic authors and out-of-domain examples. A commercial detector's output is not a ground-truth label or a legitimate calibration target.

The TMR/RoBERTa model uses English RAID-style examples from 2024. Its published model-card performance should not be assumed valid for engineering papers, university assignments, Gulf-dialect text, modern frontier generation, translated content, short paragraphs, heavily edited human prose or mixed AI/human drafts. The optional second OpenAI RoBERTa was trained to distinguish GPT-2 (2019) output from human text; it is a **legacy comparator**, not a current detector with stronger guaranteed accuracy.

## 2. What changed in the public site

- **Real tokenizer windowing:** before inference, count RoBERTa's genuine token IDs, cap each window to 448 tokens (not 230 words followed by silent model truncation).
- **Source coverage:** preserve actual text offsets, report total windows, sampled windows, skipped very long tokens, fraction of words covered and segment-level variations.
- **Stratified document sampling:** up to 12 distributed token-bounded windows for long documents; no silent full-document claims when sampling is incomplete.
- **Independent optional comparison:** opt-in second MIT-licensed, quantized OpenAI GPT-2-era ONNX checkpoint; both models downloaded by user action and run inside browser. The secondary model adds bandwidth, memory and runtime cost.
- **No fake ensemble precision:** retain the **primary uncalibrated model signal** when the independent comparator agrees within 25 percentage points, while displaying both scores separately. **Do not average two differently trained, uncalibrated classifier scores.** When models disagree sharply or coverage is <25%, no unified percentage is displayed. The 25-point boundary is a provisional transparency guardrail, not an empirically validated classification threshold. Show each raw model score instead.
- **Safety/UX:** display context-specific false-positive cautions, actual model-window excerpts, risk flags, model provenance and a JSON report without document content. Preserve Arabic/English UI and existing Word/PDF/OCR features.
- **Operational integrity:** compare exact expected output labels and pinned model revisions. Abort on unknown labels or invalid scores, reject mixed language, invalidate results when source text changes.

These changes improve *measurement fidelity and inspectability*. They do not prove external discrimination performance.

## 3. Real TMR reference pilot — completed

GitHub Actions: https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/38253905498

Sample source: public English HC3 human-answer vs ChatGPT-answer *dataset claims* (Hello-SimpleAI, question-pair group-holdout). Unlike a verified provenance audit, source labels are not independently certified. The TMR model used: onnx-community/tmr-ai-text-detector-ONNX at pinned commit b9aa251e5bcda7e429fcc936767d921435945b60.

Measured metrics from actual ONNX inference on 48 separate inputs:

| Metric | Observation |
|---|---|
| Human-labeled / AI-labeled | 24 / 24 |
| AUROC | 1.000 (small, narrow benchmark only) |
| Brier score (uncalibrated) | 0.3009 |
| Ten-bin expected calibration error | 0.3461 |
| False alerts for human-labeled texts, raw signal >= 80% | 13 of 24 (54.2%) |
| Wilson 95% upper bound on that false-alert rate | 72.1% |
| AI-labeled texts flagged at >=80% | 24 of 24 |
| Deployment readiness | **NOT APPROVED** |

**Interpretation:** On this source, raw scores distinguish the classes by ordering yet an 80% cutoff creates many human false alerts. AUC is not calibration. The results are not statistically representative of a student's writing or the worldwide text population. The pilot is enough to block marketing a raw score as a verified probability.

The two-model live integration itself was tested and passed:
https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/38253397745

## 4. Separate-split weak-label calibration research

A separate research experiment fits regularized, monotonic sigmoid/Platt parameters using only CALIBRATION examples, then compares raw and recalibrated Brier/ECE/FPR on previously untouched TEST examples. Both partitions are source-group disjoint. The experiment deliberately writes **NOT APPROVED**, never mutates the user-facing release thresholds and never authorizes the real website to use a probability mapping trained on unverified sources. Code:

- backend/research/calibrate_from_public_claims.py
- backend/research/evaluate_model_outputs.py
- .github/workflows/public-detector-calibration.yml

Under no circumstances choose the cutoffs after looking at the untouched test split or tune to match an unrelated commercial site.

### Completed independent-split research calibration (public weak labels only)

[GitHub Actions run 38254633810](https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/38254633810) trained a monotone sigmoid/Platt mapping **only on the HC3 public CALIBRATION split**, and evaluated a separate 48-item TEST split (24 human-labeled and 24 ChatGPT-labeled examples). The labels remain unaudited dataset claims; this experiment was **not released** and does not authorize production percentages.

| Measure (same untouched weak-labelled TEST) | Raw TMR model signal | Research Platt output |
|---|---:|---:|
| Brier score | 0.3009 | 0.1067 |
| 10-bin ECE | 0.3461 | 0.2092 |
| Observed human false alerts at >=80% | 13/24 (54.2%) | 0/24 (0%) |
| Independent authorship validation | No | No |
| Public probability release | **BLOCKED** | **BLOCKED** |

**Interpretation:** empirical corpus-specific calibration improves these sample metrics without proving generalization. Post-hoc 0/24 is *not* evidence of a safe threshold: its 95%-Wilson upper FPR bound is still about 13.8%. The 0.2092 ECE also exceeds the proposed <=0.10 release criterion. A researcher must not deploy this mapping or use this evaluation's same TEST split to set a cutoff; more independently verified, larger and diverse data is required.

## 5. Scientific and product release gates

Before any true probability claim:
1. Author/source-verified, licensed and consented human-versus-AI records, with strong documentation of editing, translation, assistance, text overlap and original provenance.
2. Independent train/calibration/test partitions group-disjoint by source, prompt, author and generator family. Protect the untouched test split.
3. At least 400 independently verified human and 400 AI examples per released language/domain cohort, plus held-out generator families and meaningful formal/non-native and bilingual subgroups.
4. Pre-register high-alert threshold and achieve <=1% 95%-Wilson-upper false-positive bound plus meaningful sensitivity, calibrated reliability (e.g. Brier <=0.20, ECE <=0.10), and sufficient document coverage for each use case.
5. Arabic and code-switched texts require separate locally validated classifiers; do not use English models for them.
6. Run factual/metadata provenance and human review; no automatic allegations, grading or disciplinary penalties based on AI score.
7. Review local download supply-chain security, pinned model licenses, CSP and browser resource limits; do not automatically send private text to a third party.

## 6. Primary evidence and reproducibility

- RAID benchmark: https://aclanthology.org/2024.acl-long.674/
- Cross-domain practical detector evaluation: https://aclanthology.org/2025.findings-naacl.271/
- Non-native English writer false-positive study: https://pmc.ncbi.nlm.nih.gov/articles/PMC10382961/
- TMR upstream model card: https://huggingface.co/onnx-community/tmr-ai-text-detector-ONNX
- OpenAI historical comparator limitations: https://huggingface.co/openai-community/roberta-base-openai-detector

A new model's ranking score is **not** a percentage of AI-authored words; only future independent calibration and generalization testing could justify a properly scoped probability estimate.
