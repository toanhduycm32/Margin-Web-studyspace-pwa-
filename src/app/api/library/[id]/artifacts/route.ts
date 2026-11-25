import { withSession } from "@/lib/server/session";
import { getDocumentRecord, listArtifacts } from "@/lib/server/store";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return withSession(request, async (session) => {
    const { id } = await context.params;
    await getDocumentRecord(session.accessToken, id);
    return Response.json({ artifacts: await listArtifacts(session.accessToken, id) });
  });
}
