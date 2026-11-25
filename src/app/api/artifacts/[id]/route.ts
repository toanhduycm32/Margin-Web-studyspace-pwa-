import { withSession } from "@/lib/server/session";
import { getArtifact } from "@/lib/server/store";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return withSession(request, async (session) => {
    const { id } = await context.params;
    return Response.json({ artifact: await getArtifact(session.accessToken, id) });
  });
}
