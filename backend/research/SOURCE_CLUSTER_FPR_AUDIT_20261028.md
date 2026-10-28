# E3 research source-cluster FPR validation — 28 October 2026

**Scope:** research-only uncertainty computation. **Not** AI-authorship accuracy, classifier improvement, calibrated probability, production release approval, or an independently labeled benchmark.

## Evidence of the original failures

1. The original bootstrap selected the first available `source_group` and ignored other identifiers. With two passages from the same author but distinct upload names it returned **3** independent clusters instead of **2**. The negative control failed before code changes: [CI run 40636523673](https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/40636523673).
2. The interim graph-based bootstrap sampled every source cluster, including unrelated AI-only groups, to estimate the **human** false-positive rate. With the human texts and seed fixed, adding 40 AI-only source groups changed the upper bootstrap endpoint from **0.5000 to 0.5556**: [CI run 40637127299](https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/40637127299).

Both examples are purpose-built **synthetic diagnostic fixtures**. They do **not** measure whether any AI detector correctly recognizes an author.

## Corrected algorithm

- Build transitive connected components across content fingerprint, source group, author group, article group and prompt group, with field-namespaced identifiers.
- Missing or placeholder identifiers never create independence. If a row has no usable grouping information, the cluster interval is unestimable.
- Keep AI-labeled records in the connectivity graph because they can connect human records through shared provenance; **only sample the human portion of each connected component for the human false-positive bootstrap**.
- Use a deterministic source-identifier order and a frozen seed for reproducibility.
- Return only aggregate counts and confidence limits; source IDs, author names, digests, prompts, document text and private labels must not appear in the result.
- Estimator method identifier: `HUMAN_CONNECTED_CLUSTER_BOOTSTRAP_RESEARCH_400_V2`. V1 and V2 intervals must not be silently compared as equal-method evidence.

## Regression guards

`tests/test_selective_metrics.py` checks same-author/different-upload, transitive article-author links, identical text digests, placeholder identifiers, unknown grouping, AI-row bridges, input ordering and unchanged human FPR interval after adding unrelated AI-only groups. Keep these tests in the existing CI `test_*.py` suite whenever source grouping changes.

## Scientific limits

The fixed bootstrap still cannot authenticate labels, prove independent author/source identity, eliminate contamination/near-duplicates or certify subgroup fairness. A narrow interval on biased or correlated weak-label data must **not** be marketed as detector precision. Existing external-source vendor-label studies are not independent ground truth, and Arabic detection has a separate release gate. The website's experimental research signal and `INCONCLUSIVE` protections remain unchanged.

**Release classification: HOLD.** Never use this engineering fix to adjust model scores, thresholds, calibration coefficients, or public authorship claims. Require independent label/source review, preregistered untouched cohorts, sufficient per-language/domain samples, and signed owner authorization for a separate future release decision.
