/* Private Next.js route authentication; external login/IAM must issue tis_session.
 * Never mint access tokens in browser code or expose TIS_SESSION_JWT_SECRET.
 */
import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";

export async function requireSession(req: NextRequest): Promise<{ userId: string } | null> {
  const secret = process.env.TIS_SESSION_JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  const cookie = req.cookies.get("tis_session")?.value;
  if (!cookie || cookie.length > 8192) return null;
  try {
    const verified = await jwtVerify(cookie, new TextEncoder().encode(secret), {
      issuer: "tis-auth-service",
      audience: "tis-detector",
      algorithms: ["HS256"],
    });
    const sub = verified.payload.sub;
    if (!sub || typeof sub !== "string" || sub.length > 128) return null;
    return { userId: sub };
  } catch {
    return null;
  }
}

export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const permitted = process.env.TIS_PUBLIC_ORIGIN;
  // Require origin on stateful/cookie-authenticated POST to block CSRF.
  return !!permitted && !!origin && origin === permitted;
}

const quotas = new Map<string, number[]>();
export function allowRequest(userId: string): boolean {
  const now = Date.now();
  const recent = (quotas.get(userId) || []).filter(t => now - t < 60_000);
  if (recent.length >= 12) return false;
  recent.push(now);
  quotas.set(userId, recent);
  if (quotas.size > 2000) {
    for (const [id, events] of quotas.entries()) {
      if (events.every(t => now - t > 60_000)) quotas.delete(id);
    }
  }
  return true;
}
