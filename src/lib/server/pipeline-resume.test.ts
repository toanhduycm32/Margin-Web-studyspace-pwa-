import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuizQuestionV2, SignedMap } from "@/lib/shared/types";
import { signMap, verifyMap } from "./crypto";
import { processChunk, type ChunkInput } from "./pipeline";
import { getMap, saveMap } from "./store";
import { generateChunkQuestions } from "./nvidia";
import { retrieveEvidence } from "./evidence";

vi.mock("./store", () => ({
  getDocumentRecord: vi.fn(async () => ({})), checkedPdf: vi.fn(async () => ({ md5Checksum: "a".repeat(32) })),
  getMap: vi.fn(), saveMap: vi.fn(), saveArtifact: vi.fn(),
}));
vi.mock("./ai-admission", () => ({ withAiAdmission: async (_principal: unknown, fn: (reserve: () => Promise<void>) => unknown) => fn(async () => {}) }));
vi.mock("./nvidia", () => ({ generateChunkQuestions: vi.fn(), summarizeChunk: vi.fn(), modelName: () => "test-model" }));
vi.mock("./evidence", () => ({ retrieveEvidence: vi.fn() }));

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
const input: ChunkInput = { kind: "quiz", operationId: "12345678-1234-1234-1234-123456789abc",
  documentId: "file12345678", sourceMd5: "a".repeat(32), chunkIndex: 0, chunkCount: 1,
  startPage: 1, endPage: 1, pageCount: 1, requestedCount: 10, emptyPages: [],
  text: "The source describes important diagnostic principles, their conditions, limitations and applications.",
  section: { id: "section-1", title: "Foundations", startPage: 1, endPage: 1, source: "heading" },
  plannedFormats: Array(10).fill("select_all"), plannedFamilies: Array(10).fill("definition"), evidenceMode: "research" };

describe("checkpointed assessment requests", () => {
  it("resumes one batch per request and records only the evidence each batch actually used", async () => {
    vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 4).toString("base64"));
    const saved = new Map<string, SignedMap>();
    vi.mocked(getMap).mockImplementation(async (_token, name) => saved.get(name) || null);
    vi.mocked(saveMap).mockImplementation(async (_token, name, map) => { saved.set(name, JSON.parse(JSON.stringify(map))); });
    vi.mocked(retrieveEvidence).mockResolvedValueOnce([{ title: "Evidence A", year: "2025", url: "https://europepmc.org/article/MED/111", abstract: "A" }])
      .mockResolvedValueOnce([{ title: "Evidence B", year: "2026", url: "https://europepmc.org/article/MED/222", abstract: "B" }]);
    vi.mocked(generateChunkQuestions).mockImplementation(async (_source, formats, _families, _start, _end, _title, _reserve, _signal, evidence, onModel) => {
      onModel?.("test-model");
      return formats.map((responseType, i) => ({ id: String(i), responseType,
        question: `${evidence![0].title} question ${i}` } as QuizQuestionV2));
    });
    const principal = { sub: "alice", accessToken: "alice-token" };
    expect(await processChunk(principal, input)).toEqual({ pending: true, completedQuestions: 5, totalQuestions: 10 });
    expect(generateChunkQuestions).toHaveBeenCalledTimes(1);
    const completed = await processChunk(principal, input);
    if ("pending" in completed) throw new Error("Expected completed map");
    expect(completed.map.questions).toHaveLength(10);
    expect(new Set(completed.map.questions!.map((q) => "id" in q ? q.id : "" )).size).toBe(10);
    expect(completed.map.evidenceReferences!.map((ref) => ref.title)).toEqual(["Evidence A", "Evidence B"]);
    expect(verifyMap(completed.map, completed.signature)).toBe(true);
    expect(await processChunk(principal, input)).toEqual(completed);
    expect(generateChunkQuestions).toHaveBeenCalledTimes(2);
    expect(retrieveEvidence).toHaveBeenCalledTimes(2);
    const batchKey = [...saved.keys()].find((key) => key.endsWith("-batch-0.json"))!;
    const batch = saved.get(batchKey)!;
    batch.map.subject = "bob"; batch.signature = signMap(batch.map);
    saved.delete([...saved.keys()].find((key) => !key.includes("-batch-"))!);
    await expect(processChunk(principal, input)).rejects.toThrow("integrity validation");
  });
  it("does not retrieve or claim evidence for unassessed pages", async () => {
    vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 4).toString("base64"));
    const result = await processChunk({ sub: "alice", accessToken: "alice-token" },
      { ...input, plannedFormats: [], plannedFamilies: [] });
    if ("pending" in result) throw new Error("Expected completed map");
    expect(result.map.evidenceReferences).toBeUndefined();
    expect(retrieveEvidence).not.toHaveBeenCalled();
  });
});
