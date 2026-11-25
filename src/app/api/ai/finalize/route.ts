import { withSession } from "@/lib/server/session";
import { AppError } from "@/lib/server/errors";
import { finalize, type FinalizeInput } from "@/lib/server/pipeline";
import { readJsonBody } from "@/lib/server/body";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return withSession(request, async (session) => {
    const body = await readJsonBody<FinalizeInput>(request, 750_000);
    if (!body) throw new AppError(400, "Invalid completion request.");
    return Response.json({ artifact: await finalize(session, body) });
  });
}
