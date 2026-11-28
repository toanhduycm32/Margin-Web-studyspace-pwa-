import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuizQuestionV2, SignedMap } from "@/lib/shared/types";
import { signMap, verifyMap } from "./crypto";
import { processChunk, type ChunkInput } from "./pipeline";
import { getMap, saveMap } from "./store";
import { generateSectionQuestions } from "./section-assessment";
import { retrieveEvidence } from "./evidence";

vi.mock("./store", () => ({
  generationOperation: vi.fn(async () => ({ startedAt: "2026-11-27T01:00:00.000Z" })),
  getDocumentRecord: vi.fn(async () => ({})), checkedPdf: vi.fn(async () => ({ md5Checksum: "a".repeat(32) })),
  getMap: vi.fn(), saveMap: vi.fn(), saveArtifact: vi.fn(),
}));
vi.mock("./ai-admission", () => ({ withAiAdmission: async (_principal: unknown, fn: (reserve: () => Promise<void>) => unknown) => fn(async () => {}) }));
vi.mock("./section-assessment", () => ({ generateSectionQuestions: vi.fn() }));
vi.mock("./nvidia", () => ({ summarizeChunk: vi.fn(), modelName: () => "test-model" }));
vi.mock("./evidence", () => ({ retrieveEvidence: vi.fn() }));
vi.mock("./checkpoint-store", () => ({ driveCheckpointStore: () => ({
  read: async () => null, write: async () => {},
}) }));

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
const input: ChunkInput = { kind: "quiz", operationId: "12345678-1234-1234-1234-123456789abc",
  documentId: "file12345678", sourceMd5: "a".repeat(32), chunkIndex: 0, chunkCount: 1,
  startPage: 1, endPage: 1, pageCount: 1, requestedCount: 2, emptyPages: [],
  text: "The source describes important diagnostic principles, their conditions, limitations and applications.",
  section: { id: "section-1", title: "Foundations", startPage: 1, endPage: 1, source: "heading" },
  plannedFormats: ["select_all", "select_n"], plannedFamilies: [], evidenceMode: "research" };

describe("checkpointed assessment requests", () => {
  it("reuses an accepted complete section and keeps its evidence and tenant identity", async () => {
    vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 4).toString("base64"));
    const saved = new Map<string, SignedMap>();
    vi.mocked(getMap).mockImplementation(async (_token, name) => saved.get(name) || null);
    vi.mocked(saveMap).mockImplementation(async (_token, name, map) => { saved.set(name, JSON.parse(JSON.stringify(map))); });
    vi.mocked(retrieveEvidence).mockResolvedValueOnce([{ title: "Evidence A", year: "2025", url: "https://europepmc.org/article/MED/111", abstract: "A" }])
      .mockResolvedValueOnce([{ title: "Evidence B", year: "2026", url: "https://europepmc.org/article/MED/222", abstract: "B" }]);
    vi.mocked(generateSectionQuestions).mockImplementation(async (_source, formats, _start, _end, _title, _reserve, _signal, evidence, onModel) => {
      onModel?.("test-model");
      return formats.map((responseType, i) => ({ id: String(i), responseType,
        question: `${evidence![0].title} question ${i}` } as QuizQuestionV2));
    });
    const principal = { sub: "alice", accessToken: "alice-token" };
    const completed = await processChunk(principal, input);
    if ("pending" in completed) throw new Error("Expected completed map");
    expect(completed.map.questions).toHaveLength(2);
    expect(new Set(completed.map.questions!.map((q) => "id" in q ? q.id : "" )).size).toBe(2);
    expect(completed.map.evidenceReferences!.map((ref) => ref.title)).toEqual(["Evidence A"]);
    expect(verifyMap(completed.map, completed.signature)).toBe(true);
    expect(await processChunk(principal, input)).toEqual(completed);
    expect(generateSectionQuestions).toHaveBeenCalledTimes(1);
    expect(retrieveEvidence).toHaveBeenCalledTimes(1);
    const batch = [...saved.values()][0];
    batch.map.subject = "bob"; batch.signature = signMap(batch.map);
    await expect(processChunk(principal, input)).rejects.toThrow("integrity validation");
  });
  it("does not retrieve or claim evidence for unassessed pages", async () => {
    vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 4).toString("base64"));
    const result = await processChunk({ sub: "alice", accessToken: "alice-token" },
      { ...input, excluded: true, plannedFormats: [], plannedFamilies: [] });
    if ("pending" in result) throw new Error("Expected completed map");
    expect(result.map.evidenceReferences).toBeUndefined();
    expect(retrieveEvidence).not.toHaveBeenCalled();
  });
});
