import { describe, expect, it } from "vitest";
import { generateRawToken, hashToken, ttlForPurpose } from "../tokens";

describe("tokens — pure helpers", () => {
  it("generates 64-hex-char tokens (32 bytes)", () => {
    const t = generateRawToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates distinct tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateRawToken()));
    expect(tokens.size).toBe(100);
  });

  it("hashToken is deterministic and 64 hex chars", () => {
    const raw = "abcdef";
    expect(hashToken(raw)).toEqual(hashToken(raw));
    expect(hashToken(raw)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashToken differs for different input", () => {
    expect(hashToken("a")).not.toEqual(hashToken("b"));
  });

  it("ttlForPurpose: 24h for verify, 1h for reset", () => {
    expect(ttlForPurpose("email_verify")).toBe(24 * 60 * 60 * 1000);
    expect(ttlForPurpose("password_reset")).toBe(60 * 60 * 1000);
  });
});
