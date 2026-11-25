import { withSession } from "@/lib/server/session";
import { AppError } from "@/lib/server/errors";
import { processChunk, type ChunkInput } from "@/lib/server/pipeline";
import { readJsonBody } from "@/lib/server/body";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return withSession(request, async (session) => {
    const body = await readJsonBody<ChunkInput>(request, 120_000);
    if (!body) throw new AppError(400, "Invalid processing request.");
    return Response.json(await processChunk(session, body));
  });
}
