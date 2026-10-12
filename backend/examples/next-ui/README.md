# Next.js Hybrid Detection UI — Private Integration

The Next.js example is a standalone authenticated application next to the new Python/FastAPI detector, not part of the public GitHub Pages static site.

## Run locally
1. Start FastAPI according to backend/README.md; keep it on 127.0.0.1:8000.
2. Open backend/examples/next-ui and run npm install.
3. Copy .env.example to .env.local and configure:
   - TIS_PUBLIC_ORIGIN=http://localhost:3000
   - TIS_API_KEY=the private key from FastAPI TIS_API_KEYS
   - TIS_SESSION_JWT_SECRET=a fresh 32+ character random private secret
   - TIS_LOCAL_DEV_SETUP_KEY=another independent 32+ character random private secret
4. Run npm run dev (Node 22 or newer).
5. Visit http://localhost:3000/dev, enter the local development key to issue a 30-minute HttpOnly signed test session.
6. Visit http://localhost:3000 and upload TXT/DOCX/PDF (maximum 6 MiB) or paste text.

The development login always refuses when NODE_ENV is not development. It is NOT real production authentication. For deployment connect a trusted identity provider that issues short-lived signed sessions with issuer tis-auth-service, audience tis-detector, subject user ID, and the HttpOnly Secure SameSite tis_session cookie. Apply CSRF policy, TLS, monitoring and distributed per-user quotas.

## Privacy and API protection
The browser calls only same-origin Next.js routes; Next holds FastAPI X-API-Key on the server. Never expose keys through NEXT_PUBLIC_ variables. Next validates signed sessions, Origin, request sizes and user limits; FastAPI independently authenticates keys and validates files. Nothing sends raw text to an external AI provider automatically. In upload mode, the Next route explicitly requests parsed text back from the backend for accurate overlays; the default direct API request does not return source text. Do not log documents.

## Output
- INCONCLUSIVE with null percentage: no evidence-backed public probability available.
- Independently calibrated segment results: red = HIGH_AI_SIGNAL; yellow = UNCERTAIN_MIXED; green = LOW_AI_SIGNAL.
- Unassessed or short segments: gray and null percentage.
- Even a calibrated percentage is an estimated model signal, not a percentage of human/AI-authored words.
- Segment offsets are Unicode code points, mapped through Array.from(source) in the React UI.

## File support
Text-based PDF, Word DOCX and UTF8 TXT supported. Encrypted or malformed documents are rejected. An image-only PDF returns OCR_REQUIRED: process using the existing browser-local OCR tool, then paste the text. Limits include 6 MiB and 60 PDF pages.

## Validation
The repository runs Next.js TypeScript compilation and a production build through .github/workflows/next-integration.yml. This is code/build verification, not public server deployment.
