import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { AppError } from "./errors";

export type CheckpointValue = { content: string; model?: string };
export type CheckpointStore = {
  read(key: string): Promise<CheckpointValue | null>;
  write(key: string, value: CheckpointValue): Promise<void>;
};
type Context = { store: CheckpointStore; generated: number; round: number };
const context = new AsyncLocalStorage<Context>();

// Internal control flow: the completed draft/review has already been saved.
// Never send this as a failed model response or consume another inference quota.
export class GenerationContinuation extends AppError {
  constructor() { super(202, "Đã lưu bước xử lý; đang tiếp tục kiểm tra nội dung."); }
}

export async function withGenerationCheckpoints<T>(store: CheckpointStore, operation: () => Promise<T>): Promise<T> {
  const current = { store, generated: 0, round: -1 };
  try { return await context.run(current, operation); }
  catch (error) {
    if (error instanceof AppError && error.code === "RESTART_SECTION" && current.round >= 0) {
      // A permanently rejected response must not trap every future retry in the
      // same cached failure. Accepted batch/segment maps live outside this round.
      await store.write(`round-${current.round}-failed`, { content: "validation-failed" });
    }
    throw error;
  }
}

export async function checkpointInference(identity: unknown, generate: () => Promise<CheckpointValue>,
  onModelUsed?: (model: string) => void): Promise<string> {
  const current = context.getStore();
  if (current && current.round < 0) {
    current.round = 0;
    while (current.round < 3 && await current.store.read(`round-${current.round}-failed`)) current.round++;
    if (current.round === 3) throw new AppError(502,
      "Phần nội dung này vẫn chưa đạt sau nhiều lần sửa. Cần tạo lại học liệu; bản hiện hành vẫn được giữ.", "RESTART_GENERATION");
  }
  const key = `round-${current?.round || 0}-inference-${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`;
  let value = current ? await current.store.read(key) : null;
  if (!value) {
    if (current && current.generated >= 1) throw new GenerationContinuation();
    if (current) current.generated++;
    value = await generate();
    // A failed save is a failure, not a completed step. The next request may
    // regenerate it; a missing acknowledgement never marks unreviewed work final.
    if (current) await current.store.write(key, value);
  }
  if (value.model) onModelUsed?.(value.model);
  return value.content;
}

export async function checkpointEvidence<T>(create: () => Promise<T>): Promise<T> {
  const current = context.getStore();
  if (!current) return create();
  // Keep the exact evidence snapshot stable across draft/review requests so a
  // changing public search response cannot invalidate a saved prompt identity.
  const cached = await current.store.read("evidence");
  if (cached) return JSON.parse(cached.content) as T;
  const value = await create();
  await current.store.write("evidence", { content: JSON.stringify(value) });
  return value;
}

const providerCooldown = 5 * 60_000;
function providerKey(model: string, bucket: number) { return `provider-unavailable-${model}-${bucket}`; }

export async function checkpointProviderUnavailable(model: string): Promise<boolean> {
  const current = context.getStore();
  if (!current) return false;
  const bucket = Math.floor(Date.now() / providerCooldown);
  for (const index of [bucket, bucket - 1]) {
    const marker = await current.store.read(providerKey(model, index));
    if (marker && Number(marker.content) > Date.now()) return true;
  }
  return false;
}

export async function markCheckpointProviderUnavailable(model: string): Promise<void> {
  const current = context.getStore();
  if (!current) return;
  await current.store.write(providerKey(model, Math.floor(Date.now() / providerCooldown)),
    { content: String(Date.now() + providerCooldown) });
}
