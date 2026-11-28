import type { ResponseType } from "./types";

// Allocation is a resource decision, not a claim to enumerate every objective.
// Every substantive transport segment receives a small, mixed study group.
export function sectionQuestionFormats(text: string, excluded = false): ResponseType[] {
  const plain = text.replace(/^Page \d+\n/gm, "").replace(/\[No extractable text\]/g, "").trim();
  if (excluded || plain.length < 80) return [];
  const count = Math.max(2, Math.min(4, Math.ceil(plain.length / 2500)));
  return Array.from({ length: count }, (_, index) => count >= 3 && index === count - 1
    ? "single_best" : index === 1 ? "select_n" : "select_all");
}
