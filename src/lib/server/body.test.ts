import { describe, expect, it } from "vitest";
import { readJsonBody } from "./body";

describe("bounded AI request bodies", () => {
  it("accepts valid JSON without a Content-Length header", async () => {
    const request = new Request("http://localhost/api/ai/chunk", {
      method: "POST", body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"ok":true}')); controller.close(); } }),
      duplex: "half",
    } as RequestInit);
    expect(await readJsonBody<{ ok: boolean }>(request, 20)).toEqual({ ok: true });
  });

  it("stops an oversized streamed request even when Content-Length is absent", async () => {
    const request = new Request("http://localhost/api/ai/chunk", {
      method: "POST", body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(21)); controller.close(); } }),
      duplex: "half",
    } as RequestInit);
    await expect(readJsonBody(request, 20)).rejects.toMatchObject({ status: 413 });
  });
});
