import { afterEach, expect, it, vi } from "vitest";
import { planLearning, summarizeChunk } from "./nvidia";
import { summaryReviewUnits, summaryWithoutPageLabels } from "./summary-review";
const completion = (value: unknown) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }] });
const reviewed = (digest: string, omissions: string[] = []) => ({
  checks: summaryReviewUnits(digest).map((_, index) => ({ unit: index + 1, references: ["E1"], issue: "" })), omissions,
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("removes model-written page labels without removing clinical numbers or chemical notation", () => {
  expect(summaryWithoutPageLabels("### Điều trị\nCa(OH)2 được nêu trong nguồn (PDF tr. 162). Đau kéo dài 5–10 phút (PDF tr 163–164)."))
    .toBe("### Điều trị\nCa(OH)2 được nêu trong nguồn. Đau kéo dài 5–10 phút.");
});

it("keeps a valid draft when the reviewer is rate-limited instead of generating it again", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const digest = "Phương pháp được áp dụng khi có đồng thời điều kiện A và B. Ngoại lệ C cần được loại trừ trước khi áp dụng trong tình huống đã nêu.";
  const request = vi.fn().mockResolvedValueOnce(completion({ digest }))
    .mockResolvedValueOnce(new Response("", { status: 429 }));
  vi.stubGlobal("fetch", request);
  await expect(summarizeChunk(digest, 1, 1,
    "medical", "Điều kiện", "heading", 40, async () => {})).rejects.toMatchObject({ status: 429 });
  expect(request).toHaveBeenCalledTimes(2);
});

it("accepts a source-reviewed Vietnamese summary above a soft target without a length-only rewrite", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const digest = "### Điều kiện áp dụng\nPhương pháp cần đồng thời có điều kiện A và B, đồng thời loại trừ ngoại lệ C. Đối với nhóm có yếu tố D, nguồn yêu cầu đánh giá riêng trước khi lựa chọn biện pháp. Vì vậy, việc chỉ nhận biết tên bệnh chưa đủ để suy ra chỉ định cho mọi trường hợp. Các điều kiện phải được xem xét cùng nhau để tránh áp dụng sai phạm vi của nguyên tắc trong tài liệu.";
  const request = vi.fn().mockResolvedValueOnce(completion({ digest }))
    .mockResolvedValueOnce(completion(reviewed(digest)));
  vi.stubGlobal("fetch", request);
  expect(await summarizeChunk(digest, 1, 1, "medical", "Điều kiện", "heading", 20, async () => {})).toBe(digest);
  expect(request).toHaveBeenCalledTimes(2);
});

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
    .mockResolvedValueOnce(completion(reviewed(digest, ["Thiếu điều kiện D của nguồn."])))
    .mockResolvedValueOnce(completion({ digest: digest + " Điều kiện D cũng cần được bảo đảm." }))
    .mockResolvedValueOnce(completion(reviewed(digest + " Điều kiện D cũng cần được bảo đảm.")));
  vi.stubGlobal("fetch", request);
  const result = await summarizeChunk(digest + " Điều kiện D cũng cần được bảo đảm.", 1, 1, "medical", "Điều kiện áp dụng", "heading", 40, async () => {});
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

it("rejects actual repeated paragraphs rather than treating length alone as failed quality", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const digest = "### Điều kiện áp dụng\nPhương pháp được áp dụng khi có đồng thời điều kiện A và B. Ngoại lệ C cần được loại trừ trước khi áp dụng trong tình huống đã nêu.";
  const request = vi.fn().mockResolvedValueOnce(completion({ digest: digest.repeat(10) }))
    .mockResolvedValueOnce(completion({ digest }))
    .mockResolvedValueOnce(completion(reviewed(digest)));
  vi.stubGlobal("fetch", request);
  const result = await summarizeChunk(digest, 1, 1, "medical", "Điều kiện", "heading", 40, async () => {});
  expect(result).toBe(digest);
  expect(request).toHaveBeenCalledTimes(3);
  expect(JSON.parse(String(request.mock.calls[1][1].body)).messages[1].content).toContain("Viết lại cô đọng");
});
