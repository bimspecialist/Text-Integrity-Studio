import type { NextRequest } from "next/server";
import { boundedJson, forward, reply, validateRequest } from "../../../lib/proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const reject = await validateRequest(req);
  if (reject) return reject;
  if (!(req.headers.get("content-type") || "").startsWith("application/json"))
    return reply(415, { error: "Expected application/json" });
  const body = await boundedJson(req);
  if (!body || typeof body.text !== "string" || !body.text.trim() || body.text.length > 120_000)
    return reply(422, { error: "Valid text of at most 120,000 characters required" });
  return forward("/analyze", JSON.stringify(body));
}
