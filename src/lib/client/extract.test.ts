import { describe, expect, it } from "vitest";
import { extractPageText, MAX_CHUNK_CHARACTERS, MAX_CHUNKS, partitionPages } from "./extract";

describe("whole-PDF extraction partition", () => {
  it("covers every page in order without truncating", () => {
    const pages = Array.from({ length: 6 }, (_, index) => ({ page: index + 1, text: `Topic ${index + 1} `.repeat(3000) }));
    const chunks = partitionPages(pages);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].startPage).toBe(1);
    expect(chunks.at(-1)?.endPage).toBe(6);
    for (let index = 1; index < chunks.length; index++) expect(chunks[index].startPage).toBe(chunks[index - 1].endPage + 1);
    for (let page = 1; page <= 6; page++) expect(chunks.some((chunk) => chunk.text.includes(`Topic ${page}`))).toBe(true);
  });
  it("records pages without readable text", () => {
    const chunks = partitionPages([{ page: 1, text: "Introductory material with enough readable words." }, { page: 2, text: "" }]);
    expect(chunks.flatMap((chunk) => chunk.emptyPages)).toEqual([2]);
  });
  it("does not mistake short readable pages for image-only pages", () => {
    const chunks = partitionPages([{ page: 1, text: "A short theorem." }]);
    expect(chunks[0].emptyPages).toEqual([]);
  });
  it("rejects a missing page instead of claiming full coverage", () => {
    expect(() => partitionPages([{ page: 1, text: "A" }, { page: 3, text: "B" }])).toThrow("incomplete");
  });
  it("preserves PDF line endings and paragraph structure for study prompts", () => {
    const text = extractPageText([
      { str: "Chapter 1", hasEOL: true },
      { str: "A definition", hasEOL: true },
      { str: "An example", hasEOL: false },
    ] as Parameters<typeof extractPageText>[0]);
    expect(partitionPages([{ page: 1, text }])[0].text).toContain("Chapter 1\nA definition\nAn example");
  });
  it("stops when the full PDF would exceed processing capacity", () => {
    const pageText = "x".repeat(MAX_CHUNK_CHARACTERS - 8);
    const pages = Array.from({ length: MAX_CHUNKS + 1 }, (_, index) => ({ page: index + 1, text: pageText }));
    expect(() => partitionPages(pages)).toThrow("whole-document processing capacity");
  });
});
