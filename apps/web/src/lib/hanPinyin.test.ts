import { describe, expect, it } from "vitest";
import { hanSyllables, toneOf } from "./hanPinyin";

describe("hanSyllables", () => {
  it("một âm tiết cho mỗi chữ Hán, bỏ qua ký tự khác", () => {
    expect(hanSyllables("幅")).toEqual(["fú"]);
    expect(hanSyllables("打")).toEqual(["dǎ"]);
    expect(hanSyllables("A. 袋子")).toEqual(["dài", "zi"]);
    expect(hanSyllables("敲、推")).toEqual(["qiāo", "tuī"]);
  });
  it("chữ đa âm theo từ: 银行, 觉得, 着急", () => {
    expect(hanSyllables("银行")).toEqual(["yín", "háng"]);
    expect(hanSyllables("觉得")).toEqual(["jué", "de"]);
    expect(hanSyllables("着急")).toEqual(["zháo", "jí"]);
  });
  it("đổi thanh 一 và 不 theo âm tiết sau", () => {
    expect(hanSyllables("一个")).toEqual(["yí", "gè"]);
    expect(hanSyllables("一天")).toEqual(["yì", "tiān"]);
    expect(hanSyllables("不对")).toEqual(["bú", "duì"]);
    expect(hanSyllables("不好")).toEqual(["bù", "hǎo"]);
    expect(hanSyllables("一二三")).toEqual(["yī", "èr", "sān"]);
  });
  it("không phải tiếng Trung thì null: không chữ Hán, có kana/Hangul", () => {
    expect(hanSyllables("hello")).toBeNull();
    expect(hanSyllables("日本語のテスト")).toBeNull();
    expect(hanSyllables("한국어 学")).toBeNull();
  });
  it("chữ ngoài bảng nhận chuỗi rỗng, các chữ khác vẫn có âm", () => {
    expect(hanSyllables("𠀀")).toBeNull();
    const r = hanSyllables("袋㐀");
    expect(r?.[0]).toBe("dài");
    expect(r?.[1]).toBe("");
  });
  it("toneOf", () => {
    expect(["fú", "dǎ", "dài", "tiān", "le"].map(toneOf)).toEqual([2, 3, 4, 1, 0]);
  });
});
