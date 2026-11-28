import { afterEach, expect, it, vi } from "vitest";
import { generateSectionQuestions, sectionItems, sectionReview } from "./section-assessment";
import { sectionQuestionFormats } from "../shared/learning-workload";
import { scoreQuiz } from "../shared/quiz";
import { withGenerationCheckpoints, GenerationContinuation, type CheckpointValue } from "./generation-checkpoints";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const source = "Men phủ thân răng, ngà nằm trong men và bao quanh khoang tủy. Tủy chứa mạch máu và thần kinh.";
const item = { question: "Những mô và vị trí nào phù hợp với cấu tạo răng trong nguồn?",
  options: [{ text: "Men phủ thân răng.", why: "Nguồn xác định men là lớp phủ ngoài thân răng." },
    { text: "Ngà bao quanh khoang tủy.", why: "Nguồn mô tả ngà nằm quanh khoang tủy răng." },
    { text: "Tủy phủ ngoài men răng.", why: "Tủy nằm trong khoang tủy, không phủ ngoài men răng." },
    { text: "Men chỉ nằm trong khoang tủy.", why: "Men phủ ngoài thân răng, không nằm trong khoang tủy." }],
  correct: [0, 1], explanation: "Cần phân biệt lớp men phủ thân răng với ngà nằm quanh khoang tủy, tránh đảo vị trí các mô.",
  evidence: "E1", family: "anatomical_relation", demand: "understand" };
const second = { ...item, question: "Những nhận xét nào giữ đúng quan hệ giữa men, ngà và khoang tủy?" };
const completion = (value: unknown) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }] });

it("allocates every substantive section without objective inference and preserves a multiple-correct majority", () => {
  for (const length of [100, 3000, 8000, 18000, 45000]) {
    const formats = sectionQuestionFormats("a".repeat(length));
    expect(formats.length).toBeLessThanOrEqual(4);
    expect(formats.filter((format) => format !== "single_best").length).toBeGreaterThan(formats.length / 2);
  }
  expect(sectionQuestionFormats(source, true)).toEqual([]);
  expect(sectionQuestionFormats("Page 1\n[No extractable text]")).toEqual([]);
});

it("attaches exact source and deterministic response metadata without changing answer indices", () => {
  const checked = sectionItems([item, second], source, ["select_all", "select_n"], 1, 2);
  expect(checked[0].sourceExcerpt).toBe(source);
  expect(checked[1].selectionCount).toBe(2);
  expect(scoreQuiz(checked, [[0, 1], [1, 0]])).toBe(2);
  expect(scoreQuiz(checked, [[0, 1, 2, 3], [0, 2]])).toBe(0);
  expect(() => sectionItems([{ ...item, correct: [0, 9] }], source, ["select_all"], 1, 2)).toThrow();
  expect(() => sectionItems([{ ...item, evidence: "E99" }], source, ["select_all"], 1, 2)).toThrow();
  const booleanItem = { ...item, correct: undefined,
    options: item.options.map((option, index) => ({ ...option, correct: index < 2 })) };
  expect(sectionItems([booleanItem], source, ["select_n"], 1, 2)[0].correctOptionIds).toEqual([0, 1]);
  expect(sectionItems([{ ...booleanItem, evidence: "E1; E1-E1" }], source, ["select_all"], 1, 2)[0].sourceExcerpt).toBe(source);
  expect(() => sectionItems([{ ...booleanItem, evidence: "E1; E999" }], source, ["select_all"], 1, 2)).toThrow();
  expect(() => sectionReview({ items: [{ index: 1, correct: [0, 1], issues: [] }] }, checked)).toThrow();
  expect(sectionReview({ items: [{ index: 1, correct: [0, 2], issues: [] },
    { index: 2, correct: [0, 1], issues: [] }] }, checked).issues[0].index).toBe(1);
});

it("resumes a draft without regeneration and selectively repairs only the rejected item before acceptance", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const fetch = vi.fn().mockResolvedValueOnce(completion({ questions: [item, second] }))
    .mockResolvedValueOnce(completion({ items: [{ index: 1, correct: [0, 1], issues: [] },
      { index: 2, correct: [0, 1], issues: ["Câu này lặp quan hệ cần kiểm tra."] }] }))
    .mockResolvedValueOnce(completion({ questions: [{ ...second, question: "Những nhận xét nào về vị trí khoang tủy phù hợp với đoạn nguồn?" }] }))
    .mockResolvedValueOnce(completion({ items: [{ index: 1, correct: [0, 1], issues: [] }, { index: 2, correct: [0, 1], issues: [] }] }));
  vi.stubGlobal("fetch", fetch);
  const values = new Map<string, CheckpointValue>();
  const store = { read: async (key: string) => values.get(key) || null,
    write: async (key: string, value: CheckpointValue) => { values.set(key, value); } };
  const run = () => withGenerationCheckpoints(store, () => generateSectionQuestions(source,
    ["select_all", "select_n"], 1, 1, "Cấu tạo răng", async () => {}));
  for (let calls = 1; calls <= 3; calls++) {
    await expect(run()).rejects.toBeInstanceOf(GenerationContinuation);
    expect(fetch).toHaveBeenCalledTimes(calls);
  }
  const accepted = await run();
  expect(accepted[0]).toEqual(sectionItems([item], source, ["select_all"], 1, 1)[0]);
  expect(accepted[1].question).toContain("vị trí khoang tủy");
  expect(await run()).toEqual(accepted);
  expect(fetch).toHaveBeenCalledTimes(4);
  const repair = JSON.parse(fetch.mock.calls[2][1].body).messages[1].content;
  expect(repair).toContain("đúng 1 câu");
  expect(repair).not.toContain("đúng 2 câu");
});

it("does not turn a quota or provider failure into automatic retry", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const fetch = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
  vi.stubGlobal("fetch", fetch);
  await expect(generateSectionQuestions(source, ["select_all", "select_all"], 1, 1, "Răng", async () => {}))
    .rejects.toMatchObject({ status: 429 });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("repairs a malformed saved review without redrafting and exits an invalid selective repair", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const request = vi.fn().mockResolvedValueOnce(completion({ questions: [item, second] }))
    .mockResolvedValueOnce(completion({ items: [] }))
    .mockResolvedValueOnce(completion({ items: [{ index: 1, correct: [0, 1], issues: [] },
      { index: 2, correct: [0, 1], issues: ["Lặp câu."] }] }))
    .mockResolvedValueOnce(completion({ questions: [] }));
  vi.stubGlobal("fetch", request);
  const values = new Map<string, CheckpointValue>();
  const store = { read: async (key: string) => values.get(key) || null,
    write: async (key: string, value: CheckpointValue) => { values.set(key, value); } };
  const run = () => withGenerationCheckpoints(store, () => generateSectionQuestions(source,
    ["select_all", "select_n"], 1, 1, "Cấu tạo răng", async () => {}));
  for (let calls = 1; calls <= 3; calls++) {
    await expect(run()).rejects.toBeInstanceOf(GenerationContinuation);
    expect(request).toHaveBeenCalledTimes(calls);
  }
  await expect(run()).rejects.toMatchObject({ status: 422, code: "RESTART_GENERATION" });
  expect(request).toHaveBeenCalledTimes(4);
  expect(JSON.parse(request.mock.calls[2][1].body).messages[1].content).toContain("không tạo lại câu hỏi");
});
