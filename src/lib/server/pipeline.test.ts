import { afterEach, describe, expect, it, vi } from "vitest";
import { signMap } from "./crypto";
import { STUDY_RULE_VERSION } from "@/lib/shared/study-rules";
import { saveArtifact } from "./store";
import type { MapRecord } from "@/lib/shared/types";

vi.mock("./store", () => ({
  getDocumentRecord: vi.fn(async () => ({ record: { schema: 1 }, meta: { id: "record12345678" } })),
  checkedPdf: vi.fn(async () => ({ md5Checksum: "a".repeat(32) })),
  saveArtifact: vi.fn(), getMap: vi.fn(), saveMap: vi.fn(),
}));

afterEach(() => vi.unstubAllEnvs());

describe("tenant-bound whole-PDF processing", () => {
  it("rejects Alice's signed digest even when Bob can open an identical shared PDF", async () => {
    vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 4).toString("base64"));
    const { finalize } = await import("./pipeline");
    const map: MapRecord = { schema: 2, subject: "sub-alice", kind: "summary",
      documentId: "file12345678", sourceMd5: "a".repeat(32), chunkIndex: 0, chunkCount: 1,
      startPage: 1, endPage: 1, pageCount: 1, requestedCount: 0, textHash: "b".repeat(64),
      emptyPages: [], digest: "A source-backed digest about the shared PDF." };
    await expect(finalize({ sub: "sub-bob", accessToken: "bob-token" }, {
      kind: "summary", operationId: "12345678-1234-1234-1234-123456789abc",
      documentId: map.documentId, sourceMd5: map.sourceMd5,
      requestedCount: 0, summaryProfile: "academic", maps: [{ map, signature: signMap(map) }],
    })).rejects.toMatchObject({ status: 400 });
  });
  it("assembles ordered section summaries without a truncating final model call", async () => {
    vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 4).toString("base64"));
    const { finalize } = await import("./pipeline");
    const base = { schema: 3 as const, subject: "sub-alice", kind: "summary" as const,
      documentId: "file12345678", sourceMd5: "a".repeat(32), chunkCount: 2, pageCount: 4,
      requestedCount: 0, textHash: "b".repeat(64), emptyPages: [], ruleVersion: STUDY_RULE_VERSION,
      summaryProfile: "academic", wordTarget: 180 };
    const first: MapRecord = { ...base, chunkIndex: 0, startPage: 1, endPage: 2,
      section: { id: "section-1", title: "Chapter 1 Foundations", startPage: 1, endPage: 2, source: "outline" },
      digest: "The first chapter introduces the core concepts and their necessary assumptions." };
    const second: MapRecord = { ...base, chunkIndex: 1, startPage: 3, endPage: 4,
      section: { id: "section-2", title: "Chapter 2 Applications", startPage: 3, endPage: 4, source: "outline" },
      digest: "The later chapter applies those concepts and states their important limits." };
    await finalize({ sub: "sub-alice", accessToken: "alice-token" }, {
      kind: "summary", operationId: "12345678-1234-1234-1234-123456789abc", documentId: base.documentId,
      sourceMd5: base.sourceMd5, requestedCount: 0, summaryProfile: "academic",
      maps: [second, first].map((map) => ({ map, signature: signMap(map) })),
    });
    const artifact = vi.mocked(saveArtifact).mock.calls.at(-1)![1];
    expect((artifact.payload as { text: string }).text).toContain("Chapter 1 Foundations");
    expect((artifact.payload as { text: string }).text.indexOf("Chapter 1")).toBeLessThan(
      (artifact.payload as { text: string }).text.indexOf("Chapter 2"));
    expect(artifact.sections).toHaveLength(2);
  });
  it("finalizes a segment after its response is serialized through JSON", async () => {
    vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 4).toString("base64"));
    const { processChunk, finalize } = await import("./pipeline");
    const principal = { sub: "sub-alice", accessToken: "alice-token" };
    const input = { kind: "summary" as const, operationId: "12345678-1234-1234-1234-123456789abc",
      documentId: "file12345678", sourceMd5: "a".repeat(32), chunkIndex: 0, chunkCount: 1,
      startPage: 1, endPage: 1, pageCount: 1, requestedCount: 0, emptyPages: [],
      text: "Page 1\nSmall source note.", summaryProfile: "academic" as const, wordTarget: 20,
      section: { id: "section-1", title: "Source note", startPage: 1, endPage: 1, source: "heading" as const } };
    const wire = JSON.parse(JSON.stringify(await processChunk(principal, input)));
    await finalize(principal, { kind: "summary", operationId: input.operationId, documentId: input.documentId,
      sourceMd5: input.sourceMd5, requestedCount: 0, summaryProfile: "academic", maps: [wire] });
    const artifact = vi.mocked(saveArtifact).mock.calls.at(-1)![1];
    expect((artifact.payload as { text: string }).text).toContain("Small source note.");
  });
});
