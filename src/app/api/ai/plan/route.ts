import { withSession } from "@/lib/server/session";
import { readJsonBody } from "@/lib/server/body";
import { processLearningPlan, type ChunkInput } from "@/lib/server/pipeline";
import { MAX_CHUNK_REQUEST_BYTES } from "@/lib/shared/limits";
import { logAiFailure } from "@/lib/server/ai-diagnostics";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return withSession(request, async (session) => {
    const input = await readJsonBody<ChunkInput>(request, MAX_CHUNK_REQUEST_BYTES);
    try { return Response.json(await processLearningPlan(session, input,
      AbortSignal.any([request.signal, AbortSignal.timeout(240_000)]))); }
    catch (error) { logAiFailure("plan", session.sub, input.operationId, error); throw error; }
  });
}
