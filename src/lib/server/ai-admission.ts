import { createHash, randomUUID } from "node:crypto";
import { createAppData, listAppData } from "./google";
import { AppError } from "./errors";

type Principal = { sub: string; accessToken: string };
const activeBySubject = new Map<string, number>();
const countedBySubject = new Map<string, { day: string; count: number }>();
let activeTotal = 0;

function positiveLimit(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new AppError(503, `${name} must be an integer from 1 to ${maximum}.`);
  }
  return value;
}

export function aiDailyCallLimit(): number { return positiveLimit("AI_DAILY_CALL_LIMIT", 200, 1000); }
function aiProcessConcurrency(): number { return positiveLimit("AI_PROCESS_CONCURRENCY", 4, 16); }

async function reserveDailyCall(principal: Principal): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const limit = aiDailyCallLimit();
  let count = 0;
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const prior = await listAppData(principal.accessToken, { kind: "ai-usage", quotaDay: day,
      pageSize: Math.min(1000, limit - count), pageToken });
    count += prior.files?.length || 0;
    const known = countedBySubject.get(principal.sub);
    if (Math.max(count, known?.day === day ? known.count : 0) >= limit) {
      throw new AppError(429, `Your daily AI limit of ${limit} calls is reached. Try again tomorrow (UTC).`);
    }
    pageToken = prior.nextPageToken;
    if (!pageToken) break;
    if (page === 9) throw new AppError(503, "Could not verify today's AI usage. Try again later.");
  }
  const known = countedBySubject.get(principal.sub);
  count = Math.max(count, known?.day === day ? known.count : 0);
  // Each reservation is a separate file in this user's own Drive; failed inference still counts.
  await createAppData(principal.accessToken, `ai-usage-${day}-${randomUUID()}.json`,
    { schema: 1, day, createdAt: new Date().toISOString() }, { kind: "ai-usage", quotaDay: day });
  countedBySubject.set(principal.sub, { day, count: count + 1 });
}

export async function withAiAdmission<T>(principal: Principal,
  operation: (reserveCall: () => Promise<void>) => Promise<T>,
  context?: { operationId?: string; phase?: string }): Promise<T> {
  const maximum = aiProcessConcurrency();
  const account = createHash("sha256").update(principal.sub).digest("hex").slice(0, 12);
  if ((activeBySubject.get(principal.sub) || 0) >= 1) {
    console.info("ai_admission", { category: "account_active", account, operationId: context?.operationId, phase: context?.phase });
    throw new AppError(409, "Another AI request for this account is still running. Wait a moment, then retry.");
  }
  if (activeTotal >= maximum) {
    console.info("ai_admission", { category: "process_saturated", account, operationId: context?.operationId, phase: context?.phase });
    throw new AppError(503, "AI capacity is temporarily full. Your account is ready; retry shortly.");
  }
  const started = Date.now();
  activeTotal += 1;
  activeBySubject.set(principal.sub, (activeBySubject.get(principal.sub) || 0) + 1);
  try {
    return await operation(() => reserveDailyCall(principal));
  } catch (error) {
    console.warn("ai_admission", { category: error instanceof AppError ? `app_${error.status}` : "unexpected",
      account, operationId: context?.operationId, phase: context?.phase, elapsedMs: Date.now() - started });
    throw error;
  } finally {
    activeTotal -= 1;
    const remaining = (activeBySubject.get(principal.sub) || 1) - 1;
    if (remaining) activeBySubject.set(principal.sub, remaining);
    else activeBySubject.delete(principal.sub);
    console.info("ai_admission", { category: "released", account, operationId: context?.operationId,
      phase: context?.phase, elapsedMs: Date.now() - started });
  }
}
