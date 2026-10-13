# Independent-source AI detector evaluation — 13 October 2026

**Scientific release status: NOT APPROVED / research only.** These measurements do not certify AI authorship, permit academic allegations, or represent the percentage of AI-written words.

## Source provenance and fixed system identity

- Research corpus: TextSight AI-text-detection-benchmark-2026 (Hugging Face).
- License: CC BY-SA 4.0, with per-source attribution documented by the publisher.
- Immutable dataset revision SHA: 423b1768f0827675295fd6dc3cd255ad2f411183.
- Evaluated model: onnx-community/tmr-ai-text-detector-ONNX.
- Frozen model revision: b9aa251e5bcda7e429fcc936767d921435945b60.
- 32 human-labeled pre-2022 Wikipedia revision excerpts; 32 human-labeled 2015–2021 academic articles; 40 claimed LLM-generated texts dated September 2026.
- All labels and source dating are **external vendor documentation**, not independently inspected and certified by our own project. Human source provenance is substantially more inspectable than HC3's question/answer claims, but this does not establish a fully verified ground truth.
- The 40 AI examples cover five generator families with eight samples each. Multiple generations may share a prompt; those observations are correlated rather than independent human-author groups.
- Samples were deterministically chosen before inference using frozen source revision, source identity deduplication, English and length validation, and balanced study quotas. No model, threshold or calibration was fitted to these examples.
- The vendor is an AI detector company; selection and benchmarking may reflect its own incentives. The corpus does not include raw student essays, true non-native-language learning drafts, code-switching, mixed human/AI authorship or Arabic.
- Original documents and per-record predictions were NOT committed or uploaded as artifacts.

**Real GitHub Actions run:** https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/38352220247

## Measured results on the actual browser ONNX detector

The 80% cutoff below is a frozen *uncalibrated model-signal research threshold*, not a validated probability or an academic decision rule.

| Test measure | Measured value |
|---|---:|
| Total texts | 104 |
| Human-labeled texts | 64 |
| AI-labeled texts | 40 |
| AUROC (ranking only) | 0.925 |
| Uncalibrated Brier score | 0.1229 |
| 10-bin expected calibration error | 0.0927 |
| Human high-alerts at raw signal >=80 | **5 / 64 (7.8%)** |
| 95% Wilson upper human high-alert bound | **17.0%** |
| AI high-alerts at raw signal >=80 | **29 / 40 (72.5%)** |
| Independent generalization / production approval | **NO** |

Domain breakdown:

| Dataset domain | Human texts | Human high-alerts | AI texts | AI high-alerts |
|---|---:|---:|---:|---:|
| Academic / biomedical | 32 | 3 (9.4%) | 21 | 16 (76.2%) |
| Encyclopedic | 32 | 2 (6.3%) | 19 | 13 (68.4%) |

Wilson 95% upper human high-alert bounds are 24.2% (academic) and 20.1% (encyclopedic), reflecting the small per-domain samples.

Generator breakdown (8 claimed samples per generator):

| Dataset generator | High-alert count >=80 |
|---|---:|
| Claude Haiku 4.5 | 8/8 |
| Claude Opus 5 | 2/8 |
| GPT-4.1 | 8/8 |
| gpt-oss-120b | 8/8 |
| Qwen 3.8 27B | 3/8 |

These numbers are far too small and prompt-correlated to justify a generator leaderboard or a general sensitivity claim.

## What the public UI actually shows — selective evidence audit

A second **real browser ONNX inference run** now records the browser's *actual report status and visible research signal*, in addition to the original raw TMR classifier output. Source and model revisions are unchanged. This does not create new ground-truth labels or prove a better detector.

Evidence: [real GitHub Actions research run 38356572613](https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/38356572613), 104 source-documented public examples. Benchmark records contain numeric diagnostics and provenance only, **not document text**.

| Browser outcome | Human source-labeled (64) | AI source-labeled (40) | Total |
|---|---:|---:|---:|
| Uncalibrated research signal displayed | 61 | 33 | **94** |
| Whole-document signal withheld / inconclusive | 3 | 7 | **10** |
| Displayed raw signal >=80% | 5 | 29 | **34** |

