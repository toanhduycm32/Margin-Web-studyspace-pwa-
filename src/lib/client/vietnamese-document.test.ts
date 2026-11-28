import { describe, expect, it } from "vitest";
import { extractPageText } from "./extract";
import { detectHeadingSections, sectionLearningText } from "./structure";

describe("Vietnamese textbook extraction", () => {
  it("joins contiguous accented font runs while preserving real word spaces", () => {
    const item = (str: string, x: number, width: number, hasEOL = false) => ({ str, width, hasEOL,
      transform: [12, 0, 0, 12, x, 100], height: 12, dir: "ltr", fontName: "test" });
    const items = [item("B", 0, 7), item("ệ", 7, 6), item("nh", 13, 12),
      item(" ", 25, 3), item("lý t", 28, 20), item("ủ", 48, 6), item("y răng", 54, 30, true)];
    expect(extractPageText(items)).toBe("Bệnh lý tủy răng");
    expect(extractPageText([item("Men", 0, 18), item("răng", 22, 20, true)])).toBe("Men răng");
  });
  it("ignores the TOC and joins chapter numbers to titles without promoting subsections", () => {
    const pages = ["MỤC LỤC\nBÀI 1: RĂNG ........ 1\nBÀI 2: VIÊM LỢI ...... 5",
      "1\nBÀI 1\nRĂNG VÀ BỘ RĂNG\nSau khi học xong sinh viên có khả năng:\n1. Cấu tạo răng",
      "2\n1.1 Men răng\nMen phủ thân răng.\nTỰ LƯỢNG GIÁ\nCâu 1. Bài thi cũ",
      "TÀI LIỆU THAM KHẢO\nSách và tài liệu khác",
      "5\nBÀI 2\nVIÊM LỢI\n1. Nguyên nhân"].map((text, index) => ({ page: index + 1, text }));
    const sections = detectHeadingSections(pages);
    expect(sections.map((section) => [section.startPage, section.endPage])).toEqual([[1, 1], [2, 4], [5, 5]]);
    expect(sections[1].title).toBe("BÀI 1: RĂNG VÀ BỘ RĂNG");
    const teaching = sectionLearningText(pages, sections);
    expect(teaching[0].text).toBe("");
    expect(teaching[2].text).toContain("Men phủ thân răng.");
    expect(teaching[2].text).not.toContain("Bài thi cũ");
    expect(teaching[3].text).toBe("");
    expect(teaching[4].text).toContain("Nguyên nhân");
  });
});
