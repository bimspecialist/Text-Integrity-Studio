# Text Integrity Studio — Website testing of V11 (preview only)

## Preview URLs

The GitHub Pages site's published root stays the old V9 user experience unless a tester explicitly opens one of these routes.

- **V11 local writing review preview:** `https://bimspecialist.github.io/Text-Integrity-Studio/?v11preview=1`
- **Bilingual, self-contained acceptance desk:** `https://bimspecialist.github.io/Text-Integrity-Studio/quality/v11-manual-acceptance.html`
- **Current default site:** `https://bimspecialist.github.io/Text-Integrity-Studio/` (unchanged V9 behavior)

These links only become live after this isolated preview PR is independently merged into the **Pages source branch** and GitHub Pages finishes publishing. Opening the GitHub feature branch does not itself publish HTML.

## Tester walkthrough

1. Open the V11 preview link on a desktop or phone; use **Review text / مراجعة النص** with a non-sensitive trial paragraph. The original document is protected.
2. Preview an actual spelling suggestion before using **Apply correction / تطبيق التصحيح**. Confirm **Undo / التراجع** restores the original. Open a real but non-sensitive TXT/DOCX/PDF test file; DOCX changes must not apply automatically.
3. Open **V11 testing desk / لوحة اختبارات V11** from the preview. Only mark **PASS** for a real device test that actually ran, with tester code, device/version, observation and a redacted evidence reference.
4. For writing usefulness, prepare 30 independently sourced, rights-verified Arabic and 30 English samples, each reviewed by two *different* humans. The 60 sample slots start blank. No fabricated ratings.
5. **Export JSON** before leaving the desk. Nothing is auto-saved, uploaded, or persisted to localStorage. Record only pseudonymous identifiers and redacted evidence; never enter confidential source texts or personal names.

## Why these boundaries matter

- This **publishes only an opt-in preview and a QA-only page**. It is not a final V11 release, AI detector calibration, or a claim that models can prove authorship.
- The general website default flow is unchanged. V10 and V11 assets activate only through their respective query parameters.
- The main editor retains its restrictive CSP; the QA-only page also uses **first-party external JavaScript/CSS**, `connect-src 'none'`, and no inline scripts.
- Test records do not independently verify physical AT results, real 400% browser zoom, or reviewer accuracy; manually entered PASS states are not trusted by CI.
- Prior V11 M1, M2, and M5 branch PRs remain unmerged. The special preview PR cherry-picks only required browser assets and verified live-test paths.
- If the preview causes problems, remove the four opt-in asset references and the QA-only page in a separate rollback commit or revert the special preview merge. No source documents should be stored on GitHub Pages.

## Automated QA evidence

The feature branch has a Chromium preflight that verifies the default route remains V9, the opt-in V11 route works, the QA desk has 18 initially unrun checks and 60 blank sample slots, strict CSP, multilingual content, evidence validation and JSON export/import, plus M1/M2 regressions.

**Release status: HOLD** until independently documented manual device/accessibility and human editorial evaluations and explicit final owner approval.
