# Text Integrity Studio V8 — Path A Engineering Release Checklist

**Candidate marker:** `TIS_V8_PATH_A_20261014_S5_RC2`  
**PR:** [#16](https://github.com/bimspecialist/Text-Integrity-Studio/pull/16) — development branch `feature/path-a-m0-core-reliability`  
**Observed pre-merge main at checklist creation:** `8d08635bd2adf3e32e22ba3735a0049ea6b22b4c` (recheck immediately before merging)  
**Decision:** **NO-GO for merge/publish until the owner independently authorizes release and all release blockers are resolved.**  
**Status of local generative rewrite:** **HOLD / disabled.**  
**Scientific AI authorship percentages:** **HOLD / uncalibrated.**

## V8 UI-only acceptance evidence (PR branch, not production)

This V8 release candidate is deliberately distinguished from the historical
V7 S5 marker. UI implementation changes do **not** certify experimental
detector accuracy or enable unverified generative Humanize.

- [ ] On the candidate head SHA, run `tests/analysis/workspace-v8-browser.test.cjs`: desktop 1440px, RTL laptop 1150px, Arabic mobile 390px and narrow 320px, preserving one Analyze action and all document tools.
- [ ] Run `tests/analysis/workspace-v8-interactions.test.cjs`: sample/source revision correctness, drag-and-drop through the existing DOCX/PDF/TXT loader, rejecting unsupported files without overwriting text, local writing-only/stale statuses, Unicode-safe diff and explicit UTF-8 draft export without altering source or DOCX.
- [ ] Run `tests/analysis/draft-diff-preview.test.cjs`: bounded first differing range, emoji/Arabic and no source mutation. The preview is **not** an exact, complete multi-hunk diff.
- [ ] Run `tests/analysis/long-editor-responsiveness.test.cjs`: synthetic 20,000-word rapid input is coalesced, stale finding UI is cleared immediately and only the latest audit wins. Do not generalize these input timings to model loading, WebGPU or live-device speed.
- [ ] Confirm all V8 changed CSS and JavaScript assets have query version `20261014-v8-4-rc2`. A successful previous V7/V6 Pages check is not V8 proof.
- [ ] Manual keyboard-only, contrast, real mobile touch, actual DOCX rendering and assistive-technology review remain necessary; automated Chromium checks are valuable but not an accessibility certificate.

**Expected PR-only status:** automated quality and local model checks can pass, but
the public Pages run must still report `NOT_CANDIDATE` before merge.

## Engineering acceptance (independent of scientific authorship certification)

- [ ] Review latest PR SHA and file diff, security findings, deployment environment and baseline main SHA. Keep PR **draft** until every accepted gate passes.
- [ ] Confirm current **Quality checks** from the *candidate head SHA* pass. These must include real Chromium and regressions for Word DOCX original preservation, PDF.js extraction, offline OCR, writing advisor and Apply/Undo, bilingual RTL/mobile accessibility, evidence revisions, cancel/stale handling and CSP.
- [ ] Confirm **Live optional AI browser model smoke** from that same head SHA passes with genuine ONNX primary and deep secondary models. Mocked or skipped second-model inference does **not** qualify.
- [ ] Confirm backend, API smoke and external model diagnostics report their actual status and data provenance; vendor-claimed labels are not scientific approval.
- [ ] Complete S1 security review. In particular, dynamically imported Transformers.js inside a same-origin model iframe with `allow-scripts allow-same-origin` carries a high-confidence **structural third-party executable-code trust risk**; must not claim absolute no-text-exfiltration until remote code/integrity and isolation are independently verified. Existing S2 only pins string revisions and documents missing hashes/licenses.
- [ ] Verify that `Rewrite locally` remains **disabled** unless genuine model WebGPU inference, licenses, fixed-file hash, quality in AR/EN, cancellation, privacy and memory benchmarks are all independently passed.
- [ ] Confirm real-device performance/cold and warm model benchmarks when required; S3 synthetic editor-only timings are **not** device/ONNX/WebGPU benchmarks.
- [ ] Keep author probabilities disabled; the published experimental **model signal** may only be presented as uncalibrated evidence with explicit `INCONCLUSIVE` handling.
- [ ] Obtain an explicit **owner go/no-go approval** for any main-branch merge; tests alone never perform an automatic merge.

`assessEngineeringGate` in `docs/analysis/public-postdeploy-contract.js` evaluates these statuses in code. It returns `BLOCKED` or `APPROVAL_REQUIRED` when mandatory evidence or approval is missing. If a caller supplies `ownerApproved=true`, the result is only `REVIEW_REQUIRED`: an unverified boolean cannot authenticate the owner. `mergeAuthorized` remains `false` in every case. This module never calls GitHub APIs or modifies branches.

## Separate scientific certification gate — presently HOLD

- [ ] Fix independently reviewed, licensed, separated train/calibration/validation/release-test cohorts with pinned source and model revisions; no train/test or source-group leakage.
- [ ] For each proposed language/domain, study the preregistered 400 human + 400 AI planning minimum and a cluster-aware power calculation.
- [ ] Verify FPR/FNR, precision, recall, F1, AUROC, assessed/all-eligible abstention rates, conservative one-sided Wilson human FPR upper bound (goal at most 1%), ESL/formal/academic/Arabic slices, unseen AI generators and uncertainty.
- [ ] Fit calibration only on calibration data, evaluate on separate validation, hold RELEASE_TEST untouched; ECE <= 0.10 and Brier <= 0.20 are necessary gates for an authorship probability claim, not sufficient proof.
- [ ] Obtain independent scientific human review and release-owner signoff. `backend/research/release_decision.py` intentionally has **no automatic READY state**.

**Scientific HOLD need not block an otherwise safe experimental writing UI release**, provided authorship probabilities and unverified local generation remain disabled, and the product-owner and security checks permit it.

## Pages deployment and independent verification (only AFTER authorized merge)

1. Record **actual merge/squash SHA** and baseline main HEAD, not the PR's temporary synthetic merge SHA. Save baseline marker or note explicitly that old main had no V7 marker.
2. Await the actual GitHub Pages deployment conclusion; the built-in Pages workflow may not exist as a tracked YAML file. Do not assume a successful PR check deployed anything.
3. On `https://bimspecialist.github.io/Text-Integrity-Studio/`, require the exact candidate marker in `meta[name="tis-release-marker"]`. A cached V6 page or branch-local preview is **NOT** the candidate.
4. Execute `tests/deployed-ai-runtime.test.cjs` with `TIS_REQUIRE_S5=true` **against the public origin** (real Chromium and network). It must complete primary and user-opted-in secondary ONNX inference and observe matching frozen model revision identifiers in the validated controller evidence.
5. Inspect `releaseAudit.status=VERIFIED_DEPLOYED_CANDIDATE`, no failed model-domain requests or page errors; capture run URL, UTC timestamp, deployment SHA and release marker. Re-run Word/PDF/OCR, AR/EN and phone workflows on published assets as applicable.
6. If the public site differs or model fails, report **BLOCKED**, do not mark deployment verified. PR-only baseline diagnostics intentionally return `NOT_CANDIDATE` and cannot stand in for public testing.

The GitHub Actions `Deployed AI detection integration diagnostic` workflow is blocking for `push/main` and completed Pages workflows, with `TIS_REQUIRE_S5=true`; PR diagnostics remain non-blocking **observations of existing main**, not V7 candidate proof.

## Rollback contract

- Record and retain the exact last-known-good **main SHA**, source/asset integrity hashes and the candidate release marker before any merge.
- For a failed new main release, open an explicit rollback PR reverting the **actual squash/merge commit**, or restore main to the audited last-good state using authorized GitHub procedures and reviewer approval. Never force-push main or overwrite unrelated changes.
- Redeploy Pages, then run the public-origin smoke again to verify the **previous marker/version**, without incorrectly demanding the V7 marker after rollback. Preserve concise aggregate diagnostics without source text or per-document model predictions.
- If the rollback cannot be verified, retain **BLOCKED** and document the incident and the exact operational gap.

## Evidence ownership

| Evidence | Where it must be confirmed | Current boundary |
|---|---|---|
| Candidate Quality + real dual ONNX | GitHub Actions for **same PR head SHA** | Engineering tests only |
| Security review | `docs/security/LOCAL_MODEL_THREAT_MODEL.md` plus manually reviewed third-party code/license artifacts | Unconditional privacy assurance blocked |
| Scientific probability | E1–E5 and independently signed data review | HOLD |
| Local generator | L1–L8 real AR/EN WebGPU, licensed model, hash and private runtime review | HOLD |
| Public deployment | Published Pages + marker and two genuine ONNX in browser | NOT OBSERVED before merge |
| Owner approval | Explicit human decision | NOT GIVEN |

This checklist is an operational release contract, **not a claim that the site is merged, deployed, scientifically validated, privacy certified, or ready for a commercial announcement**.
