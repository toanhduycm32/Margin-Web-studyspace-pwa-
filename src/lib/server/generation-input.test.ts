import { expect, it } from "vitest";
import { attachSourceExcerpts, focusedQuestionSource, indexedEvidence, summaryPassages } from "./generation-input";
import type { LearningObjective } from "@/lib/shared/types";

it("splits long summaries on page boundaries without dropping or duplicating source characters", () => {
  const source = Array.from({ length: 5 }, (_, i) => `Page ${i + 4}\n${"Nội dung và điều kiện của nguồn. ".repeat(110)}\n`).join("");
  const parts = summaryPassages(source, 4, 8);
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.map((part) => part.text).join("")).toBe(source);
  expect(parts[0].start).toBe(4); expect(parts.at(-1)!.end).toBe(8);
  const dense = "Page 9\n" + "a".repeat(9000);
  expect(summaryPassages(dense, 9, 9)).toEqual([{ text: dense, start: 9, end: 9 }]);
});

it("copies evidence by real line ID and rejects invented or out-of-bounds IDs", () => {
  const source = "Men phủ ngoài thân răng.\nNgà nằm dưới men và bao quanh khoang tủy.";
  const indexed = indexedEvidence(source);
  expect(attachSourceExcerpts([{ evidence_id: "E2", source_excerpt: "Invented quote" }], indexed.passages))
    .toEqual([{ evidence_id: "E2", source_excerpt: source.split("\n")[1] }]);
  expect(() => attachSourceExcerpts([{ evidence_id: "E1-E99" }], indexed.passages)).toThrow("existing evidence_id");
});

it("keeps complete neighbouring lines around objectives and falls back to full context for a missing anchor", () => {
  const source = `${"Đầu nguồn.\n".repeat(600)}Mốc kiến thức của bài.\n${"Cuối nguồn.\n".repeat(600)}`;
  const objective = { sourceExcerpt: "Mốc kiến thức của bài." } as LearningObjective;
  const focused = focusedQuestionSource(source, [objective]);
  expect(focused).toContain(objective.sourceExcerpt);
  expect(focused.length).toBeLessThan(source.length);
  expect(focusedQuestionSource(source, [{ ...objective, sourceExcerpt: "Không có" }])).toBe(source);
});
