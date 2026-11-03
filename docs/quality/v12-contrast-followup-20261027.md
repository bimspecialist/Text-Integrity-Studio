# V12 color-contrast follow-up — 27 October 2026

## Scope and reproducibility

This is a **read-only Chromium evidence audit**, not an accessibility certification or a production UI redesign. It targets the unresolved `axe-core` `color-contrast` nodes reported in V12 EN/AR at 1440px/390px on input, guided-review and writing screens.

- Diagnostic source: `tests/analysis/workspace-v12-contrast-diagnostic.test.cjs`.
- CI integration: `.github/workflows/v12-unified-preview.yml`.
- 6 state checks, using real headless Chromium and axe. The tests do not load model weights or transmit document data.
- Relevant initial detection: [run 40519675982](https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/40519675982).
- Measured text, placeholder and hit-test evidence: [run 40520395367](https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/40520395367).
- Hard regression guard added to require >=4.5:1 computed contrast and at least five unobscured viewport hit tests per required element. Check the newest exact-head run for final acceptance.

## What axe actually reported

There were **zero confirmed axe WCAG color-contrast violations** in six states. Some nodes remained `incomplete` because axe could not determine whether the textarea was partly obscured, or because a decorative file icon consists only of a non-text character. One Arabic heading was also classified as partly obscured. Do not translate `incomplete` into a failed WCAG result or a passed certification.

Independent computed-style comparisons from the actual Chromium DOM:

| Element | Foreground / background | Computed ratio | Measured secondary evidence |
|---|---|---:|---|
| Source editor on input | rgb(33, 43, 69) / rgb(255, 255, 255) | **14.04:1** | Placeholder 5.72:1 |
| Both writing editors | rgb(37, 49, 72) / rgb(252, 253, 255) | **12.80:1** | Source placeholder 5.62:1 |
| Arabic writing heading | rgb(32, 40, 60) / white ancestor | **14.68:1** | Foreground color inherited in V12/V11 |
| Decorative upload icon | rgb(185, 225, 255) / rgb(43, 66, 91) | **7.51:1** | Icon is aria-hidden, not sole upload label |

In the measured run, **all 9 of 9 representative hit-test points** for each analyzed incomplete element reached that element or its descendant after scrolling it into view. This is evidence against the specific overlapping-element hypothesis at the sampled points; it is not a pixel-by-pixel occlusion proof.

The new regression also measures the core source/draft and heading controls explicitly, even when future axe versions no longer flag them as incomplete, to prevent vacuous tests.

## Decision and protections

No production CSS or DOM change is justified by these measured colors. Recoloring already legible elements would increase design regression risk without evidence of a defect. Retain the exact original document, opt-in model, source-revision validity, dual editor, EN/AR behavior and default V9 route.

**Scoped acceptance** requires both the dedicated V12 Chromium workflow and general Quality workflow to pass at the exact candidate head, with the new contrast/hit guard exercised. A reported `axe` incomplete category remains visible in QA; it is not silently marked as resolved by axe.

**Not verified:** physical NVDA/VoiceOver/TalkBack, all combinations of 200–400% zoom, user-device high-contrast settings, manual visual inspection under every browser/OS, and complete WCAG 2.2 AA conformance. These need separate hands-on testing before any general accessibility claim or release sign-off.

## Regression rule

Any changes to V10/V11/V12 text fields, heading overlays, upload treatment, colors, or responsive positioning must run the existing axe test **and** this independent computed contrast + viewport hit-test guard. A failure must be diagnosed at the first style/overlay boundary, not hidden or converted into a passing outcome.
