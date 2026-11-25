import { appOrigin, isAuthorizedEmail } from "./config";
import { seal, unseal } from "./crypto";
import { AppError, failure } from "./errors";
import { refreshAccessToken } from "./google";

export type Session = {
  sub: string;
  email: string;
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
  connectedAt: string;
};

const SESSION_COOKIE = "margin_session";
const NONCE_COOKIE = "margin_oauth_nonce";

function cookieValue(request: Request, name: string): string | null {
  const pair = request.headers.get("cookie")?.split(";").map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : null;
}

function secureFlag(): string { return appOrigin().startsWith("https:") ? "; Secure" : ""; }

export function sessionCookie(session: Session): string {
  return `${SESSION_COOKIE}=${seal(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureFlag()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag()}`;
}

export function oauthNonceCookie(nonce: string): string {
  return `${NONCE_COOKIE}=${nonce}; Path=/api/auth/callback; HttpOnly; SameSite=Lax; Max-Age=600${secureFlag()}`;
}

export function clearNonceCookie(): string {
  return `${NONCE_COOKIE}=; Path=/api/auth/callback; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag()}`;
}

export function readNonce(request: Request): string | null { return cookieValue(request, NONCE_COOKIE); }

export async function readSession(request: Request): Promise<{ session: Session; renewed: boolean }> {
  const value = cookieValue(request, SESSION_COOKIE);
  if (!value) throw new AppError(401, "Connect your Google account first.");
  const session = unseal<Session>(value);
  const connectedAt = Date.parse(session?.connectedAt || "");
  if (!session || !session.sub || !session.email || !session.refreshToken || !session.accessToken ||
      !Number.isFinite(session.expiresAt) || !Number.isFinite(connectedAt) ||
      connectedAt > Date.now() + 300_000 || Date.now() - connectedAt > 30 * 24 * 60 * 60 * 1000 ||
      !isAuthorizedEmail(session.email)) {
    throw new AppError(401, "Session is invalid. Connect again.");
  }
  if (session.expiresAt > Date.now() + 90_000) return { session, renewed: false };
  const refreshed = await refreshAccessToken(session.refreshToken);
  return { session: { ...session, ...refreshed }, renewed: true };
}

export function checkOrigin(request: Request): void {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) return;
  if (request.headers.get("origin") !== appOrigin()) throw new AppError(403, "Request origin is not allowed.");
}

export async function withSession(request: Request,
  handler: (session: Session) => Promise<Response>): Promise<Response> {
  try {
    checkOrigin(request);
    const { session, renewed } = await readSession(request);
    const response = await handler(session);
    response.headers.set("Cache-Control", "no-store");
    if (renewed && !response.headers.get("Set-Cookie")?.includes(`${SESSION_COOKIE}=`)) {
      response.headers.append("Set-Cookie", sessionCookie(session));
    }
    return response;
  } catch (error) {
    const response = failure(error);
    if (error instanceof AppError && error.status === 401) {
      try { response.headers.append("Set-Cookie", clearSessionCookie()); } catch { /* configuration is missing */ }
    }
    return response;
  }
}
