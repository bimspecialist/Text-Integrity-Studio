# Initial public-corpus calibration: reproducible run (12 October 2026)

**Status: RESEARCH BASELINE ONLY — NO VERIFIED AUTHORSHIP PERCENTAGES RELEASED**

The baseline workflow was actually executed in GitHub Actions: https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/38237478229

## English: Hello-SimpleAI/HC3 (succeeded)

The job downloaded an immutable revision of public HC3 question/answer examples, kept prompt-paired human/AI claims in the same train/calibration/test group, and fitted the meta-classifier + sigmoid calibration mapping. It emitted an **unapproved** document.en.json model artifact available in GitHub Actions as research-baseline-en, kept for only one day (artifact expires October 13, 2026).

Measured TEST sample stats as reported by the actual job (dataset labels not independently verified):
- 107 human-labeled and 107 AI-labeled held-out samples.
- False positive rate at the calibration-defined high alert threshold: 0 / 107 (0 observed).
- **95% Wilson upper false-positive bound: 3.47%**, above required <=1%.
- True positive fraction at high alert: 39.25%; well below the pre-registered 60% sensitivity floor.
- Brier score: 0.0622; ECE: 0.0417. This is *corpus-specific* calibration, not global accuracy.
- Eligible independent signal-family coverage: 0% because optional real LM/semantic/transformer adapters were not installed.
- Unseen generator-family test: false (HC3 contains a single claimed generation family).
- Formal/non-native/Arabic subgroup audit: incomplete.
- Independent author-label verification: false.

The service **must return INCONCLUSIVE / null percentage** for all unapproved baseline artifacts. A low observed error rate with only 107 human examples does not justify verified operation.

## Arabic: 2A2I/Aya-SambaLingo Arabic Chat DPO (blocked)

The Apache-2.0 DPO dataset was downloaded and filtered by the >=75-word text threshold, but there were too few eligible *paired* samples even in the train split. The job raised "Insufficient eligible train pairs for trainer; no fake fallback will be used." No legitimate Arabic baseline weights were generated.

The dataset card maps chosen/rejected preferences to claimed human/AI responses, but that is not a substitute for independent label auditing. Do not concatenate short, unrelated answers to bypass the threshold.

## Responsible next Arabic sources

Potential *licensed and independently reviewable* Arabic corpora are needed. An Arabic academic abstract dataset with human originals plus model-generated versions is available at
https://huggingface.co/datasets/KFUPM-JRCAI/arabic-generated-abstracts
and contains 8,388 rows across title/polishing generation methods. **Its repository does not expose an explicit dataset license in the source metadata reviewed**, so an independent licensing/redistribution clearance is required before importing this source to a distributed baseline. Academic prose also differs from Saudi/Gulf dialect, student writing and workplace documents.

Other sources include the much larger MIT-tagged DetectRL-X Arabic benchmark; its stated binary data exceeds 31 GB and is not suitable for a lightweight default download. No alternative was silently substituted.

## Reproduction

From backend:
1. Install requirements-training.txt, then huggingface_hub and pyarrow (see research workflow).
2. Run python -m hybrid_detector.baseline_data --source hc3_en --out /private/tis-baseline --limit 800
3. Run python -m hybrid_detector.train --dataset /private/tis-baseline/hc3_en.jsonl --output /private/tis-models --language en --domain general --unit document --version research-en-v1
4. Keep artifacts private. The resulting version is UNAPPROVED. Never enable TIS_ENABLE_APPROVED_SCORES based on these data.

## Scientific interpretation

The output percentage is an internally calibrated **classifier signal conditioned on this weak public corpus**. It is neither an independently verified human/AI authorship probability, nor a measure of AI-authored words, nor valid for disciplinary decisions.
