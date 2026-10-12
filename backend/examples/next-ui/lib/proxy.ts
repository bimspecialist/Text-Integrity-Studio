/* Server-only FastAPI proxy. The browser never receives TIS_API_KEY. */
import type { NextRequest } from "next/server";
import { requireSession, sameOrigin, allowRequest } from "./auth";

const PRIVATE_API = "http://127.0.0.1:8000/v1";

export function reply(code: number, value: object): Response {
  return Response.json(value, {
    status: code,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function validateRequest(req: NextRequest): Promise<Response | null> {
  const identity = await requireSession(req);
  if (!identity) return reply(401, { error: "Sign in with a verified session before using detection" });
  if (!sameOrigin(req)) return reply(403, { error: "Cross-site document requests are not permitted" });
  if (!allowRequest(identity.userId)) return reply(429, { error: "Request quota exceeded" });
  if (!process.env.TIS_API_KEY || process.env.TIS_API_KEY.length < 32)
    return reply(503, { error: "Private upstream analysis service is not configured" });
  return null;
}

export async function boundedJson(req: NextRequest, maxBytes = 135_000): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get("content-length") || "-1");
  if (len > maxBytes) return null;
  if (!req.body) return null;
  const reader = req.body.getReader(); const chunks: Uint8Array[] = [];
  let count = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      count += item.value.byteLength;
      if (count > maxBytes) { await reader.cancel(); return null; }
      chunks.push(item.value);
    }
    const body = new Uint8Array(count);
    let index = 0;
    for (const chunk of chunks) { body.set(chunk, index); index += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch { return null; }
}

export async function forward(path: "/analyze" | "/analyze-file", body: string | FormData): Promise<Response> {
  const key = process.env.TIS_API_KEY;
  if (!key || key.length < 32) return reply(503, { error: "Upstream key is missing" });
  try {
    const response = await fetch(PRIVATE_API + path, {
      method: "POST",
      body,
      headers: typeof body === "string"
        ? { "X-API-Key": key, "Content-Type": "application/json" }
        : { "X-API-Key": key },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(31_000),
    });
    if (!(response.headers.get("content-type") || "").includes("application/json"))
      return reply(502, { error: "Invalid upstream response" });
    const data = await response.json();
    return reply(response.status, data);
  } catch {
    return reply(503, { error: "Private analysis service unavailable" });
  }
}
