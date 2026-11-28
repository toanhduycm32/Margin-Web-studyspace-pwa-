import { createHash } from "node:crypto";
import { AppError } from "./errors";

export function logAiFailure(phase: "chunk" | "finalize" | "plan", subject: string, operationId: unknown, error: unknown): void {
  const account = createHash("sha256").update(subject).digest("hex").slice(0, 12);
  console.warn("ai_operation", { category: error instanceof AppError ? `app_${error.status}` : "unexpected",
    phase, account, operationId: typeof operationId === "string" && /^[0-9a-f-]{36}$/i.test(operationId)
      ? operationId : undefined });
}
