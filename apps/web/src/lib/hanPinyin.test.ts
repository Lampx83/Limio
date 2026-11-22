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

describe("hanSyllables: thanh nhẹ, 儿化 và chữ đa âm theo cách ghi của sách chuẩn", () => {
  const py = (t: string) => hanSyllables(t)!.join(" ");
  it("thanh nhẹ không dấu (bảng từ HSK 3.0)", () => {
    expect(py("朋友")).toBe("péng you");
    expect(py("喜欢")).toBe("xǐ huan");
    expect(py("时候")).toBe("shí hou");
    expect(py("东西")).toBe("dōng xi");
    expect(py("谢谢")).toBe("xiè xie");
  });
  it("儿化 viết r, 儿 thật vẫn ér", () => {
    expect(py("哪儿")).toBe("nǎ r");
    expect(py("这儿")).toBe("zhè r");
    expect(py("玩儿")).toBe("wán r");
    expect(py("女儿")).toBe("nǚ ér");
    expect(py("儿子")).toBe("ér zi");
  });
  it("得 làm bổ ngữ là de, 得到 là dé, sau đại từ là děi", () => {
    expect(py("睡得好吗")).toBe("shuì de hǎo ma");
    expect(py("考得不好")).toBe("kǎo de bù hǎo");
    expect(py("得到")).toBe("dé dào");
    expect(py("我得走")).toBe("wǒ děi zǒu");
    expect(py("觉得")).toBe("jué de");
  });
  it("睡着 / 睡不着 là zháo, 睡个好觉 là jiào", () => {
    expect(py("睡不着")).toBe("shuì bù zháo");
    expect(py("他睡着了")).toBe("tā shuì zháo le");
    expect(py("睡个好觉")).toBe("shuì gè hǎo jiào");
    expect(py("看着书")).toBe("kàn zhe shū");
  });
  it("都: dōu là phổ biến, dū chỉ trong từ chỉ đô thị", () => {
    expect(py("他们都会来")).toBe("tā men dōu huì lái");
    expect(py("我都会等你")).toBe("wǒ dōu huì děng nǐ");
    expect(py("首都")).toBe("shǒu dū");
    expect(py("成都")).toBe("chéng dū");
    expect(py("都市")).toBe("dū shì");
  });
});
