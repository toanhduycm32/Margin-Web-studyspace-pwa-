import { afterEach, describe, expect, it, vi } from "vitest";
import { importPdf } from "./store";

afterEach(() => vi.unstubAllGlobals());

describe("Drive-only PDF library records", () => {
  it("registers a selected PDF in the app data folder without copying its bytes", async () => {
    const calls: Array<{ url: string; options?: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string | URL, options?: RequestInit) => {
      const target = String(url); calls.push({ url: target, options });
      if (target.includes("/drive/v3/files/file12345678")) return Response.json({ id: "file12345678", name: "Course.pdf",
        mimeType: "application/pdf", size: "50000", md5Checksum: "a".repeat(32), capabilities: { canDownload: true } });
      if (target.includes("/upload/drive/v3/files?")) return Response.json({ id: "record12345678", name: "document-file12345678.json",
        description: "Course.pdf", appProperties: { kind: "document", documentId: "file12345678" } });
      if (target.includes("/drive/v3/files?")) return Response.json({ files: [] });
      throw new Error(`Unexpected URL: ${target}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const imported = await importPdf("access-token", "file12345678");
    expect(imported.record.sourceId).toBe("file12345678");
    expect(imported.item.name).toBe("Course.pdf");
    const listUrl = new URL(calls.find((call) => call.url.includes("/drive/v3/files?"))!.url);
    expect(listUrl.searchParams.get("spaces")).toBe("appDataFolder");
    const upload = calls.find((call) => call.url.includes("/upload/drive/v3/files?"))!;
    expect(String(upload.options?.body)).toContain('"parents":["appDataFolder"]');
    expect(String(upload.options?.body)).not.toContain("%PDF-");
  });

  it("rejects a non-PDF file", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "file12345678", name: "Notes.txt",
      mimeType: "text/plain", size: "1000", md5Checksum: "a".repeat(32) })));
    await expect(importPdf("access-token", "file12345678")).rejects.toMatchObject({ status: 415 });
  });
});
