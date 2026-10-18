# Text Integrity Studio V11 — M5 Advisory Writing Release Gate

**Scope:** in-browser bilingual **writing review and human-authorized edits only**, behind `?v11preview=1`.

**Status:** **AUTOMATED PRE-FLIGHT PASS / PUBLIC RELEASE HOLD.** Automated evidence does not substitute for physical assistive-technology testing, authentic browser zoom, review usefulness assessments, or explicit owner approval. Research AI origin detection and on-device generative rewriting are **not** part of the advisory-writing release claim.

## Approved user promise

- One centered text entry or supported document import, one **Review text / مراجعة النص** action.
- Actual **local rule-based** writing observations, never a guaranteed grammar check or proven human/AI-authorship verdict.
- A suggestion's before/after must be previewed before the user confirms a low-risk change. Manual-risk and Word/DOCX changes remain read-only. Explicit individual Undo and Dismiss are available.
- No automatic remote inference, model weights, or source upload in the core writing-review workflow. External research weights are only requested after the user explicitly chooses the separately disclosed optional English-only research action.
- Browser refresh clears the active document; local report downloads and user clipboard actions remain under user control.
- Local editing **after the page assets have loaded** can work with the network disconnected; initial navigation without internet connectivity is not guaranteed or tested.

## Grounded automated evidence

All results refer to actual GitHub CI jobs that ran test files in Chromium on the M5 review branch:

| Gate | Test files / observations | Status |
|---|---|---|
| No external source transfer during core review | `tests/analysis/workspace-v11-m5-privacy-offline-browser.test.cjs` intercepts requests and checks no third-party hosts, no non-GET, no model iframe or model asset request | **PASS** in fixture |
| No persistence / malicious markup | Same real-browser test checks the private sentinel is absent from local/session storage and cookies, source refreshes to empty, and untrusted HTML remains inert | **PASS** in fixture |
| Offline-after-load writing + privacy-safe report | Same test disconnects browser network after first-party page load, reviews in EN/AR, performs EN preview/apply/undo and exports local JSON without embedded private sentinel | **PASS** in fixture |
| RTL, focus, reflow and forced colors | `tests/analysis/workspace-v11-m5-reflow-focus-browser.test.cjs` covers EN/AR × 320/390/768/1440 CSS px, keyboard focus, synthetic forced-colors and 200% text CSSOM stress. Focus outlines 3px; no tested clipping or horizontal overflow | **PASS** in fixture |
| Preview-before-apply, protected facts, revision, undo, dismiss | M2 real-browser and pure editorial tests including preserved independent drafts, stale rejection, protected units/references and manual Arabic | **PASS** in fixtures |
| Real DOCX/PDF import and V10 compatibility | M1/V10 real-browser fixtures including long documents and no automatically triggered AI model | **PASS** in fixtures |
| Browser accessibility static checks | M1/M2 axe automated WCAG-tagged scans on documented viewports | **PASS** in tested fixtures; not WCAG conformance |
| Standalone repository quality and experimental model regression | Runs on PR creation, if linked to this exact HEAD | **Verify exact HEAD before any approval** |

Evidence: [M5 Chromium preflight](https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/39132679602).

The first new M5 run failed because the test treated Chromium's decorative late-loading `favicon.svg` as an essential online application dependency. An explicit exception for only that favicon was added; all other browser asset failures and all third-party/POST/model requests remain disallowed. Re-run passed. This did **not** require changing application security or bypassing CSP.

## Human / physical-device release gates — NOT RUN

Record one row per language and device with tester, date, OS/browser, screen reader/version, exact commit, steps, observed result, and any redacted issue/evidence. **Do not upload private student documents.**

| ID | Required acceptance exercise | Status |
|---|---|---|
| MAN-01 | Windows Chrome/Edge + NVDA: source label, file picker, Review text, preview, protected Apply, Undo, Dismiss, confirmation/status spoken, keyboard-only focus recovered | **NOT RUN** |
| MAN-02 | Android Chrome + TalkBack **and** iOS Safari + VoiceOver: inspect first-touch UI, RTL changes, keyboard/dialog focus, 44px targets, mobile scrolling | **NOT RUN** |
| MAN-03 | Real Chrome/Edge/Safari 200% and 400% browser zoom, and 200% OS text enlargement for EN/AR with long feedback and long labels | **NOT RUN** |
| MAN-04 | Actual Windows high contrast / system forced colors and reduced motion, with meaningful visual distinction between disabled/applicable/manual-only suggestions | **NOT RUN** |
| MAN-05 | At least 30 varied Arabic and 30 varied English **source-documented** writing samples, scored independently by two human reviewers using a predefined rubric: soundness, usefulness, meaning preservation, cultural/dialect fit. Initial acceptance proposal: 80% useful suggestions per language, zero auto-applied high-risk factual changes | **NOT RUN** |
| MAN-06 | Real personal-test DOCX/PDF including RTL+Latin measurement values, large/unusual files, offline interruption before/after load, and exported JSON inspection | **NOT RUN** |
| MAN-07 | Independent privacy/security review beyond CSP and tested browser fixtures, including third-party supply-chain and release-hosting configuration | **NOT RUN** |
| MAN-08 | Product owner visually accepts actual V11 screenshots and explicitly approves **separate merge and publication steps**, not merely development or M5 test completion | **NOT RUN** |

No completion percentage should be inferred from the number of automated tests. A green axe scan is *not* a screen-reader or full WCAG 2.2 AA pass.

## Release blockers and stop/go rules

1. **HOLD** while any critical keyboard, content integrity, silent network, data loss, or authorship claim issue is unresolved. Never auto-apply manual-risk suggestions.
2. **HOLD** until MAN-01–MAN-08 have recorded evidence, or the owner explicitly revises a gate's scope after understanding its risk.
3. Keep `main`, GitHub Pages, V10 PR #22, V11 M1 PR #23 and V11 M2 PR #24 unchanged. M5 is a draft PR against M2, not a release.
4. AI detector output remains experimental and uncalibrated; English model accuracy did not meet previous production acceptance thresholds, Arabic AI detector is not approved. Generative rewriting remains disabled. Neither is required for advisory writing, but both must be truthfully disclosed and not promoted as released.
5. Rollback if release is later authorized: preserve the last production SHA, run the same acceptance suite against the release SHA, and revert the release commit or disable the V11 entry path if regressions appear; do not rewrite original user documents.

**Decision at M5:** Automated advisory workflow is a candidate for hands-on signoff, **not ready for an unconditional public-release claim**.
