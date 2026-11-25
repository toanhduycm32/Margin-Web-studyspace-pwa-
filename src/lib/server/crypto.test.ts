import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
});
