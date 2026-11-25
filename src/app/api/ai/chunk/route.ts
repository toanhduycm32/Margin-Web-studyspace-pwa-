import { withSession } from "@/lib/server/session";
import { AppError } from "@/lib/server/errors";
import { processChunk, type ChunkInput } from "@/lib/server/pipeline";
import { readJsonBody } from "@/lib/server/body";
import { logAiFailure } from "@/lib/server/ai-diagnostics";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return withSession(request, async (session) => {
    const body = await readJsonBody<ChunkInput>(request, 120_000);
    if (!body) throw new AppError(400, "Invalid processing request.");
    try { return Response.json(await processChunk(session, body, request.signal)); }
    catch (error) { logAiFailure("chunk", session.sub, body.operationId, error); throw error; }
  });
}
