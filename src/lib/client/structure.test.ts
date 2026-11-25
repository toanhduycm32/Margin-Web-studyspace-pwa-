import { describe, expect, it } from "vitest";
import { detectHeadingSections } from "./structure";
import { partitionSectionPages } from "./extract";

describe("source structure and processing segments", () => {
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
