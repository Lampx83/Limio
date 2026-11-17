import { describe, expect, it } from "vitest";
import { promptSyllables, sliceByHan } from "./promptRuby";

describe("promptSyllables", () => {
  it("ghép pinyin với đề, bỏ chỗ trống", () => {
    expect(promptSyllables("你 ______ 长得更像你妈妈。", "Nǐ ___ zhǎng de gèng xiàng nǐ māma.")).toEqual(["nǐ", "zhǎng", "de", "gèng", "xiàng", "nǐ", "mā", "ma"]);
    expect(promptSyllables("刘明为什么以为李文是杨同乐？", "Liú Míng wèishénme yǐwéi Lǐ Wén shì Yáng Tónglè?")).toHaveLength(13);
  });
  it("không ghép được thì null: không pinyin, lệch số chữ, đề nhiều dòng, không có chữ Hán", () => {
    expect(promptSyllables("你好", undefined)).toBeNull();
    expect(promptSyllables("你好吗", "Nǐ hǎo")).toBeNull();
    expect(promptSyllables("你\n好", "Nǐ hǎo")).toBeNull();
    expect(promptSyllables("Hello", "hello")).toBeNull();
  });
});

describe("sliceByHan", () => {
  it("chia âm tiết theo số chữ Hán của từng đoạn", () => {
    expect(sliceByHan(["nǐ", "zhǎng", "de"], ["你", "长得"])).toEqual([["nǐ"], ["zhǎng", "de"]]);
    expect(sliceByHan(["a"], ["", "好", "吗"])).toEqual([[], ["a"], []]);
  });
});
