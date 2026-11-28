import { createHash } from "node:crypto";
import { signMap, verifyMap } from "./crypto";
import { createAppData, findAppData, readAppData } from "./google";
import { AppError } from "./errors";
import type { CheckpointStore, CheckpointValue } from "./generation-checkpoints";

type Record = { schema: 1; kind: "generation-checkpoint"; subject: string; scope: string;
  key: string; value: CheckpointValue };

export function driveCheckpointStore(principal: { sub: string; accessToken: string }, scope: string,
  documentId: string, sourceMd5: string): CheckpointStore {
  const scopeHash = createHash("sha256").update(scope).digest("hex");
  const name = (key: string) => `checkpoint-${scopeHash}-${createHash("sha256").update(key).digest("hex")}.json`;
  return {
    async read(key) {
      const meta = await findAppData(principal.accessToken, name(key));
      if (!meta) return null;
      if (meta.appProperties?.kind !== "generation-checkpoint" || meta.appProperties.documentId !== documentId ||
          meta.appProperties.sourceMd5 !== sourceMd5) throw new AppError(502, "Bước xử lý đã lưu không khớp tài liệu.");
      const saved = await readAppData<{ record: Record; signature: string }>(principal.accessToken, meta.id);
      const record = saved?.record;
      if (!record || typeof saved.signature !== "string" || !verifyMap(record, saved.signature) ||
          record.schema !== 1 || record.kind !== "generation-checkpoint" || record.subject !== principal.sub ||
          record.scope !== scopeHash || record.key !== key || typeof record.value?.content !== "string" ||
          (record.value.model !== undefined && typeof record.value.model !== "string")) {
        throw new AppError(502, "Bước xử lý đã lưu không qua kiểm tra toàn vẹn.");
      }
      return record.value;
    },
    async write(key, value) {
      const record: Record = { schema: 1, kind: "generation-checkpoint", subject: principal.sub,
        scope: scopeHash, key, value };
      await createAppData(principal.accessToken, name(key), { record, signature: signMap(record) },
        { kind: "generation-checkpoint", documentId, sourceMd5 });
    },
  };
}
