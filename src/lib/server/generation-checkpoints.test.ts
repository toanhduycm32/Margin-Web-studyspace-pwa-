import { afterEach, expect, it, vi } from "vitest";
import { checkpointEvidence, checkpointInference, GenerationContinuation, withGenerationCheckpoints,
  checkpointProviderUnavailable, markCheckpointProviderUnavailable, type CheckpointStore, type CheckpointValue } from "./generation-checkpoints";
import { summarizeChunk } from "./nvidia";
import { AppError } from "./errors";

function memoryStore(): CheckpointStore {
  const values = new Map<string, CheckpointValue>();
  return { read: async (key) => values.get(key) || null,
    write: async (key, value) => { values.set(key, structuredClone(value)); } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it("persists a real summary draft before yielding and reviews it on the next request without regenerating", async () => {
  vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
  const digest = "Phương pháp được áp dụng khi có đồng thời điều kiện A và B. Ngoại lệ C cần được loại trừ trước khi áp dụng phương pháp trong tình huống đã nêu.";
  const completion = (value: unknown) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }] });
  const fetch = vi.fn().mockResolvedValueOnce(completion({ digest }))
    .mockResolvedValueOnce(completion({ checks: [{ unit: 1, references: ["E1"], issue: "" }], omissions: [] }));
  vi.stubGlobal("fetch", fetch);
  const reserve = vi.fn(async () => {});
  const store = memoryStore();
  const models: string[] = [];
  const run = () => withGenerationCheckpoints(store, () => summarizeChunk(
    digest, 1, 1, "medical", "Điều kiện áp dụng", "heading",
    40, reserve, undefined, [], (model) => models.push(model)));
  await expect(run()).rejects.toBeInstanceOf(GenerationContinuation);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await run()).toBe(digest);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(reserve).toHaveBeenCalledTimes(2);
  expect(models).toHaveLength(3); // The saved draft retains its actual model attribution.
});

it("keeps rejected drafts and review decisions recoverable while requiring a newly reviewed repair", async () => {
  const store = memoryStore();
  const calls: string[] = [];
  const call = (phase: string, content: string) => checkpointInference({ phase }, async () => {
    calls.push(phase); return { content, model: "test" };
  });
  const run = () => withGenerationCheckpoints(store, async () => {
    await call("draft", "bad draft");
    const review = await call("review", "rejected");
    if (review === "rejected") {
      const fixed = await call("repair with issue", "repaired draft");
      if (await call("review repair", "valid") === "valid") return fixed;
    }
    throw new Error("No accepted result");
  });
  for (let request = 0; request < 3; request++) await expect(run()).rejects.toBeInstanceOf(GenerationContinuation);
  expect(await run()).toBe("repaired draft");
  expect(calls).toEqual(["draft", "review", "repair with issue", "review repair"]);
});

it("isolates concurrent request contexts and binds cached responses to their full request identity", async () => {
  const alice = memoryStore(), bob = memoryStore();
  const generate = vi.fn(async () => ({ content: "A", model: "test" }));
  const outputs = await Promise.all([
    withGenerationCheckpoints(alice, () => checkpointInference({ prompt: "same" }, generate)),
    withGenerationCheckpoints(bob, () => checkpointInference({ prompt: "same" }, async () => ({ content: "B" }))),
  ]);
  expect(outputs).toEqual(["A", "B"]);
  expect(await withGenerationCheckpoints(alice, () => checkpointInference({ prompt: "same" }, generate))).toBe("A");
  await withGenerationCheckpoints(alice, () => checkpointInference({ prompt: "changed" }, generate));
  expect(generate).toHaveBeenCalledTimes(2);
});

it("pins the external evidence snapshot and does not report progress when saving a draft fails", async () => {
  const store = memoryStore();
  const search = vi.fn().mockResolvedValueOnce([{ title: "first" }]).mockResolvedValueOnce([{ title: "later" }]);
  expect(await withGenerationCheckpoints(store, () => checkpointEvidence(search))).toEqual([{ title: "first" }]);
  expect(await withGenerationCheckpoints(store, () => checkpointEvidence(search))).toEqual([{ title: "first" }]);
  expect(search).toHaveBeenCalledTimes(1);
  await expect(withGenerationCheckpoints({ ...store, write: async () => { throw Error("Drive unavailable"); } },
    () => checkpointInference("draft", async () => ({ content: "unreviewed" })))).rejects.toThrow("Drive unavailable");
});

it("keeps a temporary provider failure across request contexts, including a clock-bucket boundary", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-27T14:24:59Z"));
  const store = memoryStore();
  await withGenerationCheckpoints(store, () => markCheckpointProviderUnavailable("primary"));
  vi.setSystemTime(new Date("2026-11-27T14:25:01Z"));
  expect(await withGenerationCheckpoints(store, () => checkpointProviderUnavailable("primary"))).toBe(true);
  expect(await withGenerationCheckpoints(memoryStore(), () => checkpointProviderUnavailable("primary"))).toBe(false);
  vi.setSystemTime(new Date("2026-11-27T14:30:01Z"));
  expect(await withGenerationCheckpoints(store, () => checkpointProviderUnavailable("primary"))).toBe(false);
});

it("does not replay a permanently rejected response forever and bounds repeated failed rounds", async () => {
  const store = memoryStore();
  const generate = vi.fn(async () => ({ content: "invalid" }));
  const run = () => withGenerationCheckpoints(store, async () => {
    await checkpointInference("same request", generate);
    throw new AppError(502, "Rejected after bounded repairs", "RESTART_SECTION");
  });
  for (let round = 0; round < 3; round++) await expect(run()).rejects.toMatchObject({ code: "RESTART_SECTION" });
  expect(generate).toHaveBeenCalledTimes(3);
  await expect(run()).rejects.toMatchObject({ code: "RESTART_GENERATION" });
  expect(generate).toHaveBeenCalledTimes(3);
});
