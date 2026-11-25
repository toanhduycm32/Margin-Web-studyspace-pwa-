import { withSession } from "@/lib/server/session";
import { AppError } from "@/lib/server/errors";
import { finalize, type FinalizeInput } from "@/lib/server/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return withSession(request, async (session) => {
    if (Number(request.headers.get("content-length")) > 750_000) throw new AppError(413, "Processing result is too large.");
    const body = await request.json().catch(() => null) as FinalizeInput | null;
    if (!body) throw new AppError(400, "Invalid completion request.");
    return Response.json({ artifact: await finalize(session.accessToken, body) });
  });
}
