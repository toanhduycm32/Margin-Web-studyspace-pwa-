import { withSession } from "@/lib/server/session";
import { readJsonBody } from "@/lib/server/body";
import { beginGeneration } from "@/lib/server/store";
import type { GenerationOperation } from "@/lib/shared/types";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return withSession(request, async (session) => {
    const input = await readJsonBody<Pick<GenerationOperation, "id" | "documentId" | "sourceMd5" | "kind">>(request, 4000);
    return Response.json({ operation: await beginGeneration(session.sub, session.accessToken, input) });
  });
}
