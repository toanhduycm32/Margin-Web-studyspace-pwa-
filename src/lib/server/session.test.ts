import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as start } from "@/app/api/auth/start/route";
import { GET as callback } from "@/app/api/auth/callback/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GET as library } from "@/app/api/library/route";
import { GET as artifact } from "@/app/api/artifacts/[id]/route";
import { GOOGLE_SCOPES } from "./google";

beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  vi.stubEnv("OWNER_EMAIL", "owner@example.com");
  vi.stubEnv("AUTHORIZED_GOOGLE_EMAILS", undefined);
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 5).toString("base64"));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Google account session", () => {
  it("binds OAuth callback to a nonce and returns a private session", async () => {
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

  it("keeps two authorized browser sessions and their Drive libraries isolated concurrently", async () => {
    vi.stubEnv("AUTHORIZED_GOOGLE_EMAILS", "alice@example.com,bob@example.com");
    const starts = await Promise.all(["alice", "bob"].map(() => start(new Request("http://localhost:3000/api/auth/start", {
      method: "POST", headers: { Origin: "http://localhost:3000" },
    }))));
    const states = await Promise.all(starts.map(async (response) => ({
      state: new URL((await response.json()).url).searchParams.get("state")!,
      nonce: response.headers.get("set-cookie")!.match(/margin_oauth_nonce=[^;]+/)![0],
    })));
    const fetchMock = vi.fn(async (url: string | URL, options?: RequestInit) => {
      const target = String(url);
      if (target.includes("oauth2.googleapis.com/token")) {
        const code = new URLSearchParams(String(options?.body)).get("code")!;
        return Response.json({ access_token: `access-${code}`, refresh_token: `refresh-${code}`,
          expires_in: 3600, scope: GOOGLE_SCOPES });
      }
      const token = new Headers(options?.headers).get("Authorization")?.replace("Bearer ", "");
      const user = token?.split("-")[1];
      if (target.includes("openidconnect.googleapis.com/v1/userinfo")) return Response.json({
        sub: `sub-${user}`, email: `${user}@example.com`, email_verified: true,
      });
      if (target.includes("/drive/v3/files?")) {
        const name = new URL(target).searchParams.get("q") || "";
        if (name.includes("artifact-")) return Response.json({ files: [] });
        return Response.json({ files: [{ id: `record-${user}`, description: `${user}'s PDF`,
          appProperties: { kind: "document", documentId: `file${user}12345678` } }] });
      }
      throw new Error(`Unexpected URL: ${target}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const callbacks = await Promise.all(["alice", "bob"].map((user, index) => callback(new Request(
      `http://localhost:3000/api/auth/callback?code=${user}&state=${encodeURIComponent(states[index].state)}`,
      { headers: { Cookie: states[index].nonce } },
    ))));
    const cookies = callbacks.map((response) => response.headers.get("set-cookie")!.match(/margin_session=[^;]+/)![0]);
    const requests = cookies.map((cookie) => ({ headers: { Cookie: cookie } }));
    const [aliceMe, bobMe, aliceLibrary, bobLibrary] = await Promise.all([
      me(new Request("http://localhost:3000/api/auth/me", requests[0])),
      me(new Request("http://localhost:3000/api/auth/me", requests[1])),
      library(new Request("http://localhost:3000/api/library", requests[0])),
      library(new Request("http://localhost:3000/api/library", requests[1])),
    ]);
    expect((await aliceMe.json()).email).toBe("alice@example.com");
    expect((await bobMe.json()).email).toBe("bob@example.com");
    expect((await aliceLibrary.json()).documents[0].name).toBe("alice's PDF");
    expect((await bobLibrary.json()).documents[0].name).toBe("bob's PDF");
    const otherArtifact = await artifact(new Request("http://localhost:3000/api/artifacts/22222222-2222-2222-2222-222222222222", requests[0]),
      { params: Promise.resolve({ id: "22222222-2222-2222-2222-222222222222" }) });
    expect(otherArtifact.status).toBe(404);
  });

  it("revokes an existing session when its email is removed from the allowlist", async () => {
    const { sessionCookie } = await import("./session");
    const cookie = sessionCookie({ sub: "sub-alice", email: "alice@example.com", accessToken: "a",
      refreshToken: "r", expiresAt: Date.now() + 3600_000, connectedAt: new Date().toISOString() });
    vi.stubEnv("AUTHORIZED_GOOGLE_EMAILS", "bob@example.com");
    const response = await me(new Request("http://localhost:3000/api/auth/me", { headers: { Cookie: cookie } }));
    expect(response.status).toBe(401);
  });

  it("expires an old encrypted session even if a raw cookie is replayed", async () => {
    const { sessionCookie } = await import("./session");
    const cookie = sessionCookie({ sub: "sub-owner", email: "owner@example.com", accessToken: "a",
      refreshToken: "r", expiresAt: Date.now() + 3600_000,
      connectedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString() });
    const response = await me(new Request("http://localhost:3000/api/auth/me", { headers: { Cookie: cookie } }));
    expect(response.status).toBe(401);
  });

  it("denies an unlisted Google account before creating a session", async () => {
    vi.stubEnv("AUTHORIZED_GOOGLE_EMAILS", "alice@example.com");
    const started = await start(new Request("http://localhost:3000/api/auth/start", {
      method: "POST", headers: { Origin: "http://localhost:3000" },
    }));
    const state = new URL((await started.json()).url).searchParams.get("state")!;
    const nonce = started.headers.get("set-cookie")!.match(/margin_oauth_nonce=[^;]+/)![0];
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("oauth2.googleapis.com/token")) return Response.json({
        access_token: "access-bob", refresh_token: "refresh-bob", expires_in: 3600, scope: GOOGLE_SCOPES,
      });
      if (url.includes("openidconnect.googleapis.com/v1/userinfo")) return Response.json({
        sub: "sub-bob", email: "bob@example.com", email_verified: true,
      });
      if (url.includes("oauth2.googleapis.com/revoke")) return new Response(null, { status: 200 });
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await callback(new Request(`http://localhost:3000/api/auth/callback?code=bob&state=${encodeURIComponent(state)}`,
      { headers: { Cookie: nonce } }));
    expect(response.headers.get("location")).toBe("http://localhost:3000/?auth=not-authorized");
    expect(response.headers.get("set-cookie")).not.toContain("margin_session=");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("oauth2.googleapis.com/revoke"))).toBe(true);
  });
});
