import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppData, readAppData, updateAppData } from "./google";

afterEach(() => vi.unstubAllGlobals());

describe("large Unicode learning resources", () => {
  it("saves and reopens a 300-item bank with Vietnamese explanations", async () => {
    const value = { questions: Array.from({ length: 300 }, (_, i) => ({ id: String(i),
      explanation: "Giải thích kiến thức, điều kiện và giới hạn của câu trả lời. ".repeat(50) })) };
    expect(Buffer.byteLength(JSON.stringify(value))).toBeGreaterThan(1_000_000);
    let stored = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        stored = String(init.body).split("Content-Type: application/json; charset=UTF-8\r\n\r\n")[2].split("\r\n--margin_")[0];
        return Response.json({ id: "record12345678" });
      }
      if (init?.method === "PATCH") { stored = String(init.body); return new Response(null, { status: 204 }); }
      return new Response(stored, { headers: { "content-type": "application/json" } });
    }));
    await createAppData("token", "quiz.json", value, { kind: "artifact" });
    expect(await readAppData("token", "record12345678")).toEqual(value);
    await updateAppData("token", "record12345678", value);
    expect(await readAppData("token", "record12345678")).toEqual(value);
  });
  it("bounds a streamed UTF-8 record by bytes even without a length header", async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      pull(controller) { controller.enqueue(new TextEncoder().encode("ệ".repeat(400_000))); },
      cancel() { cancelled = true; },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    await expect(readAppData("token", "record12345678")).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
  });
});
