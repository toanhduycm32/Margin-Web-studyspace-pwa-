import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "./errors";

function key(purpose: string): Buffer {
  const raw = process.env.SESSION_SECRET;
  if (!raw) throw new AppError(503, "SESSION_SECRET is not configured.");
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) throw new AppError(503, "SESSION_SECRET must be 32 random bytes encoded as base64.");
  return createHash("sha256").update(decoded).update(purpose).digest();
}

export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("cookie-v1"), iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${payload.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

export function unseal<T>(value: string): T {
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new AppError(401, "Session is invalid. Sign in again.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key("cookie-v1"), Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[3], "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[2], "base64url")), decipher.final()]).toString("utf8")) as T;
  } catch { throw new AppError(401, "Session is invalid. Sign in again."); }
}

export function sign(value: unknown): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", key("signature-v1")).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verify<T>(value: string): T | null {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", key("signature-v1")).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T; }
  catch { return null; }
}

function canonical(value: unknown, legacy = false): string {
  if (Array.isArray(value)) return `[${Array.from(value, (item) => canonical(item, legacy)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    // JSON removes undefined object properties on both HTTP and Drive round trips.
    const keys = Object.keys(record).filter((key) => legacy || record[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key], legacy)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function signMap(value: unknown): string {
  return createHmac("sha256", key("map-v1")).update(canonical(value)).digest("base64url");
}

export function verifyMap(value: unknown, signature: string): boolean {
  const received = Buffer.from(signature, "base64url");
  const valid = (payload: unknown, legacy = false) => {
    const expected = createHmac("sha256", key("map-v1")).update(canonical(payload, legacy)).digest();
    return received.length === expected.length && timingSafeEqual(received, expected);
  };
  if (valid(value)) return true;
  // The first schema-3 release signed optional undefined fields before JSON
  // omitted them. Accept those authenticated Drive records so retries can reuse work.
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const map = value as Record<string, unknown>;
  if (map.schema !== 3 || map.ruleVersion !== "2026-11-25-1") return false;
  const originalShape = { ...map, summaryProfile: map.summaryProfile, wordTarget: map.wordTarget,
    plannedFormats: map.plannedFormats, plannedFamilies: map.plannedFamilies };
  return valid(originalShape, true);
}
