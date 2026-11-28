import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractTextPages, partitionSectionPages } from "./extract";
import { documentSections, sectionLearningText } from "./structure";

describe.skipIf(!process.env.MARGIN_BOOK_PATH)("genuine Vietnamese dentistry textbook", () => {
  it("extracts all 222 pages and the 11 real lessons without splitting accented syllables", async () => {
    const pdf = await getDocument({ data: new Uint8Array(await readFile(process.env.MARGIN_BOOK_PATH!)), useSystemFonts: true }).promise;
    try {
      const pages = await extractTextPages(pdf, () => {});
      const sections = await documentSections(pdf, pages);
      const learningPages = sectionLearningText(pages, sections);
      const chunks = partitionSectionPages(learningPages, sections);
      expect(pages).toHaveLength(222);
      const lessons = sections.filter((section) => section.role === "instruction");
      expect(lessons.map((section) => section.startPage)).toEqual([9, 27, 34, 85, 131, 141, 159, 169, 183, 202, 210]);
      expect(pages[8].text).toContain("BÀI 1");
      expect(pages[8].text).not.toContain("b ệ nh");
      expect(learningPages.slice(0, 8).every((page) => !page.text)).toBe(true);
      if (process.env.MARGIN_BOOK_OUTPUT) await writeFile(process.env.MARGIN_BOOK_OUTPUT,
        JSON.stringify({ pages, sections, learningPages, chunks }, null, 2));
      console.info("book_extraction", { pages: pages.length, lessons: lessons.length, chunks: chunks.length,
        characters: learningPages.reduce((sum, page) => sum + page.text.length, 0),
        lessonTitles: lessons.map((section) => section.title) });
    } finally { await pdf.destroy(); }
  }, 120_000);
});
