import { describe, expect, it } from "vitest";
import { newOptionOrders } from "./attempt-order";
import { scoreQuiz } from "./quiz";
import type { LegacyQuizQuestion } from "./types";

describe("attempt option order", () => {
  it("changes display positions while retaining stable scoring IDs", () => {
    const question: LegacyQuizQuestion = { question: "Which option is correct?", options: ["A", "B", "C", "D"],
      answer: 2, explanation: "C is correct.", sourceExcerpt: "source", startPage: 1, endPage: 1 };
    const order = newOptionOrders([question])[0];
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
    expect(newOptionOrders([question], [order])[0]).not.toEqual(order);
    expect(scoreQuiz([question], [[order[order.indexOf(2)]]])).toBe(1);
  });
  it("preserves legacy letter-linked options instead of changing their meaning", () => {
    const question: LegacyQuizQuestion = { question: "Các lựa chọn nào đúng?", options: ["Ý thứ nhất", "Ý thứ hai", "A và B", "Không đúng"],
      answer: 2, explanation: "Liên kết với nhãn gốc.", sourceExcerpt: "source", startPage: 1, endPage: 1 };
    expect(newOptionOrders([question], [[0, 1, 2, 3]])[0]).toEqual([0, 1, 2, 3]);
  });
});
