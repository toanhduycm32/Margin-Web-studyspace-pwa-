import { afterEach, describe, expect, it, vi } from "vitest";
import { signMap } from "./crypto";
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
      kind: "summary", documentId: map.documentId, sourceMd5: map.sourceMd5,
      requestedCount: 0, maps: [{ map, signature: signMap(map) }],
    })).rejects.toMatchObject({ status: 400 });
  });
});
