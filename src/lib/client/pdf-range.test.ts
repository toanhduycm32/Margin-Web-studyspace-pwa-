import { afterEach, describe, expect, it, vi } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { DrivePdfRangeTransport } from "./pdf-range";

function samplePdf(): Uint8Array {
  const content = "BT /F1 12 Tf 40 250 Td (Range-loaded document) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  pdf += `% ${"x".repeat(2 * 1024 * 1024)}\n`;
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "ascii"));
}

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("PDF.js Drive range transport", () => {
  it("loads and renders a PDF through multiple exact byte ranges", async () => {
    const bytes = samplePdf();
    const ranges: string[] = [];
    globalThis.fetch = vi.fn(async (_url, options) => {
      const requested = new Headers(options?.headers).get("Range") || "";
      ranges.push(requested);
      const match = /^bytes=(\d+)-(\d+)$/.exec(requested)!;
      const begin = Number(match[1]);
      const end = Number(match[2]);
      return new Response(bytes.slice(begin, end + 1), { status: 206,
        headers: { "Content-Range": `bytes ${begin}-${end}/${bytes.length}`, "Content-Type": "application/pdf" } });
    }) as typeof fetch;
    let failure: Error | null = null;
    const transport = new DrivePdfRangeTransport("/api/library/test/file", bytes.length, (error) => { failure = error; });
    const task = getDocument({ range: transport, rangeChunkSize: 256 * 1024, disableStream: true,
      disableAutoFetch: true, useSystemFonts: true });
    try {
      const pdf = await task.promise;
      expect(pdf.numPages).toBe(1);
      expect((await (await pdf.getPage(1)).getTextContent()).items.length).toBeGreaterThan(0);
      expect(failure).toBeNull();
      expect(ranges.length).toBeGreaterThan(1);
      expect(ranges).toContain("bytes=0-262143");
    } finally {
      await task.destroy();
    }
  });

  it("rejects an HTTP response that is not an exact range", async () => {
    globalThis.fetch = vi.fn(async () => new Response("bad", { status: 200 })) as typeof fetch;
    const failures: Error[] = [];
    const transport = new DrivePdfRangeTransport("/pdf", 100, (error) => failures.push(error));
    transport.requestDataRange(0, 10);
    await vi.waitFor(() => expect(failures).toHaveLength(1));
    expect(failures[0].message).toMatch(/unexpected PDF byte range/i);
  });
});
