# Security policy and operational boundaries
Status: browser-only research prototype, October 2026. This document is not a certification or penetration-test report.

## What we enforce
- Static GitHub Pages site; no hosted user-document processing, API keys or model uploads.
- External CSS/JavaScript with a restrictive Content Security Policy meta tag (`connect-src 'none'`, `script-src 'self'`).
- Bundled JSZip, attributed under MIT. Supported DOCX files are scanned locally and ZIP sizes/entry counts/expansion ratios are limited before XML decompression.
- Word XML DTD/ENTITY declarations and macro-enabled packages are rejected; non-destructive exported copies are used.
- Complex field-coded, linked or previously revised paragraphs are conservatively excluded from tracked editorial changes.
- Unsigned/incorrect Word files can still fail open or re-save in Microsoft Word. Signed files are warned; Office validation is required for consequential documents.
- Human review is required for grammar edits, technical measurements and citations.
- AI-authorship classifier is not deployed, so no invented AI probabilities.

## Residual risks
| ID | Severity | Issue / boundary | Response |
|---|---|---|---|
| SEC-01 | Medium | GitHub Pages CSP is a meta tag, not configurable HTTP response headers; it cannot enforce `frame-ancestors` | Document limitation; require reverse proxy for stronger header deployment |
| SEC-02 | Medium | The Word editor accepts only simple direct text runs and may change formatting within replaced spans spanning differently styled runs | Show tracked changes; don't overwrite source; include regression fixtures |
| SEC-03 | Medium | Unsupported Word styles, drawings, images, fields and metadata are not fully analyzed; DTD rejection is limited to parsed text XML parts | Surface coverage; no claims of complete scan |
| SEC-04 | Medium | Vendored JSZip and development dependencies require ongoing vulnerability monitoring | Periodically review vendor advisories, pin versions and keep tests green |
| SEC-05 | High if enabled | Remote inference/API would expose text and require quotas, authentication, purpose limitation and deletion policies | No public API deployed; explicit design and approval gates before implementation |
| SEC-06 | High | Wrongful automated AI authorship accusations from miscalibrated classifiers | No public classifier score; separate held-out benchmark and human review |

## Reporting a vulnerability
Please use the GitHub repository's private security advisory feature, if enabled, or notify the repository owner privately. Do not paste sensitive document contents or proof-of-concept exploit data in a public issue.

## Release gates
- CI must pass all browser, DOCX, bilingual writing and Python evaluation tests on the release commit.
- Check browser CSP violations and network requests in Chrome, narrow/mobile Arabic RTL layouts, document round trips, and unsupported error states.
- No claimed security/compliance certification. Any serious privacy leak or corrupted Word output blocks promotion.

See `docs/privacy.html` for user-facing disclosure, and `research/EXECUTIVE_RESEARCH_2026.md` for the broader threat and quality strategy.
