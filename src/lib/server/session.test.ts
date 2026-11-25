import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as start } from "@/app/api/auth/start/route";
import { GET as callback } from "@/app/api/auth/callback/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GOOGLE_SCOPES } from "./google";

beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  vi.stubEnv("OWNER_EMAIL", "owner@example.com");
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 5).toString("base64"));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Google account session", () => {
  it("binds OAuth callback to a nonce and returns a private owner session", async () => {
    const started = await start(new Request("http://localhost:3000/api/auth/start", {
      method: "POST", headers: { Origin: "http://localhost:3000" },
    }));
    expect(started.status).toBe(200);
    const authUrl = new URL((await started.json()).url);
    expect(authUrl.origin).toBe("https://accounts.google.com");
    expect(authUrl.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callback");
    expect(authUrl.searchParams.get("scope")?.split(" ")).toEqual([
      "openid", "email", "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.appdata",
    ]);
    expect(authUrl.searchParams.get("access_type")).toBe("offline");
    const state = authUrl.searchParams.get("state");
    const nonceCookie = started.headers.get("set-cookie")!.split(";")[0];
    expect(state).toBeTruthy();
    expect(nonceCookie).toContain("margin_oauth_nonce=");

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("oauth2.googleapis.com/token")) return Response.json({
        access_token: "short-access", refresh_token: "private-refresh", expires_in: 3600, scope: GOOGLE_SCOPES,
      });
      if (url.includes("openidconnect.googleapis.com/v1/userinfo")) return Response.json({
        sub: "google-sub-123", email: "owner@example.com", email_verified: true,
      });
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const returned = await callback(new Request(`http://localhost:3000/api/auth/callback?code=example&state=${encodeURIComponent(state!)}`, {
      headers: { Cookie: nonceCookie },
    }));
    expect(returned.status).toBe(302);
    expect(returned.headers.get("location")).toBe("http://localhost:3000/?auth=connected");
    const sessionPair = returned.headers.get("set-cookie")!.match(/margin_session=[^;]+/)?.[0];
    expect(sessionPair).toBeTruthy();
    expect(sessionPair).not.toContain("private-refresh");
    const status = await me(new Request("http://localhost:3000/api/auth/me", { headers: { Cookie: sessionPair! } }));
    expect(status.status).toBe(200);
    expect((await status.json()).email).toBe("owner@example.com");
  });

  it("rejects a cross-site connection request", async () => {
    const response = await start(new Request("http://localhost:3000/api/auth/start", {
      method: "POST", headers: { Origin: "https://another-site.example" },
    }));
    expect(response.status).toBe(403);
  });
});
