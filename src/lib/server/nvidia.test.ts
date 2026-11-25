import { afterEach, describe, expect, it, vi } from "vitest";
import { summarizeChunk } from "./nvidia";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("NVIDIA reasoning request", () => {
  it("sends the source through a server-only reasoning-enabled request", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
    const digest = "This section defines the topic, describes its mechanism, relates it to the broader course, and notes its limits in enough detail for study.";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ digest }) } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await summarizeChunk("A source passage about a mechanism and its limits.", 1, 2, async () => {})).toBe(digest);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    const body = JSON.parse(String(options.body));
    expect(body.chat_template_kwargs.enable_thinking).toBe(true);
    expect(body.reasoning_budget).toBe(4096);
    expect(body.stream).toBe(false);
  });
  it("reserves a call again before retrying malformed model output", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
    const digest = "This section defines the topic, describes its mechanism, relates it to the broader course, and notes its limits in enough detail for study.";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: "stop", message: { content: "not-json" } }] }))
      .mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ digest }) } }] })));
    const reserve = vi.fn(async () => {});
    expect(await summarizeChunk("A passage about a mechanism and its limits.", 1, 1, reserve)).toBe(digest);
    expect(reserve).toHaveBeenCalledTimes(2);
  });
});
