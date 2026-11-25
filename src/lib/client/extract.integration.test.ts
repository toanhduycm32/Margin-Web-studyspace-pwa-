import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractWholePdf } from "./extract";

function threePagePdf(): Uint8Array {
  const lines = [
    "Beginning: photosynthesis turns sunlight into stored energy.",
    "Middle: chlorophyll absorbs light in plant cells.",
    "End: glucose stores energy for later use.",
  ];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>",
    ...[7, 8, 9].map((stream) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 300] /Resources << /Font << /F1 6 0 R >> >> /Contents ${stream} 0 R >>`),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...lines.map((line) => {
      const content = `BT /F1 12 Tf 40 250 Td (${line}) Tj ET`;
      return `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    }),
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "ascii"));
}

describe("whole-PDF text extraction", () => {
  it("visits and extracts beginning, middle, and end from a real three-page PDF", async () => {
    const task = getDocument({ data: threePagePdf(), useSystemFonts: true });
    const pdf = await task.promise;
    const progress: number[] = [];
    try {
      const chunks = await extractWholePdf(pdf, (page) => progress.push(page));
      const text = chunks.map((chunk) => chunk.text).join("\n");
      expect(progress).toEqual([1, 2, 3]);
      expect(chunks[0].startPage).toBe(1);
      expect(chunks.at(-1)?.endPage).toBe(3);
      expect(text).toContain("Beginning: photosynthesis");
      expect(text).toContain("Middle: chlorophyll");
      expect(text).toContain("End: glucose");
    } finally {
      await pdf.destroy();
    }
  });
});
