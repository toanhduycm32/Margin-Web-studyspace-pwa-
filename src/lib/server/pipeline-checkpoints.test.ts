import { afterEach, expect, it, vi } from "vitest";
import { processChunk, finalize, type ChunkInput } from "./pipeline";
import { getMap, saveMap, saveArtifact } from "./store";
import { verifyMap } from "./crypto";
import type { SignedMap } from "../shared/types";
import type { CheckpointValue } from "./generation-checkpoints";

const checkpointValues = vi.hoisted(() => new Map<string, CheckpointValue>());
vi.mock("./checkpoint-store", () => ({ driveCheckpointStore: (_principal: unknown, scope: string) => ({
  read: async (key: string) => checkpointValues.get(`${scope}:${key}`) || null,
  write: async (key: string, value: CheckpointValue) => { checkpointValues.set(`${scope}:${key}`, value); },
}) }));
vi.mock("./store", () => ({
  generationOperation: vi.fn(async () => ({ startedAt: "2026-11-27T01:00:00.000Z" })),
  getDocumentRecord: vi.fn(async () => ({})), checkedPdf: vi.fn(async () => ({ md5Checksum: "a".repeat(32) })),
  getMap: vi.fn(), saveMap: vi.fn(), saveArtifact: vi.fn(),
}));
vi.mock("./ai-admission", () => ({ withAiAdmission: async (_principal: unknown, fn: (reserve: () => Promise<void>) => unknown) => fn(async () => {}) }));
afterEach(() => { checkpointValues.clear(); vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("does not expose or finalize an unreviewed draft and resumes a rejected summary through a reviewed repair", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 7).toString("base64"));
  const maps = new Map<string, SignedMap>();
  vi.mocked(getMap).mockImplementation(async (_token, name) => maps.get(name) || null);
  vi.mocked(saveMap).mockImplementation(async (_token, name, map) => { maps.set(name, structuredClone(map)); });
  const digest = "Phương pháp được áp dụng khi có đồng thời điều kiện A và B. Ngoại lệ C cần được loại trừ trước khi áp dụng phương pháp trong tình huống đã nêu.";
  const fixed = digest + " Điều kiện D cũng phải được bảo đảm.";
  const completion = (value: unknown) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }] });
  const fetch = vi.fn().mockResolvedValueOnce(completion({ digest }))
    .mockResolvedValueOnce(completion({ checks: [{ unit: 1, references: ["E1"], issue: "Thiếu điều kiện D." }], omissions: [] }))
    .mockResolvedValueOnce(completion({ digest: fixed }))
    .mockResolvedValueOnce(completion({ checks: [{ unit: 1, references: ["E1"], issue: "" }], omissions: [] }));
  vi.stubGlobal("fetch", fetch);
  const principal = { sub: "alice", accessToken: "alice-token" };
  const input: ChunkInput = { kind: "summary", operationId: "12345678-1234-1234-1234-123456789abc",
    documentId: "file12345678", sourceMd5: "a".repeat(32), chunkIndex: 0, chunkCount: 1,
    startPage: 1, endPage: 1, pageCount: 1, requestedCount: 0, emptyPages: [],
    text: `Page 1\n${fixed}`,
    section: { id: "section-1", title: "Điều kiện áp dụng", startPage: 1, endPage: 1, source: "heading" },
    summaryProfile: "medical", wordTarget: 40 };
  for (let request = 1; request <= 3; request++) {
    const pending = await processChunk(principal, input);
    expect(pending).toMatchObject({ pending: true });
    expect("map" in pending).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(request);
    expect(saveMap).not.toHaveBeenCalled();
    expect(saveArtifact).not.toHaveBeenCalled();
  }
  const result = await processChunk(principal, input);
  if ("pending" in result) throw Error("Expected accepted map");
  expect(result.map.digest).toBe(fixed);
  expect(verifyMap(result.map, result.signature)).toBe(true);
  expect(await processChunk(principal, input)).toEqual(result);
  expect(fetch).toHaveBeenCalledTimes(4);
  await finalize(principal, { kind: "summary", operationId: input.operationId, documentId: input.documentId,
    sourceMd5: input.sourceMd5, requestedCount: 0, summaryProfile: "medical",
    maps: [JSON.parse(JSON.stringify(result))] });
  expect(saveArtifact).toHaveBeenCalledTimes(1);
  expect(vi.mocked(saveArtifact).mock.calls[0][1].payload).toMatchObject({ text: expect.stringContaining(fixed) });
});
