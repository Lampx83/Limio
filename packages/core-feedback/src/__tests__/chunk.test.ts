import { describe, expect, it } from "vitest";
import { chunkText } from "../oralExam/chunk";

describe("chunkText (A6.2)", () => {
  it("returns empty array for empty/whitespace-only text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("returns a single chunk when text is shorter than maxChars", () => {
    const text = "Đoạn ngắn về vòng lặp for.";
    expect(chunkText(text, 1000)).toEqual([text]);
  });

  it("packs multiple short paragraphs into one chunk under the limit", () => {
    const text = "Đoạn 1.\n\nĐoạn 2.\n\nĐoạn 3.";
    const chunks = chunkText(text, 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("Đoạn 1.\n\nĐoạn 2.\n\nĐoạn 3.");
  });

  it("starts a new chunk once adding the next paragraph would exceed maxChars", () => {
    const a = "a".repeat(40);
    const b = "b".repeat(40);
    const c = "c".repeat(40);
    const text = [a, b, c].join("\n\n");
    const chunks = chunkText(text, 90);
    // a+\n\n+b = 82 chars fits in 90; adding c (another 42) would not.
    expect(chunks).toEqual([`${a}\n\n${b}`, c]);
  });

  it("splits a single paragraph longer than maxChars on whitespace, no mid-word cuts", () => {
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const chunks = chunkText(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(50);
      // No chunk boundary lands inside a "wordN" token.
      expect(c.trim()).not.toMatch(/word\d+word\d+/);
    }
    // Rejoining preserves every word, in order, none dropped or duplicated.
    expect(chunks.join(" ").split(/\s+/)).toEqual(words);
  });

  it("preserves paragraph order across chunk boundaries", () => {
    const paras = Array.from({ length: 5 }, (_, i) => `Đoạn số ${i} `.repeat(10).trim());
    const text = paras.join("\n\n");
    const chunks = chunkText(text, 60);
    expect(chunks.join(" ")).toContain("Đoạn số 0");
    expect(chunks.join(" ").indexOf("Đoạn số 0")).toBeLessThan(
      chunks.join(" ").indexOf("Đoạn số 4"),
    );
  });
});
