import type { NextRequest } from "next/server";
import { forward, reply, validateRequest } from "../../../lib/proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE = 6 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<Response> {
  const reject = await validateRequest(req);
  if (reject) return reject;
  const declared = Number(req.headers.get("content-length") || "-1");
  if (!Number.isFinite(declared) || declared < 0 || declared > MAX_FILE + 250_000)
    return reply(413, { error: "File upload exceeds size limit or lacks Content-Length" });
  if (!(req.headers.get("content-type") || "").startsWith("multipart/form-data"))
    return reply(415, { error: "Expected multipart form upload" });
  try {
    const incoming = await req.formData();
    const candidate = incoming.get("file");
    if (!(candidate instanceof File) || !candidate.name || candidate.size < 1 || candidate.size > MAX_FILE)
      return reply(422, { error: "A supported file of 6 MiB or less is required" });
    if (!/\.(pdf|txt|docx)$/i.test(candidate.name) || /[/\\\x00]/.test(candidate.name))
      return reply(422, { error: "Unsupported or unsafe file name" });
    const output = new FormData();
    output.set("file", candidate, candidate.name);
    for (const key of ["language", "domain", "writing_context", "segment_by", "include_segments"]) {
      const value = incoming.get(key);
      if (typeof value === "string" && value.length <= 64) output.set(key, value);
    }
    // Client explicitly opts in so the original parsed plain text can be
    // highlighted. The backend returns it only to this authenticated caller.
    output.set("return_extracted_text", "true");
    return forward("/analyze-file", output);
  } catch {
    return reply(422, { error: "Invalid or unsupported multipart document" });
  }
}
