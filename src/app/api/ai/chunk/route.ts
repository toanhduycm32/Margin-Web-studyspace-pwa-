import { withSession } from "@/lib/server/session";
import { AppError } from "@/lib/server/errors";
import { processChunk, type ChunkInput } from "@/lib/server/pipeline";
import { readJsonBody } from "@/lib/server/body";
import { logAiFailure } from "@/lib/server/ai-diagnostics";
import { MAX_CHUNK_REQUEST_BYTES } from "@/lib/shared/limits";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return withSession(request, async (session) => {
    const body = await readJsonBody<ChunkInput>(request, MAX_CHUNK_REQUEST_BYTES);
    if (!body) throw new AppError(400, "Invalid processing request.");
    // Leave time for an explicit failure response before Vercel's hard timeout.
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(280_000)]);
    try { return Response.json(await processChunk(session, body, signal)); }
    catch (error) { logAiFailure("chunk", session.sub, body.operationId, error); throw error; }
  });
}
