import { describe, expect, it } from "vitest";
import { cleanVocabItems, hasHanChars, shortVocabTag, splitVocabMeaning, splitVocabNote, vocabHanPieces } from "./hskVocab";

describe("hskVocab — tách từ loại / nghĩa", () => {
  it("tách 'đg. · thuê' thành từ loại và nghĩa; nghĩa không có từ loại giữ nguyên", () => {
    expect(splitVocabMeaning("đg. · thuê (nhà, xe…)")).toEqual({ pos: "đg.", meaning: "thuê (nhà, xe…)" });
    expect(splitVocabMeaning("đg./d. · nhớ; nỗi nhớ")).toEqual({ pos: "đg./d.", meaning: "nhớ; nỗi nhớ" });
    expect(splitVocabMeaning("cho thuê")).toEqual({ pos: null, meaning: "cho thuê" });
    expect(splitVocabMeaning("zū · thuê")).toEqual({ pos: null, meaning: "zū · thuê" });
  });
  it("tách nhãn chủ động / nhận biết khỏi ghi chú", () => {
    expect(splitVocabNote("Từ chủ động. Không nói 借房.")).toEqual({ tag: "Từ chủ động", active: true, note: "Không nói 借房." });
    expect(splitVocabNote("Từ nhận biết.")).toEqual({ tag: "Từ nhận biết", active: false, note: null });
    expect(splitVocabNote(undefined)).toEqual({ tag: null, active: false, note: null });
    expect(shortVocabTag("Từ chủ động")).toBe("Chủ động");
    expect(shortVocabTag("Từ nhận biết")).toBe("Nhận biết");
    expect(shortVocabTag(null)).toBeNull();
  });
});

describe("hskVocab — pinyin chia theo âm tiết", () => {
  it("ghép đủ âm tiết: mỗi chữ Hán một âm", () => {
    expect(vocabHanPieces("搬家", "bānjiā")).toEqual({ pieces: [{ text: "搬", rt: "bān" }, { text: "家", rt: "jiā" }], reading: null });
    expect(vocabHanPieces("服务台", "fú wù tái").pieces.map((p) => p.rt)).toEqual(["fú", "wù", "tái"]);
    expect(vocabHanPieces("租", "zū").pieces).toEqual([{ text: "租", rt: "zū" }]);
  });
  it("đa âm tiết 'er' (儿子, 耳)", () => {
    expect(vocabHanPieces("儿子", "érzi").pieces.map((p) => p.rt)).toEqual(["ér", "zi"]);
  });
  it("lệch số âm tiết hoặc thiếu pinyin: không ghép bừa", () => {
    expect(vocabHanPieces("搬家", "bān")).toEqual({ pieces: [], reading: "bān" });
    expect(vocabHanPieces("搬家", undefined)).toEqual({ pieces: [], reading: null });
    expect(vocabHanPieces("搬家", "  ")).toEqual({ pieces: [], reading: null });
  });
  it("hasHanChars", () => {
    expect(hasHanChars("租")).toBe(true);
    expect(hasHanChars("App")).toBe(false);
  });
});

describe("hskVocab — thẻ lỗi", () => {
  it("bỏ thẻ không có từ / không phải đối tượng, sửa nghĩa thiếu, đặt id", () => {
    const out = cleanVocabItems([{ term: "租", meaning: "thuê" }, { term: "", meaning: "x" }, null, "x", { term: "家" }, { id: "k", term: 5, meaning: "y" }]);
    expect(out.map((o) => [o.id, o.term, o.meaning])).toEqual([
      ["v0", "租", "thuê"],
      ["v4", "家", ""],
    ]);
    expect(cleanVocabItems(undefined)).toEqual([]);
  });
});

describe("markTermTokens", () => {
  it("đánh dấu mọi chữ của từ mới trong câu ví dụ, dấu câu thì không", async () => {
    const { markTermTokens } = await import("./hskVocab");
    const r = markTermTokens("我想租一间房子，房子很小。", "房子");
    expect(r.filter((t) => t.hl).map((t) => t.text).join("")).toBe("房子房子");
    expect(r.find((t) => t.text === "，")!.hl).toBe(false);
    expect(r.filter((t) => t.hl).length).toBe(4);
  });
  it("từ không xuất hiện hoặc rỗng: không đánh dấu", async () => {
    const { markTermTokens } = await import("./hskVocab");
    expect(markTermTokens("今天天气很好。", "房子").some((t) => t.hl)).toBe(false);
    expect(markTermTokens("今天天气很好。", "").some((t) => t.hl)).toBe(false);
  });
});
