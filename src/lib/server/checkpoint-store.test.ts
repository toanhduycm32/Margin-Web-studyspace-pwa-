import { afterEach, expect, it, vi } from "vitest";
import { driveCheckpointStore } from "./checkpoint-store";
import { createAppData, findAppData, readAppData } from "./google";
import { signMap } from "./crypto";

vi.mock("./google", () => ({ createAppData: vi.fn(), findAppData: vi.fn(), readAppData: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
it("binds private inference checkpoints to account, operation/source scope, step and signature", async () => {
  vi.stubEnv("SESSION_SECRET", Buffer.alloc(32, 5).toString("base64"));
  const alice = driveCheckpointStore({ sub: "alice", accessToken: "alice-token" }, "source-md5-operation-rule-input", "pdf1", "checksum");
  await alice.write("draft", { content: "private draft", model: "primary" });
  const args = vi.mocked(createAppData).mock.calls[0];
  expect(args[0]).toBe("alice-token");
  const saved = structuredClone(args[2]) as { record: { subject: string; value: { content: string } }; signature: string };
  vi.mocked(findAppData).mockResolvedValue({ id: "private-record", name: "checkpoint.json", appProperties: { kind: "generation-checkpoint", documentId: "pdf1", sourceMd5: "checksum" } });
  vi.mocked(readAppData).mockResolvedValue(saved);
  expect(await alice.read("draft")).toEqual({ content: "private draft", model: "primary" });
  await expect(alice.read("review")).rejects.toThrow("toàn vẹn");
  const bob = driveCheckpointStore({ sub: "bob", accessToken: "bob-token" }, "source-md5-operation-rule-input", "pdf1", "checksum");
  await expect(bob.read("draft")).rejects.toThrow("toàn vẹn");
  const otherOperation = driveCheckpointStore({ sub: "alice", accessToken: "alice-token" }, "other-operation", "pdf1", "checksum");
  await expect(otherOperation.read("draft")).rejects.toThrow("toàn vẹn");
  saved.record.value.content = "tampered";
  await expect(alice.read("draft")).rejects.toThrow("toàn vẹn");
  saved.record.subject = "bob"; saved.signature = signMap(saved.record);
  await expect(alice.read("draft")).rejects.toThrow("toàn vẹn");
});
