import { describe, expect, it } from "vitest";
import { detectHeadingSections, documentSections } from "./structure";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { partitionSectionPages } from "./extract";

describe("source structure and processing segments", () => {
  it("preserves different chapters on consecutive pages", () => {
    const pages = ["Gradient Descent", "Learning Rate and Evidence", "Generalization"]
      .map((title, index) => ({ page: index + 1, text: `Chapter ${index + 1} ${title}\nSource content.` }));
    expect(detectHeadingSections(pages).map((section) => [section.startPage, section.endPage]))
      .toEqual([[1, 1], [2, 2], [3, 3]]);
  });
  it("uses numeric PDF bookmarks including page zero", async () => {
    const pdf = { getOutline: async () => [{ title: "Foundations", dest: [0] }, { title: "Practice", dest: [1] }] } as unknown as PDFDocumentProxy;
    const sections = await documentSections(pdf, [{ page: 1, text: "Intro" }, { page: 2, text: "Exercises" }]);
    expect(sections.map((section) => section.title)).toEqual(["Foundations", "Practice"]);
    expect(sections.every((section) => section.source === "outline")).toBe(true);
  });
  it("uses observed chapter headings and keeps complete page coverage", () => {
    const pages = [
      { page: 1, text: "Preface\nThis work introduces optimization." },
      { page: 2, text: "Chapter 1 Introduction\nDefinitions and motivation." },
      { page: 3, text: "The first chapter continues." },
      { page: 4, text: "Chapter 2 Methods\nGradient descent updates parameters." },
      { page: 5, text: "This chapter gives the convergence conditions." },
    ];
    const sections = detectHeadingSections(pages);
    expect(sections).toHaveLength(3);
    expect(sections[0].source).toBe("inferred");
    expect(sections[1].title).toBe("Chapter 1 Introduction");
    expect(sections[2].title).toBe("Chapter 2 Methods");
    const chunks = partitionSectionPages(pages, sections);
    expect(chunks.map((chunk) => [chunk.startPage, chunk.endPage])).toEqual([[1, 1], [2, 3], [4, 5]]);
    expect(chunks.map((chunk) => chunk.section?.id)).toEqual(["section-1", "section-2", "section-3"]);
  });
});
