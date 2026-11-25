import { afterEach, describe, expect, it, vi } from "vitest";
import { HEAD } from "./route";
import { sessionCookie } from "@/lib/server/session";
import { checkedPdf, getDocumentRecord } from "@/lib/server/store";

vi.mock("@/lib/server/store", () => ({
  getDocumentRecord: vi.fn(async () => ({ record: { schema: 1 }, meta: { id: "record12345678" } })),
  checkedPdf: vi.fn(async () => ({ size: "100", mimeType: "application/pdf" })),
}));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("PDF verification cache", () => {
  it("never reuses one account's verified file for another account's token", async () => {
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("AUTHORIZED_GOOGLE_EMAILS", "alice@example.com,bob@example.com");
    vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 8).toString("base64"));
    const cookie = (sub: string, email: string) => sessionCookie({ sub, email,
      accessToken: `token-${sub}`, refreshToken: `refresh-${sub}`, expiresAt: Date.now() + 3600_000,
      connectedAt: new Date().toISOString() });
    const request = (value: string) => new Request("http://localhost:3000/api/library/shared123/file", {
      method: "HEAD", headers: { Cookie: value },
    });
    const context = { params: Promise.resolve({ id: "shared123" }) };
    const [alice, bob] = await Promise.all([
      HEAD(request(cookie("alice", "alice@example.com")), context),
      HEAD(request(cookie("bob", "bob@example.com")), context),
    ]);
    expect(alice.status).toBe(200);
    expect(bob.status).toBe(200);
    expect(vi.mocked(getDocumentRecord).mock.calls.map(([token]) => token).sort())
      .toEqual(["token-alice", "token-bob"]);
    expect(vi.mocked(checkedPdf).mock.calls.map(([token]) => token).sort())
      .toEqual(["token-alice", "token-bob"]);
  });
});
