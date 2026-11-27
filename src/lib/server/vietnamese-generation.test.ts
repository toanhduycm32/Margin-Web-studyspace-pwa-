import { afterEach, expect, it, vi } from "vitest";
import { planLearning, summarizeChunk } from "./nvidia";
const completion = (value: unknown) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }] });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("resolves objective evidence IDs to unchanged source text and rejects invented IDs", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const source = "Page 1\nMen phủ ngoài thân răng.\nNgà nằm dưới men và bao quanh khoang tủy.";
  const objective = { concept: "Cấu tạo răng", objective: "Phân biệt vị trí của men và ngà răng", family: "anatomical_relation", evidenceId: "E999" };
  const request = vi.fn().mockResolvedValueOnce(completion({ objectives: [objective], limitations: [] }))
    .mockResolvedValueOnce(completion({ objectives: [{ ...objective, evidenceId: "E2" }], limitations: [] }));
  vi.stubGlobal("fetch", request);
  const plan = await planLearning(source, "Cấu tạo răng", "s1", async () => {});
  expect(plan.objectives[0].sourceExcerpt).toBe("Ngà nằm dưới men và bao quanh khoang tủy.");
  expect(plan.objectives[0].id).toBe("s1-1");
  expect(request).toHaveBeenCalledTimes(2);
});

it("repairs a summary rejected for omitting a material condition before accepting it", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const digest = "Phương pháp được áp dụng khi có đồng thời điều kiện A và B. Ngoại lệ C cần được loại trừ trước khi áp dụng phương pháp trong tình huống đã nêu.";
  const request = vi.fn().mockResolvedValueOnce(completion({ digest }))
    .mockResolvedValueOnce(completion({ valid: false, issues: ["Thiếu điều kiện D của nguồn."] }))
    .mockResolvedValueOnce(completion({ digest: digest + " Điều kiện D cũng cần được bảo đảm." }))
    .mockResolvedValueOnce(completion({ valid: true, issues: [] }));
  vi.stubGlobal("fetch", request);
  const result = await summarizeChunk("Điều kiện A, B và D cần đồng thời có; C là ngoại lệ.", 1, 1, "medical", "Điều kiện áp dụng", "heading", 40, async () => {});
  expect(result).toContain("Điều kiện D");
  expect(request).toHaveBeenCalledTimes(4);
  expect(JSON.parse(String(request.mock.calls[2][1].body)).messages[1].content).toContain("Thiếu điều kiện D");
});

it("accepts a real evidence range but rejects a range with an invented endpoint", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const source = "Men phủ ngoài thân răng.\nNgà nằm dưới men và bao quanh khoang tủy.";
  const objective = { concept: "Cấu tạo răng", objective: "Phân biệt vị trí của men và ngà răng", family: "anatomical_relation", evidenceId: "E1-E999" };
  const request = vi.fn().mockResolvedValueOnce(completion({ objectives: [objective], limitations: [] }))
    .mockResolvedValueOnce(completion({ objectives: [{ ...objective, evidenceId: "E1-E2" }], limitations: [] }));
  vi.stubGlobal("fetch", request);
  const plan = await planLearning(source, "Cấu tạo răng", "s1", async () => {});
  expect(plan.objectives[0].sourceExcerpt).toBe("Men phủ ngoài thân răng.");
  expect(request).toHaveBeenCalledTimes(2);
});

it("does not accept a near-transcription just because it is valid Vietnamese JSON", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const digest = "### Điều kiện áp dụng\nPhương pháp được áp dụng khi có đồng thời điều kiện A và B. Ngoại lệ C cần được loại trừ trước khi áp dụng trong tình huống đã nêu.";
  const request = vi.fn().mockResolvedValueOnce(completion({ digest: digest.repeat(10) }))
    .mockResolvedValueOnce(completion({ digest }))
    .mockResolvedValueOnce(completion({ valid: true, issues: [] }));
  vi.stubGlobal("fetch", request);
  const result = await summarizeChunk("Điều kiện A và B cần đồng thời có; C là ngoại lệ.", 1, 1, "medical", "Điều kiện", "heading", 40, async () => {});
  expect(result).toBe(digest);
  expect(request).toHaveBeenCalledTimes(3);
  expect(JSON.parse(String(request.mock.calls[1][1].body)).messages[1].content).toContain("Viết lại cô đọng");
});
