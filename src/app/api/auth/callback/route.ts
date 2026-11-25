import { appOrigin, ownerEmail } from "@/lib/server/config";
import { verify } from "@/lib/server/crypto";
import { exchangeCode, googleIdentity, revokeGoogle } from "@/lib/server/google";
import { clearNonceCookie, readNonce, sessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let destination: URL;
  try { destination = new URL("/", appOrigin()); }
  catch { return Response.json({ error: "APP_ORIGIN is not configured." }, { status: 503 }); }
  let cookie: string | null = null;
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const stateValue = url.searchParams.get("state");
    const nonce = readNonce(request);
    if (!code || !stateValue || !nonce) throw new Error("OAuth state is missing.");
    const state = verify<{ nonce: string; expiresAt: number }>(stateValue);
    if (!state || state.nonce !== nonce || state.expiresAt < Date.now()) throw new Error("OAuth state is invalid.");
    const tokens = await exchangeCode(code);
    const identity = await googleIdentity(tokens.accessToken);
    if (identity.email.toLowerCase() !== ownerEmail()) {
      await revokeGoogle(tokens.refreshToken).catch(() => {});
      throw new Error("This Google account is not the allowed owner.");
    }
    cookie = sessionCookie({ sub: identity.sub, email: identity.email.toLowerCase(),
      ...tokens, connectedAt: new Date().toISOString() });
    destination.searchParams.set("auth", "connected");
  } catch {
    destination.searchParams.set("auth", "failed");
  }
  const response = new Response(null, { status: 302, headers: {
    Location: destination.toString(), "Cache-Control": "no-store",
  } });
  response.headers.append("Set-Cookie", clearNonceCookie());
  if (cookie) response.headers.append("Set-Cookie", cookie);
  return response;
}