- **Selective abstention:** 10/104 (9.6%) texts withheld an overall score; 3/64 human-labeled and 7/40 AI-labeled. They are **not** classified as human or treated as correct negatives.
- **Visible high-signal alerts:** 5/64 human-labeled texts (7.8%) and 29/40 AI-labeled texts (72.5%) from the *whole* external cohort. These happened to equal the previous raw model threshold counts on this corpus; **no lower false-positive count was demonstrated**.
- **Conditional-on-displaying rates:** 5/61 (8.2%) of assessed human texts and 29/33 (87.9%) of assessed AI texts. These denominators are selected by the model's own abstention rules and **must not** be promoted as overall sensitivity, calibration or fairness.
- **95% Wilson upper bound for visible human high alerts:** 17.0% for all 64 labeled human texts; 17.8% if restricted to the 61 non-abstained texts. Neither meets a low false-alarm release gate.
- **Domain disparities:** academic cohort had 3/53 withheld overall; encyclopedic cohort had 7/51 withheld. Model-family abstentions are especially high for the publisher-labeled Claude Opus 5 subset (5/8), while the Qwen 3.8 subset had 2/8 withheld. Each family contains only eight source-labeled cases; no generator ranking is justified.
- **Scientific conclusion:** the UI's conservative guardrails make unresolved evidence explicit. This evaluation cannot establish that abstention improves discrimination or reduces false positives, and does not authorize calibrated AI authorship percentages.

The benchmark now fails closed on partial or contradictory reported UI evidence, keeps historical raw-only corpora explicitly marked `NOT_RECORDED`, and independently verifies every recorded model checkpoint revision against the pinned evaluation revision. Actual raw score distributions, uncertainty, sampling coverage, and abstention must be interpreted separately.

## Interpretation and comparison with HC3

The earlier weak-label HC3 sample produced **13/24 human false high-alerts (54.2%)**, versus 5/64 (7.8%) on this unrelated 2026 corpus. These data were sampled from different distributions, with different writing genres and source conventions. It is **not evidence that the underlying classifier became more accurate** between tests. The difference illustrates precisely why training-set and domain shifts undermine simplistic percentage comparisons.

AUROC 0.925 does NOT mean "92.5% accuracy." ECE measured on a balanced, vendor-curated dataset does not prove probability calibration for real users. The 95% upper false-positive bound (17.0%) is still far above the proposed <=1% release gate. The data also reveal misses on some generator families.

## Release decision and next requirements

**BLOCKED as reliable/authorship detection.** The model may remain an explicitly labeled experimental, voluntary local research diagnostic.

Before calibrated language/domain probability scores can be published:
1. Acquire larger independently source-verified, licensed human/AI comparison records representative of the real target documents, especially student/technical papers, non-native English, and recent unseen generators.
2. Group-disjoint author, article, prompt and generator splits; preserve a truly untouched release test corpus and pre-register decision thresholds.
3. Demonstrate low *upper-bound* false-positive risk within each affected domain and enough true-positive sensitivity at the frozen threshold; measure fairness and short/mixed/edited writing failure classes.
4. Keep the UI's token-aware coverage, contradictory-passage and model-disagreement abstention, with optional full-document scanning.
5. Do not deploy research Platt coefficients or select a score cutoff from this external TEST corpus. Do not allege academic misconduct solely from an AI detector result.

## Reproducibility

The exact public dataset revision is downloaded in GitHub Actions. The private runner evaluates the real ONNX browser model and archives only aggregate JSON metrics plus a text-free source manifest.

~~~sh
python -m pip install 'huggingface_hub>=0.35,<2'
npm install --no-save --no-package-lock --ignore-scripts --save-exact puppeteer-core@25.13.0

python backend/research/build_textsight_benchmark.py --out /tmp/tis-external2026 --human-per-domain 32 --ai-per-family 8

TIS_BENCH_CORPUS_MODE=external-2026 TIS_PUBLIC_WEAK_CORPUS=/tmp/tis-external2026/external-source-eval-private.jsonl TIS_BENCH_RESULTS=/tmp/tis-external2026/unapproved-model-predictions.jsonl node tests/browser-ai-reference-benchmark.cjs

python backend/research/evaluate_model_outputs.py --samples /tmp/tis-external2026/unapproved-model-predictions.jsonl --output /tmp/tis-external2026/research-metrics.json --benchmark TEXTSIGHT_2026_EXTERNAL_VENDOR_BENCHMARK --model-revision b9aa251e5bcda7e429fcc936767d921435945b60
~~~

Sources: https://huggingface.co/datasets/textsightai/ai-text-detection-benchmark-2026

Relevant external research:
- https://aclanthology.org/2025.findings-naacl.271/
- https://aclanthology.org/2025.findings-acl.1303/
- https://arxiv.org/abs/2607.03680
