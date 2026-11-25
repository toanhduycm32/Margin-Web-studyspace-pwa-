import { withSession } from "@/lib/server/session";
import { checkedPdf, getDocumentRecord, setProgress } from "@/lib/server/store";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return withSession(request, async (session) => {
    const { id } = await context.params;
    const [stored, file] = await Promise.all([
      getDocumentRecord(session.accessToken, id), checkedPdf(session.accessToken, id),
    ]);
    return Response.json({ record: stored.record, file,
      changed: stored.record.importedMd5 !== file.md5Checksum });
  });
}

export async function PATCH(request: Request, context: Context) {
  return withSession(request, async (session) => {
    const { id } = await context.params;
    const body = await request.json().catch(() => null) as { page?: unknown; offset?: unknown } | null;
    if (typeof body?.page !== "number" || typeof body?.offset !== "number") throw new AppError(400, "Invalid reading position.");
    await setProgress(session.accessToken, id, body.page, body.offset);
    return Response.json({ saved: true });
  });
}
