import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { seal, sign, signMap, unseal, verify, verifyMap } from "./crypto";

const original = process.env.SESSION_SECRET;
beforeAll(() => { process.env.SESSION_SECRET = Buffer.alloc(32, 9).toString("base64"); });
afterAll(() => { if (original === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = original; });

describe("private session and processing receipts", () => {
  it("encrypts a cookie and rejects tampering", () => {
    const token = seal({ email: "owner@example.com" });
    expect(token).not.toContain("owner@example.com");
    expect(unseal<{ email: string }>(token).email).toBe("owner@example.com");
    const parts = token.split("."); const tag = Buffer.from(parts[3], "base64url"); tag[0] ^= 1;
    parts[3] = tag.toString("base64url");
    expect(() => unseal(parts.join("."))).toThrow();
  });
  it("verifies signed state and signed chunk results", () => {
    const state = { nonce: "example", expiresAt: 123 };
    expect(verify(sign(state))).toEqual(state);
    const map = { chunkIndex: 0, digest: "source-backed digest" };
    const signature = signMap(map);
    expect(verifyMap({ digest: map.digest, chunkIndex: 0 }, signature)).toBe(true);
    expect(verifyMap({ ...map, digest: "changed" }, signature)).toBe(false);
  });
  it("keeps a segment signature valid after the HTTP JSON round trip", () => {
    const map = { schema: 3, ruleVersion: "2026-11-25-1", kind: "summary",
      summaryProfile: "academic", wordTarget: 80, plannedFormats: undefined,
      plannedFamilies: undefined, digest: "A supported summary." };
    const wire = JSON.parse(JSON.stringify({ map, signature: signMap(map) }));
    expect(verifyMap(wire.map, wire.signature)).toBe(true);
    expect(verifyMap({ ...wire.map, digest: "Changed." }, wire.signature)).toBe(false);
  });
  it("accepts authenticated schema-3 maps signed before undefined fields were omitted", () => {
    const oldMap = { schema: 3, ruleVersion: "2026-11-25-1", kind: "quiz",
      summaryProfile: undefined, wordTarget: undefined, plannedFormats: ["select_all"],
      plannedFamilies: ["mechanism"], questions: [] };
    const oldCanonical = '{"kind":"quiz","plannedFamilies":["mechanism"],"plannedFormats":["select_all"],"questions":[],"ruleVersion":"2026-11-25-1","schema":3,"summaryProfile":null,"wordTarget":null}';
    const decoded = Buffer.alloc(32, 9);
    const key = createHash("sha256").update(decoded).update("map-v1").digest();
    const signature = createHmac("sha256", key).update(oldCanonical).digest("base64url");
    const wire = JSON.parse(JSON.stringify(oldMap));
    expect(verifyMap(wire, signature)).toBe(true);
    expect(verifyMap({ ...wire, questions: [{ changed: true }] }, signature)).toBe(false);
  });
});
