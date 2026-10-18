# Text Integrity Studio V10.3 — Device Accessibility Acceptance

**Status: OPEN — no physical screen-reader or real-device sign-off recorded.**
**Target:** opt-in GitHub branch `feature/v10-1-centered-flow` and `?v10preview=1`. **Not** the published V9 default.
**Standard:** WCAG 2.2 AA where applicable. Browser automation does **not** certify conformance.

## What we have measured automatically

The GitHub V10 preview preflight uses real headless Chromium, axe-core, computed styles, accessibility-tree names, native file-picker keyboard access, responsive sizes (320/390/768/1440 CSS px), reduced-motion emulation, passage dialog focus, controller failure/cancel/retry and private JSON exports. A passing job confirms the specified fixture assertions only. See `.github/workflows/v10-release-preflight.yml`.

Never mark the remaining tests **PASS** without actual observations and device details. Never claim that the uncalibrated English research-model output is a proven AI-writing percentage, or that Arabic origin detection is available.

## Manual release checklist — English / العربية

Record tester, date, OS/browser version, physical device, screen-reader name/version, input method and exact HEAD SHA for each run. For each case mark **PASS / FAIL / NOT RUN**, provide a brief observation, and attach a redacted screenshot or short video when something fails. Do **not** attach private user documents.

| # | Device / tool | Steps and required behavior — English | خطوات القبول — العربية |
|---|---|---|---|
| AT-01 | Windows Chrome or Edge + NVDA | Open the V10 preview. Use Tab/Shift+Tab only. The file chooser, source editor and Analyze action have descriptive accessible names and visible focus. Source text remains unchanged. | استخدم Tab وShift+Tab؛ يجب أن تكون التسميات العربية واضحة ويظهر التركيز دون ضياعه. |
| AT-02 | Windows + NVDA | Toggle EN/AR and re-focus the text input. Its spoken accessible name must match the visible associated label in the chosen language. Technical English inside Arabic text must retain sensible reading order. | بدّل اللغة وأعد التركيز على حقل الكتابة؛ تحقق من تطابق الاسم المنطوق مع العنوان الظاهر واتجاه النص المختلط. |
| AT-03 | Windows + NVDA | Activate file picker from the keyboard; select a personal **test** TXT/DOCX/PDF. Verify the imported text, reading order and file feedback. Invalid formats must not overwrite existing text. | ارفع ملفًا تجريبيًا بلوحة المفاتيح، وراجع ترتيب الجمل وحماية النص عند اختيار ملف غير مدعوم. |
| AT-04 | Windows + NVDA | For eligible English input, deliberately start an optional model scan only with informed consent to download model assets. The progress heading/status and cancel action must be discoverable. Do not treat the uncalibrated research signal as authorship probability. | افحص نصًا إنجليزيًا مؤهلًا بعد الموافقة على تنزيل النموذج؛ يجب إعلان حالة التقدم وإمكانية الإلغاء بوضوح. |
| AT-05 | Windows + NVDA | With short/Arabic text, verify the unsupported explanation and route back to editor are announced correctly and no fabricated score or AI-origin claim appears. | جرّب نصًا عربيًا وقصيرًا؛ يجب توضيح محدودية كشف AI وعدم اختلاق نسبة. |
| AT-06 | Windows + NVDA | With research-result fixture or explicitly run supported test, navigate evaluated passages. Selecting a highlight should announce its details without moving focus unexpectedly. The legend must explain measured windows versus proven authorship. | انتقل بين المقاطع المميزة؛ تحقق من إعلان تفاصيل المقطع دون ضياع التركيز أو ادعاء إثبات التأليف. |
| AT-07 | Android Chrome + TalkBack and/or iPhone Safari + VoiceOver | Open a highlighted passage. The native dialog must announce a localized title; close via accessible button/back and verify focus returns to the invoking passage. | افتح تفاصيل المقطع بالجوال؛ يجب نطق عنوان الحوار بالعربية وإرجاع التركيز إلى المقطع بعد إغلاقه. |
| AT-08 | Real phone and touch | Use the centered input, upload, Analyze, Cancel, Improve writing and Download report. Check touch-target clarity, no blocked buttons, no unintended horizontal scroll, and a usable on-screen keyboard. | اختبر اللمس وظهور لوحة المفاتيح وعدم اختفاء الأزرار أو التمرير الجانبي. |
| AT-09 | Desktop browser with manual zoom | Check actual browser zoom at 200% and 400% (e.g. 1280px desktop at 400% becomes ~320 CSS px). Check input, long results, passage dialog, progress, errors and writing comparison without loss of content/function. | اختبر تكبير المتصفح الحقيقي 200% و400%، وراجع جميع الشاشات وعدم قص المحتوى. |
| AT-10 | OS text scale / accessibility text settings | Increase text size to 200%; verify labels, buttons and status text remain legible, without clipped Arabic strings. Test reduced-motion OS setting. | كبّر النص إلى 200% وفعّل تقليل الحركة؛ راجع التفاف النص وسلامة العناصر. |
| AT-11 | Windows High Contrast / Forced Colors | Check focus, text, highlights and primary actions. Highlighting must not be the only indicator of research windows; passage explanation remains available. | شغّل التباين العالي وتأكد من وضوح التركيز والدلالات النصية وعدم الاكتفاء باللون. |
| AT-12 | Desktop & mobile, EN & AR | Exercise model unavailable/offline, cancel, retry and local JSON report export. Confirm error recovery and no missing original source text or unsupported probability claim. Open exported JSON and verify the original source prose is excluded. | جرّب انقطاع النموذج والإلغاء وإعادة المحاولة والتصدير، وتأكد من حفظ النص الأصلي وعدم تسريب النص داخل التقرير. |

