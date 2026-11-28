import { afterEach, expect, it, vi } from "vitest";
import { sourcePreservingIssue, summaryReviewUnits, validateSummaryReview } from "./summary-review";
import { summarizeChunk } from "./nvidia";
import { GenerationContinuation, withGenerationCheckpoints, type CheckpointValue } from "./generation-checkpoints";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const source = "Tủy chứa HTMM nuôi dưỡng các thành phần sống của phức hợp ngà–tủy.\nLấy tủy một phần thường chỉ định với răng chưa đóng kín chóp.";
const digest = "### Tủy\n\nTủy chứa HTMM nuôi dưỡng các thành phần sống của phức hợp ngà–tủy.\n\nLấy tủy một phần thường chỉ định với răng chưa đóng kín chóp.";
const checks = [1, 2, 3].map((unit) => ({ unit, references: [unit === 3 ? "E2" : "E1"], issue: "" }));
const completion = (value: unknown) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }] });

it("reviews complete wrapped passages without losing clinical conditions or numeric boundaries", () => {
  const wrapped = "### Điều trị\nLấy tủy một phần:\nthường chỉ định với răng chưa đóng kín chóp.\n\nNgưỡng nguồn là\n30\nđơn vị.\n### Theo dõi\nGiữ điều kiện của nguồn.";
  expect(summaryReviewUnits(wrapped)).toEqual([
    "### Điều trị", "Lấy tủy một phần:\nthường chỉ định với răng chưa đóng kín chóp.",
    "Ngưỡng nguồn là\n30\nđơn vị.", "### Theo dõi", "Giữ điều kiện của nguồn.",
  ]);
  expect(sourcePreservingIssue("Ngưỡng trong nguồn là 3 0 đơn vị.", "Ngưỡng trong nguồn là 30 đơn vị.")).not.toBeNull();
});

it("refuses a global pass, missing/reordered line decisions and nonexistent or empty support", () => {
  for (const value of [
    { valid: true, issues: [] }, { checks: checks.slice(1), omissions: [] },
    { checks: [checks[1], checks[0], checks[2]], omissions: [] },
    { checks: checks.map((item) => ({ ...item, references: ["E99"] })), omissions: [] },
    { checks: checks.map((item) => ({ ...item, references: ["X1"] })), omissions: [] },
    { checks: checks.map((item) => ({ ...item, references: [] })), omissions: [] },
  ]) expect(() => validateSummaryReview(value, source, digest)).toThrow();
  expect(validateSummaryReview({ checks, omissions: [] }, source, digest).valid).toBe(true);
  expect(validateSummaryReview({ checks: checks.map((item) => item.unit === 2 ?
    { ...item, issue: "Đổi đối tượng được nuôi dưỡng thành thứ chứa trong tủy." } : item), omissions: [] }, source, digest))
    .toMatchObject({ valid: false, issues: [expect.stringContaining("U2")] });
});

it("rejects invented terms, removed prepositions and changed causal subjects before model review", () => {
  const text = source + "\nKhông khí còn sót lại dưới đáy chất hàn ép lên tủy răng hoặc ở những chất hàn tủy không kín hết.\nNgưỡng trong nguồn là\n30\nđơn vị, không áp dụng cho nhóm B.";
  for (const changed of [
    "Tủy chứa hydroxyapatite nuôi dưỡng các thành phần sống của phức hợp ngà–tủy.",
    "Tủy chứa các thành phần sống của phức hợp ngà–tủy để nuôi dưỡng.",
    "Không khí còn sót lại dưới đáy chất hàn hoặc chất hàn tủy không kín ép lên tủy răng.",
    "Ngưỡng trong nguồn là đơn vị, không áp dụng cho nhóm B.",
  ]) expect(sourcePreservingIssue(text, changed)).not.toBeNull();
  expect(sourcePreservingIssue(text.replace("nuôi dưỡng", "nuôi dư ỡng"), digest)).toBeNull();
  expect(sourcePreservingIssue(text, "### Tủy\n- **Lấy tủy một phần thường chỉ định với răng chưa đóng kín chóp.**")).toBeNull();
});

it("accepts all real source anchors for a long passage without hiding material omissions", () => {
  const lines = Array.from({ length: 21 }, (_, index) => `Dòng nguồn ${index + 1}.`);
  const references = lines.map((_, index) => `E${index + 1}`);
  const review = { checks: [{ unit: 1, references, issue: "" }], omissions: ["Thiếu phân loại chóp đã nêu trong tiêu đề."] };
  expect(validateSummaryReview(review, lines.join("\n"), lines.join(" ")))
    .toMatchObject({ valid: false, issues: review.omissions });
  expect(validateSummaryReview({ ...review, omissions: [] }, lines.join("\n"), lines.join(" ")).valid).toBe(true);
  for (const invalid of [[...references, "E22"], ["E1", "E1"], ["E99"]]) {
    expect(() => validateSummaryReview({ ...review, checks: [{ unit: 1, references: invalid, issue: "" }] },
      lines.join("\n"), lines.join(" "))).toThrow();
  }
});

it("repairs an incomplete reviewer decision across checkpoints without regenerating the candidate", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const request = vi.fn().mockResolvedValueOnce(completion({ digest }))
    .mockResolvedValueOnce(completion({ checks: checks.slice(0, 2), omissions: [] }))
    .mockResolvedValueOnce(completion({ checks, omissions: [] }));
  vi.stubGlobal("fetch", request);
  const values = new Map<string, CheckpointValue>();
  const store = { read: async (key: string) => values.get(key) || null,
    write: async (key: string, value: CheckpointValue) => { values.set(key, value); } };
  const run = () => withGenerationCheckpoints(store, () => summarizeChunk(source, 1, 1,
    "medical", "Tủy", "heading", 100, async () => {}));
  await expect(run()).rejects.toBeInstanceOf(GenerationContinuation);
  await expect(run()).rejects.toBeInstanceOf(GenerationContinuation);
  expect(await run()).toBe(digest);
  expect(await run()).toBe(digest);
  expect(request).toHaveBeenCalledTimes(3);
  expect(JSON.parse(request.mock.calls[2][1].body).messages[1].content).toContain("Kết quả kiểm tra trước sai cấu trúc");
});

it("never sends a lexically changed Vietnamese candidate to semantic acceptance", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const request = vi.fn().mockResolvedValueOnce(completion({ digest: digest.replace("HTMM", "hydroxyapatite") }))
    .mockResolvedValueOnce(completion({ digest }))
    .mockResolvedValueOnce(completion({ checks, omissions: [] }));
  vi.stubGlobal("fetch", request);
  expect(await summarizeChunk(source, 1, 1, "medical", "Tủy", "heading", 100, async () => {})).toBe(digest);
  expect(request).toHaveBeenCalledTimes(3);
  expect(JSON.parse(request.mock.calls[1][1].body).messages[1].content).toContain("vi phạm giữ nguyên nguồn");
});

it("stops after two malformed reviews instead of paying for another draft or accepting it", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const request = vi.fn().mockResolvedValueOnce(completion({ digest }))
    .mockImplementation(async () => completion({ valid: true, issues: [] }));
  vi.stubGlobal("fetch", request);
  await expect(summarizeChunk(source, 1, 1, "medical", "Tủy", "heading", 100, async () => {}))
    .rejects.toMatchObject({ status: 422, code: "RESTART_GENERATION" });
  expect(request).toHaveBeenCalledTimes(3);
});
