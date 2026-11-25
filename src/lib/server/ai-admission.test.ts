import { afterEach, describe, expect, it, vi } from "vitest";
import { withAiAdmission } from "./ai-admission";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function mockDriveUsage() {
  const usage = new Map<string, number>();
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL, options?: RequestInit) => {
    const token = new Headers(options?.headers).get("Authorization")?.replace("Bearer ", "") || "";
    calls.push(token);
    if (String(url).includes("/upload/drive/v3/files?")) {
      usage.set(token, (usage.get(token) || 0) + 1);
      return Response.json({ id: "usage-record" });
    }
    if (String(url).includes("/drive/v3/files?")) return Response.json({
      files: Array.from({ length: usage.get(token) || 0 }, (_, index) => ({ id: `usage${index}` })),
    });
    throw new Error(`Unexpected URL: ${url}`);
  }));
  return { usage, calls };
}

describe("shared NVIDIA admission", () => {
  it("allows two users at once while blocking a second simultaneous call for one user", async () => {
    const { usage, calls } = mockDriveUsage();
    let releaseAlice!: () => void;
    let releaseBob!: () => void;
    let aliceStarted!: () => void;
    let bobStarted!: () => void;
    const aliceReady = new Promise<void>((resolve) => { aliceStarted = resolve; });
    const bobReady = new Promise<void>((resolve) => { bobStarted = resolve; });
    const alice = withAiAdmission({ sub: "sub-alice-concurrent", accessToken: "token-alice" }, async (reserve) => {
      await reserve();
      aliceStarted(); return new Promise<string>((resolve) => { releaseAlice = () => resolve("A"); });
    });
    const bob = withAiAdmission({ sub: "sub-bob-concurrent", accessToken: "token-bob" }, async (reserve) => {
      await reserve();
      bobStarted(); return new Promise<string>((resolve) => { releaseBob = () => resolve("B"); });
    });
    await Promise.all([aliceReady, bobReady]);
    await expect(withAiAdmission({ sub: "sub-alice-concurrent", accessToken: "token-alice" }, async () => "again"))
      .rejects.toMatchObject({ status: 429 });
    expect(usage.get("token-alice")).toBe(1);
    expect(usage.get("token-bob")).toBe(1);
    expect(new Set(calls)).toEqual(new Set(["token-alice", "token-bob"]));
    releaseAlice(); releaseBob();
    expect(await Promise.all([alice, bob])).toEqual(["A", "B"]);
  });

  it("enforces a separate daily Drive quota for each account", async () => {
    vi.stubEnv("AI_DAILY_CALL_LIMIT", "2");
    const { usage } = mockDriveUsage();
    const alice = { sub: "sub-alice-daily", accessToken: "token-alice" };
    const bob = { sub: "sub-bob-daily", accessToken: "token-bob" };
    await withAiAdmission(alice, async (reserve) => { await reserve(); return "first"; });
    await withAiAdmission(alice, async (reserve) => { await reserve(); return "second"; });
    await expect(withAiAdmission(alice, async (reserve) => { await reserve(); return "third"; }))
      .rejects.toMatchObject({ status: 429 });
    expect(await withAiAdmission(bob, async (reserve) => { await reserve(); return "Bob's call"; })).toBe("Bob's call");
    expect(usage.get("token-alice")).toBe(2);
    expect(usage.get("token-bob")).toBe(1);
  });

  it("does not overspend in one process when Drive indexing lags", async () => {
    vi.stubEnv("AI_DAILY_CALL_LIMIT", "1");
    let uploads = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      if (String(url).includes("/upload/drive/v3/files?")) { uploads++; return Response.json({ id: "usage-record" }); }
      return Response.json({ files: [] });
    }));
    const user = { sub: "sub-lagging-index", accessToken: "token-lagging-index" };
    await withAiAdmission(user, async (reserve) => { await reserve(); return "ok"; });
    await expect(withAiAdmission(user, async (reserve) => { await reserve(); return "another"; }))
      .rejects.toMatchObject({ status: 429 });
    expect(uploads).toBe(1);
  });
});
