import { describe, expect, it } from "vitest";
import { scoreQuiz, selectCoveredQuestions, validateQuestions } from "./quiz";
import type { MapRecord } from "./types";

const source = "Learning requires spaced practice and timely feedback about mistakes.";
const question = (index: number) => ({ question: `What does this passage say about learning concept ${index}?`,
  options: ["Spaced practice", "No practice", "Random guessing", "No feedback"], answer: 0,
  explanation: "The passage directly names spaced practice as useful.", source_excerpt: "spaced practice" });

describe("source-backed quiz", () => {
  it("validates options, answer and an exact source excerpt", () => {
    expect(validateQuestions([question(1)], source, 1, 1, 2)[0].startPage).toBe(1);
    expect(() => validateQuestions([{ ...question(1), source_excerpt: "invented passage" }], source, 1, 1, 2)).toThrow();
  });
  it("chooses questions across the document and scores deterministically", () => {
    const maps = Array.from({ length: 8 }, (_, index) => ({ chunkIndex: index,
      questions: validateQuestions([question(index)], source, 1, index + 1, index + 1) })) as MapRecord[];
    const chosen = selectCoveredQuestions(maps, 4);
    expect(chosen).toHaveLength(4);
    expect(chosen[0].startPage).toBeLessThan(chosen.at(-1)!.startPage);
    expect(scoreQuiz(chosen, [0, 0, 1, 0])).toBe(3);
    expect(() => scoreQuiz(chosen, [0])).toThrow();
  });
});
