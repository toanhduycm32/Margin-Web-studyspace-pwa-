import { describe, expect, it } from "vitest";
import { normalizedAnswers, scoreQuiz, validateQuestionsV2 } from "./quiz";

const source = "Gradient descent updates parameters opposite the gradient to reduce a differentiable loss. A smaller learning rate may improve stability but can slow convergence. A high learning rate can overshoot a minimum.";
const item = (type: "single_best" | "select_all" | "select_n", keys: number[], count: number | null) => ({
  response_type: type, question_family: "mechanism", cognitive_demand: "understand", difficulty: "intermediate",
  question: "Which statements correctly describe gradient descent under these conditions?",
  options: ["The update moves opposite the gradient.", "A smaller learning rate can improve stability.",
    "A high learning rate always guarantees convergence.", "The update ignores the loss gradient."],
  correct_option_ids: keys, selection_count: count,
  explanation: "The update direction follows the negative gradient, while learning-rate size changes stability and speed.",
  option_explanations: ["The source explicitly states the update direction.", "The source states this stability tradeoff.",
    "Overshooting contradicts guaranteed convergence.", "The update uses the gradient explicitly."],
  source_excerpt: "A high learning rate can overshoot a minimum.",
});

describe("multiple-response assessment contract", () => {
  it("accepts exact answer sets and rejects selecting every option", () => {
    const question = validateQuestionsV2([item("select_all", [0, 1], null)], source,
      ["select_all"], ["mechanism"], 1, 1);
    expect(scoreQuiz(question, [[1, 0]])).toBe(1);
    expect(scoreQuiz(question, [[0, 1, 2, 3]])).toBe(0);
    expect(() => normalizedAnswers(question, [[0, 0]])).toThrow();
  });
  it("enforces select-N count and rejects incomplete answer keys", () => {
    const question = validateQuestionsV2([item("select_n", [0, 1], 2)], source,
      ["select_n"], ["mechanism"], 1, 1);
    expect(scoreQuiz(question, [[0, 1]])).toBe(1);
    expect(() => scoreQuiz(question, [[0]])).toThrow();
    expect(() => validateQuestionsV2([item("select_n", [0, 1], 3)], source,
      ["select_n"], ["mechanism"], 1, 1)).toThrow();
  });
  it("rejects unsupported evidence even when the answer key shape is valid", () => {
    expect(() => validateQuestionsV2([{ ...item("single_best", [0], null), source_excerpt: "invented proof" }], source,
      ["single_best"], ["mechanism"], 1, 1)).toThrow();
  });
  it("rejects invented clinical drugs and durations in distractors", () => {
    const dental = "Dental treatment is prioritized for adults with pulpitis. Antibiotics are not an adjunct when definitive dental treatment is available.";
    const raw = { ...item("single_best", [0], null), question_family: "management",
      question: "For adults with pulpitis, which action follows the dental source?",
      options: ["Prioritize definitive dental treatment.", "Give a 7-day course of amoxicillin.",
        "Delay all dental treatment indefinitely.", "Assume a diagnostic test is unnecessary."],
      option_explanations: ["The source prioritizes dental treatment.", "The source provides no drug regimen.",
        "The source does not support delay.", "The source does not address testing."],
      source_excerpt: "Dental treatment is prioritized" };
    expect(() => validateQuestionsV2([raw], dental, ["single_best"], ["management"], 1, 1))
      .toThrow(/invented a clinical drug/);
  });
});
