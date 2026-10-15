# Fully local generative rewriter — L1 research gate (2026-10-14)

**Status: HOLD — no generative model enabled in production or the draft site.** This is evidence-gathering, not a browser-generation performance result.

## Sources and provenance

**Primary research candidate:** `onnx-community/Qwen3-0.6B-ONNX`, revision `558750086ed49d78cb701ed6fa85af33fd16453f`, ONNX file `onnx/model_q4f16.onnx`, dtype `q4f16`.

- Pinned ONNX artifact page: https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX/blob/558750086ed49d78cb701ed6fa85af33fd16453f/onnx/model_q4f16.onnx
- Public LFS/Xet object reports **569,789,750 bytes** for this single ONNX file and SHA-256 `9e33a5911974174761d0dfdcc0bec975d9c45af0eae5e9eb647b8ba9442a8f91`. **This is NOT a measurement of browser transfer, total model dependency size, startup RAM, GPU memory, throughput or language quality.**
- Upstream Qwen3-0.6B card declares **Apache-2.0**: https://huggingface.co/Qwen/Qwen3-0.6B
- ONNX community card supplies a Transformers.js `device: "webgpu", dtype: "q4f16"` example: https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX
- The ONNX repository README viewed for this study **does not independently establish the redistributed converted artifact's license and compliance chain**. Independent human license review is still required; do not infer the converted weights' license solely from upstream metadata.
- Another possible trial, `onnx-community/Qwen2.5-0.5B-Instruct`, publicly reports a roughly 483 MB q4f16 file. Its immutable revision, redistribution license and real target-device benchmark remain unresolved here. https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/tree/main/onnx

## What was verified and what was not

The repository records publicly described artifact metadata in `docs/analysis/local-rewrite-model-manifest.json`. The CI unit tests assert that mutable `main` revisions, unverified conversion licensing, missing device measurements and missing **actual** Arabic/English generation observations cannot promote a model. A fast Chromium preflight verifies the app does not silently download a model. It is *not a substitute for running inference*.

**Not performed:** downloading or executing this approximately 570 MB generator on a representative user GPU; recording full download bytes, cold/warm generation duration, memory usage, or sampling/output quality in Arabic or English. No fake results, mock speed measurements or fabricated license confirmations have been entered.

## Blocking gates for selection

1. Review original and ONNX conversion licensing/provenance, including model file redistribution rights and exact pinned content digest.
2. Obtain explicit user/device consent before any heavyweight static model download. Never transmit private document text/prompt/output to Hugging Face or another inference API. Only audited **GET** requests for approved static assets may leave the device.
3. Run **real Chromium/WebGPU** local generation with the pinned Transformers.js runtime and model revision. Record browser/OS/GPU, network request origins and total downloaded bytes, memory if observable, cold startup and warm output time. If memory usage cannot be measured, report `UNKNOWN` and keep the deployment gate closed until device profiling is completed.
4. Test a held-out, consented corpus including academic/engineering Arabic and English, second-language English, names, dates, measurements, units and citations. Independently review factual drift, semantic preservation, grammar, omissions and user acceptability; do not optimize for detector score.
5. Demonstrate exact source coverage and non-mutating preview/accept/undo, plus cancellation, stale-revision rejection, safe Worker isolation and responsive RTL/mobile fallback. Release approval is separate from passing an isolated model smoke.

## Trial command sketch (for a consented local development environment only)

Install a **pinned** version of `@huggingface/transformers` into an isolated development machine with WebGPU and call `pipeline('text-generation', '<pinned model id>', {device:'webgpu', dtype:'q4f16', revision:'<pinned SHA>'})`. Verify actual local generation twice, one Arabic and one English factual-preservation fixture, with network logging that proves no text-bearing POST/inference request. Record screenshots/log digests and have a different reviewer evaluate the outputs.

No one should interpret an npm module loading successfully, a model download finishing or a mocked string response as proof that high-quality fully local rewriting works.

**Decision:** HOLD. Production generator remains disabled. Keep the fast rule-based Humanize reviewer available for users; do not add a cloud fallback or a simulated full-document rewriting percentage.
