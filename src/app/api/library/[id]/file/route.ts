import { createHash } from "node:crypto";
import { withSession } from "@/lib/server/session";
import { checkedPdf, getDocumentRecord } from "@/lib/server/store";
import { driveFetch } from "@/lib/server/google";
import { AppError } from "@/lib/server/errors";
import { planPdfRange } from "@/lib/shared/range";

export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };

const verifiedFiles = new Map<string, { expiresAt: number; size: Promise<number> }>();
const VERIFICATION_TTL_MS = 60_000;

function verifiedPdfSize(accessToken: string, id: string): Promise<number> {
  const key = createHash("sha256").update(accessToken).update("\0").update(id).digest("hex");
  const cached = verifiedFiles.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.size;
  const size = Promise.all([getDocumentRecord(accessToken, id), checkedPdf(accessToken, id)])
    .then(([, file]) => Number(file.size))
    .catch((error) => { verifiedFiles.delete(key); throw error; });
  verifiedFiles.set(key, { expiresAt: Date.now() + VERIFICATION_TTL_MS, size });
  if (verifiedFiles.size > 64) verifiedFiles.delete(verifiedFiles.keys().next().value!);
  return size;
}

async function serve(request: Request, context: Context): Promise<Response> {
  return withSession(request, async (session) => {
    const { id } = await context.params;
    const size = await verifiedPdfSize(session.accessToken, id);
    const headers = new Headers({ "Content-Type": "application/pdf", "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes", "Vary": "Cookie" });
    if (request.method === "HEAD") {
      headers.set("Content-Length", String(size));
      return new Response(null, { status: 200, headers });
    }
    const plan = planPdfRange(request.headers.get("range"), size);
    if ("error" in plan) throw new AppError(plan.status, plan.error);
    const match = /^bytes=(\d+)-(\d+)$/.exec(plan.range)!;
    const begin = Number(match[1]);
    const end = Number(match[2]);
    const expectedRange = `bytes ${begin}-${end}/${size}`;
    const upstream = await driveFetch(session.accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, {
        headers: { Range: plan.range }, signal: AbortSignal.timeout(55_000),
      });
    const completeFile = begin === 0 && end === size - 1;
    if (upstream.status !== 206 && !(upstream.status === 200 && completeFile)) {
      await upstream.body?.cancel();
      throw new AppError(502, "Google Drive ignored the requested PDF byte range.");
    }
    const maximum = 2 * 1024 * 1024 + 64 * 1024;
    const declared = Number(upstream.headers.get("content-length"));
    if (declared > maximum) {
      await upstream.body?.cancel();
      throw new AppError(502, "Drive did not provide a bounded PDF range.");
    }
    if (!upstream.body) throw new AppError(502, "Drive returned no PDF data.");
    const reader = upstream.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new AppError(502, "Drive PDF range exceeded the response limit.");
      }
      chunks.push(Buffer.from(value));
    }
    if (total !== end - begin + 1) throw new AppError(502, "Google Drive returned an incomplete PDF byte range.");
    const bytes = Buffer.concat(chunks);
    if (begin === 0 && !bytes.subarray(0, 1024).toString("latin1").includes("%PDF-")) {
      throw new AppError(502, "Google Drive did not return PDF data.");
    }
    if (upstream.status === 206 && upstream.headers.get("content-range") !== expectedRange) {
      throw new AppError(502, "Google Drive returned a mismatched PDF byte range.");
    }
    headers.set("Content-Range", expectedRange);
    headers.set("Content-Length", String(total));
    return new Response(bytes, { status: 206, headers });
  });
}

export async function GET(request: Request, context: Context) { return serve(request, context); }
export async function HEAD(request: Request, context: Context) { return serve(request, context); }
