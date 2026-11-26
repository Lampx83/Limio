import { describe, expect, it } from "vitest";
import { keyTermsFromVocab, splitHanWords } from "./keyTerms";

describe("keyTermsFromVocab", () => {
  it("giữ từ từ 2 chữ Hán trở lên, bỏ từ một chữ và trùng, dài trước", () => {
    expect(keyTermsFromVocab(["租", "房东", "来得及", "房东", " 条件 ", "abc"])).toEqual(["来得及", "房东", "条件"]);
  });
});

describe("splitHanWords", () => {
  it("tô chữ thuộc từ khoá, mỗi chữ Hán một đơn vị, đoạn không phải chữ Hán gom lại", () => {
    const w = splitHanWords("房东说，来得及！", ["房东", "来得及"]);
    expect(w.map((x) => [x.text, x.hl])).toEqual([["房", true], ["东", true], ["说", false], ["，", false], ["来", true], ["得", true], ["及", true], ["！", false]]);
    expect(w.filter((x) => x.scored)).toHaveLength(6);
  });
  it("từ khoá dài thắng, không chồng nhau, không có thì không tô gì", () => {
    expect(splitHanWords("按时交租", ["按时", "时交"]).filter((x) => x.hl).map((x) => x.text)).toEqual(["按", "时"]);
    expect(splitHanWords("你好", []).some((x) => x.hl)).toBe(false);
  });
  it("từ khoá không phải chữ Hán (vd. ô trống （1）) cũng được tô, thành một đơn vị riêng", () => {
    const w = splitHanWords("我家（1）学校", ["（1）"]);
    expect(w.map((x) => [x.text, x.scored, x.hl])).toEqual([["我", true, false], ["家", true, false], ["（1）", false, true], ["学", true, false], ["校", true, false]]);
  });
  it("chữ Latin và khoảng trắng đi nguyên", () => {
    const w = splitHanWords("App 好用", ["好用"]);
    expect(w[0]).toEqual({ text: "App ", scored: false, hl: false });
  });
});
