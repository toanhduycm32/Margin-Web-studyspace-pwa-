import { randomBytes } from "node:crypto";
import { authorizationUrl } from "@/lib/server/google";
import { sign } from "@/lib/server/crypto";
import { checkOrigin, oauthNonceCookie } from "@/lib/server/session";
import { failure } from "@/lib/server/errors";
import { ownerEmail } from "@/lib/server/config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    ownerEmail();
    const nonce = randomBytes(24).toString("base64url");
    const state = sign({ nonce, expiresAt: Date.now() + 600_000 });
    const response = Response.json({ url: authorizationUrl(state) }, { headers: { "Cache-Control": "no-store" } });
    response.headers.append("Set-Cookie", oauthNonceCookie(nonce));
    return response;
  } catch (error) { return failure(error); }
}
