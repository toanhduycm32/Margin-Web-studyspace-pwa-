import { afterEach, expect, it, vi } from "vitest";
import { renderSummarySelection, selectedSourceText, summarySourceLines } from "./summary-selection";
import { summarizeChunk } from "./nvidia";
const source = "Page 1\nChức năng của tủy\nChức năng dinh dư ỡng: chứa HTMM nuôi dưỡng toàn bộ các thành phần sống\ncủa phức hợp ngà-tủy.\nĐiều kiện áp dụng\nPhương pháp được áp dụng khi đồng thời có A và B; C là ngoại lệ.\nNgưỡng trong nguồn:\n30\nđơn vị.";
const selection = { blocks: [{ heading: 1, title: "Chức năng của tủy", passages: [{ from: 2, to: 3,
  text: "Chức năng dinh dưỡng: chứa HTMM nuôi dưỡng toàn bộ các thành phần sống của phức hợp ngà-tủy." }] },
{ heading: 4, title: "Điều kiện áp dụng", passages: [{ from: 5, to: 5,
  text: "Phương pháp được áp dụng khi đồng thời có A và B; C là ngoại lệ." }] }] };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("takes content from valid source ranges and permits only cosmetic spacing changes", () => {
  const result = renderSummarySelection(selection, source);
  expect(result).toContain("dinh dưỡng");
  expect(result).toContain("A và B; C là ngoại lệ");
  expect(summarySourceLines(source)).toContain("30");
  const wrong = structuredClone(selection);
  wrong.blocks[0].passages[0].text = "Tủy chứa hydroxyapatite và các thành phần sống để nuôi dưỡng.";
  expect(renderSummarySelection(wrong, source)).not.toContain("hydroxyapatite");
  expect(renderSummarySelection(wrong, source)).toContain("chứa HTMM nuôi dưỡng");
  expect(selectedSourceText("Không khí ép lên tủy răng hoặc ở những chất hàn tủy không kín hết.",
    "Không khí hoặc chất hàn tủy không kín ép lên tủy răng.")).toContain("hoặc ở những");
  expect(selectedSourceText("Co", "CO")).toBe("Co");
  expect(selectedSourceText("+H", "H")).toBe("+H");
  expect(selectedSourceText("Ngưỡng\n30\nđơn vị", "Ngưỡng đơn vị")).toBe("Ngưỡng\n30\nđơn vị");
  expect(selectedSourceText("Các giá trị 1 0", "Các giá trị 10")).toBe("Các giá trị 1 0");
});

it("rejects impossible, overlapping, unordered and falsely headed ranges", () => {
  for (const passage of [{ from: 2, to: 999 }, { from: 0, to: 3 }, { from: 3, to: 2 }, { from: "2", to: 3 }]) {
    expect(() => renderSummarySelection({ blocks: [{ heading: 1, title: "", passages: [passage] }] }, source)).toThrow();
  }
  expect(() => renderSummarySelection({ blocks: [...selection.blocks, selection.blocks[0]] }, source)).toThrow();
  expect(() => renderSummarySelection({ blocks: [{ ...selection.blocks[0], heading: 8 }] }, source)).toThrow();
});

it("reviews the rendered original span, not a model's changed wording", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  vi.stubEnv("NVIDIA_MODEL", "minimaxai/minimax-m3.1-flash");
  const changed = structuredClone(selection);
  changed.blocks[0].passages[0].text = "Tủy chứa hydroxyapatite để nuôi dưỡng.";
  const completed = (value: unknown) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }] });
  const request = vi.fn().mockResolvedValueOnce(completed(changed)).mockResolvedValueOnce(completed({ checks:
    [1, 2, 3, 4].map((unit) => ({ unit, references: ["E2"], issue: "" })), omissions: [] }));
  vi.stubGlobal("fetch", request);
  const result = await summarizeChunk(source, 1, 1, "medical", "Tủy", "heading", 100, async () => {});
  expect(result).toContain("HTMM nuôi dưỡng");
  expect(result).not.toContain("hydroxyapatite");
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls.map((call) => JSON.parse(call[1].body).model)).toEqual([
    "minimaxai/minimax-m3.1-flash", "minimaxai/minimax-m3.1-flash",
  ]);
  expect(JSON.parse(request.mock.calls[1][1].body).messages[1].content).not.toContain("hydroxyapatite");
});
