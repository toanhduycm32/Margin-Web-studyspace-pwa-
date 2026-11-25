import { withSession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withSession(request, async (session) => Response.json({ email: session.email, connectedAt: session.connectedAt }));
}