## Evidence template — one line per physical test

| ID | Tester/date | Device / OS | Browser / AT version | Language | PASS / FAIL / NOT RUN | Observation + evidence / issue |
|---|---|---|---|---|---|---|
| AT-01…AT-12 | **Unassigned** | **Unverified** | **Unverified** | EN / AR | **NOT RUN** | No claim of physical-device acceptance |

## Blocking release conditions

- Any keyboard trap, missing accessible name, lost passage-dialog focus, missing error recovery, content loss, or unlabelled false-positive AI claim is **BLOCKING**.
- Report axe-core **incomplete** contrast nodes as pending a manual computed/raster review unless another dedicated test measures the actual style; an axe zero-violation summary alone does not resolve them.
- Keep PR #22 as **Draft**, no merge or Pages deployment until manual checks are recorded and the project owner explicitly authorizes release.

## V10.4 simulated accessibility evidence (2026-10-18)

This is **additional automated evidence, not physical AT approval**.

- Chromium CDP emulated `forced-colors: active` and `prefers-reduced-motion: reduce` in **English and Arabic** at **320/390/1280 CSS pixels**. A dedicated V10-only CSS rule preserves system-colored focus and makes measured passages visually recognizable with an **underline and a bottom border** when the yellow background is suppressed.
- The regression `tests/analysis/workspace-v10-forced-colors-reflow-browser.test.cjs` checks focus outlines, the non-color measured-window indicator, optional local text-size 200% enlargement **only as a stress fixture**, clear primary actions, export button text, and absence of tested horizontal overflow.
- [Passing regression and short-lived screenshots](https://github.com/bimspecialist/Text-Integrity-Studio/actions/runs/39114594086). The computed highlights retained a 2px bottom border **and** text underline; focus outlines remained 3px.
- An earlier failed run was a **test harness issue**, because the site's CSP correctly blocked injected `<style>` elements. The harness now tests enlarged text via element CSSOM instead of relaxing CSP. Another initial test failure came from incorrectly assuming programmatic focus was equivalent to keyboard `:focus-visible`; the harness now starts with keyboard modality.
- **Not yet tested:** actual Windows high-contrast color palette, actual Chrome/Edge/Safari 200%/400% page zoom, user-defined OS text scaling, physical NVDA/TalkBack/VoiceOver, or real mobile touch. The manual AT-01 through AT-12 rows remain **NOT RUN**; release decision remains **HOLD**.
