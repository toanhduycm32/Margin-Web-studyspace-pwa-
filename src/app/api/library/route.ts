import { withSession } from "@/lib/server/session";
import { importPdf, listLibrary } from "@/lib/server/store";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withSession(request, async (session) => {
    const pageToken = new URL(request.url).searchParams.get("pageToken") || undefined;
    if (pageToken && pageToken.length > 500) throw new AppError(400, "Invalid page token.");
    return Response.json(await listLibrary(session.accessToken, pageToken));
  });
}

export async function POST(request: Request) {
  return withSession(request, async (session) => {
    const body = await request.json().catch(() => null) as { fileId?: unknown } | null;
    if (typeof body?.fileId !== "string") throw new AppError(400, "Choose a PDF in Google Picker.");
    return Response.json(await importPdf(session.accessToken, body.fileId));
  });
}
