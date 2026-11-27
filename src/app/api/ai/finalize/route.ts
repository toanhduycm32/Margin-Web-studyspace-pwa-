import { withSession } from "@/lib/server/session";
import { AppError } from "@/lib/server/errors";
import { finalize, type FinalizeInput } from "@/lib/server/pipeline";
import { readJsonBody } from "@/lib/server/body";
import { logAiFailure } from "@/lib/server/ai-diagnostics";
import { MAX_FINALIZE_BYTES } from "@/lib/shared/limits";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return withSession(request, async (session) => {
    const body = await readJsonBody<FinalizeInput>(request, MAX_FINALIZE_BYTES);
    if (!body) throw new AppError(400, "Invalid completion request.");
    try { return Response.json({ artifact: await finalize(session, body) }); }
    catch (error) { logAiFailure("finalize", session.sub, body.operationId, error); throw error; }
  });
}
