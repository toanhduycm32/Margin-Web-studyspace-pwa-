import { withSession } from "@/lib/server/session";
import { AppError } from "@/lib/server/errors";
import { processChunk, type ChunkInput } from "@/lib/server/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return withSession(request, async (session) => {
    if (Number(request.headers.get("content-length")) > 120_000) throw new AppError(413, "Processing chunk is too large.");
    const body = await request.json().catch(() => null) as ChunkInput | null;
    if (!body) throw new AppError(400, "Invalid processing request.");
    return Response.json(await processChunk(session.accessToken, body));
  });
}
