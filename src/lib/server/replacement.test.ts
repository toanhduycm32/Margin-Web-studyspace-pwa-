import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactRecord } from "../shared/types";
import type { AppDataMeta } from "./google";

const drive = vi.hoisted(() => ({ files: new Map<string, Array<{ meta: AppDataMeta; value: unknown }>>(),
  failCreate: false, failDelete: false, failList: false, sequence: 0 }));
vi.mock("./google", () => ({
  findAppData: async (token: string, name: string) => drive.files.get(token)?.find((file) => file.meta.name === name)?.meta || null,
  readAppData: async (token: string, id: string) => drive.files.get(token)?.find((file) => file.meta.id === id)?.value,
  listAppData: async (token: string, query: Record<string, unknown>) => {
    if (drive.failList) throw new Error("Drive temporarily unavailable");
    return { files: (drive.files.get(token) || []).filter(({ meta }) =>
      ["kind", "documentId", "artifactId"].every((key) => !query[key] || meta.appProperties?.[key] === query[key])).map(({ meta }) => meta) };
  },
  createAppData: async (token: string, name: string, value: unknown, properties: Record<string, string>) => {
    if (drive.failCreate) throw new Error("Write failed before acceptance");
    const meta = { id: `file00000000${++drive.sequence}`, name, createdTime: new Date().toISOString(), modifiedTime: new Date().toISOString(),
      appProperties: { app: "margin-v1", ...properties } };
    drive.files.set(token, [...drive.files.get(token) || [], { meta, value: structuredClone(value) }]);
    return meta;
  },
  deleteAppData: async (token: string, meta: AppDataMeta) => {
    if (drive.failDelete) throw new Error("Cleanup interrupted");
    drive.files.set(token, (drive.files.get(token) || []).filter((file) => file.meta.id !== meta.id));
  },
  driveFile: vi.fn(), updateAppData: vi.fn(),
}));
import { listArtifacts, saveArtifact, saveAttempt } from "./store";

beforeEach(() => { drive.files.clear(); drive.failCreate = false; drive.failDelete = false; drive.failList = false; drive.sequence = 0; });
function artifact(kind: "summary" | "quiz", number: number, documentId = "document12345678") {
  const operationId = `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
  return { operationId, data: { schema: 2, documentId, sourceMd5: "a".repeat(32), kind, ruleVersion: "test",
    model: "test", pageCount: 2, readablePages: 2, emptyPages: [], chunkCount: 1,
    generation: { operationId, startedAt: `2026-11-27T00:00:${String(number).padStart(2, "0")}.000Z` },
    payload: kind === "summary" ? { text: "Nội dung học tập." } : { questions: [] },
  } satisfies Omit<ArtifactRecord, "id" | "createdAt"> };
}
const save = (token: string, kind: "summary" | "quiz", number: number, documentId?: string) => {
  const item = artifact(kind, number, documentId); return saveArtifact(token, item.data, item.operationId);
};

describe("Drive artifact replacement", () => {
  it("keeps the current resource when the replacement write fails", async () => {
    const old = await save("A", "summary", 1);
    drive.failCreate = true;
    await expect(save("A", "summary", 2)).rejects.toThrow("Write failed");
    expect((await listArtifacts("A", old.documentId))[0].id).toBe(old.id);
  });
  it("replaces only the matching account, PDF and resource type", async () => {
    const old = await save("A", "summary", 1);
    const quiz = await save("A", "quiz", 2);
    const otherPdf = await save("A", "summary", 3, "otherpdf12345678");
    const otherUser = await save("B", "summary", 1);
    const newer = await save("A", "summary", 4);
    expect((await listArtifacts("A", old.documentId)).map((item) => item.id).sort()).toEqual([quiz.id, newer.id].sort());
    expect((await listArtifacts("B", otherUser.documentId))[0].id).toBe(otherUser.id);
    expect((await listArtifacts("A", otherPdf.documentId))[0].id).toBe(otherPdf.id);
  });
  it("rejects a delayed older operation and its replay without removing the newer one", async () => {
    const newer = await save("A", "summary", 5);
    await expect(save("A", "summary", 2)).rejects.toMatchObject({ status: 409 });
    await expect(save("A", "summary", 2)).rejects.toMatchObject({ status: 409 });
    expect((await listArtifacts("A", newer.documentId))[0].id).toBe(newer.id);
  });
  it("treats cleanup failure as deferred, keeps one visible winner and retries idempotently", async () => {
    await save("A", "summary", 1);
    drive.failDelete = true;
    const newer = await save("A", "summary", 2);
    expect(await listArtifacts("A", newer.documentId)).toHaveLength(1);
    expect(drive.files.get("A")).toHaveLength(2);
    drive.failDelete = false;
    expect((await save("A", "summary", 2)).id).toBe(newer.id);
    expect(drive.files.get("A")).toHaveLength(1);
  });
  it("does not report a successful write as failed when cleanup discovery is unavailable", async () => {
    drive.failList = true;
    const newer = await save("A", "summary", 2);
    drive.failList = false;
    expect((await listArtifacts("A", newer.documentId))[0].id).toBe(newer.id);
  });
  it("removes attempts only for the replaced quiz and refuses a stale attempt submission", async () => {
    const old = await save("A", "quiz", 1);
    const oldAttempt = { schema: 2 as const, artifactId: old.id, documentId: old.documentId, answers: [], score: 0, questionCount: 0 };
    await saveAttempt("A", oldAttempt);
    const other = await save("A", "quiz", 2, "otherpdf12345678");
    const retained = await saveAttempt("A", { ...oldAttempt, artifactId: other.id, documentId: other.documentId });
    await save("A", "quiz", 3);
    await expect(saveAttempt("A", oldAttempt)).rejects.toMatchObject({ status: 409 });
    const attempts = drive.files.get("A")!.filter((file) => file.meta.appProperties?.kind === "attempt");
    expect(attempts).toHaveLength(1);
    expect(attempts[0].value).toMatchObject({ id: retained.id });
  });
});
