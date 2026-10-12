/* Deliberately disabled in production. Establish a local-only dev/test session
 * without committing credentials or pretending a production identity provider exists.
 */
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Development login is disabled" }, { status: 404 });
  }
  const allowed = process.env.TIS_PUBLIC_ORIGIN || "";
  const key = process.env.TIS_LOCAL_DEV_SETUP_KEY || "";
  if (allowed !== "http://localhost:3000" || req.headers.get("origin") !== allowed ||
      key.length < 32) {
    return Response.json({ error: "Local developer credentials are not configured" }, { status: 403 });
  }
  const supplied = req.headers.get("X-Dev-Setup-Key") || "";
  const { timingSafeEqual, createHash } = await import("node:crypto");
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(key).digest();
  if (!timingSafeEqual(a, b)) {
    return Response.json({ error: "Invalid development setup key" }, { status: 401 });
  }
  const secret = process.env.TIS_SESSION_JWT_SECRET || "";
  if (secret.length < 32) {
    return Response.json({ error: "Session secret is not configured" }, { status: 503 });
  }
  const signed = await new SignJWT({ purpose: "local-development-only" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("local-development-user")
    .setIssuer("tis-auth-service")
    .setAudience("tis-detector")
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(new TextEncoder().encode(secret));
  const jar = await cookies();
  jar.set({
    name: "tis_session", value: signed, httpOnly: true,
    sameSite: "strict", secure: false, path: "/", maxAge: 1800,
  });
  return Response.json({ status: "DEVELOPMENT_SESSION_READY", expires_in_seconds: 1800 },
    { headers: { "Cache-Control": "no-store" } });
}
