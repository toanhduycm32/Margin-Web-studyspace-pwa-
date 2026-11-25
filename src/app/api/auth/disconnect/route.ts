import { clearSessionCookie, withSession } from "@/lib/server/session";
import { revokeGoogle } from "@/lib/server/google";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withSession(request, async (session) => {
    await revokeGoogle(session.refreshToken);
    const response = Response.json({ connected: false });
    response.headers.append("Set-Cookie", clearSessionCookie());
    return response;
  });
}
