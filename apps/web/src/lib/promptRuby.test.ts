import { describe, expect, it } from "vitest";
import { promptSyllables, questionHidesPinyin, sliceByHan } from "./promptRuby";

describe("promptSyllables", () => {
  it("ghép pinyin với đề, bỏ chỗ trống", () => {
    expect(promptSyllables("你 ______ 长得更像你妈妈。", "Nǐ ___ zhǎng de gèng xiàng nǐ māma.")).toEqual(["nǐ", "zhǎng", "de", "gèng", "xiàng", "nǐ", "mā", "ma"]);
    expect(promptSyllables("刘明为什么以为李文是杨同乐？", "Liú Míng wèishénme yǐwéi Lǐ Wén shì Yáng Tónglè?")).toHaveLength(13);
  });
  it("gợi ý chữ Việt trong ngoặc cuối đề không làm hỏng việc ghép; chữ Hán trong ngoặc thì vẫn không ghép", () => {
    expect(promptSyllables("这个箱子太____了。(nặng)", "Zhè ge xiāngzi tài ____ le.")).toHaveLength(6);
    expect(promptSyllables("这个箱子太____了。(重 nặng)", "Zhè ge xiāngzi tài ____ le.")).toBeNull();
    // lời dẫn tiếng Việt đứng đầu đề + pinyin gợi ý trong ngoặc
    expect(promptSyllables("Điền một từ còn thiếu: 发视频以前，要先问别人。（yǔnxǔ）", "Fā shìpín yǐqián, yào xiān wèn biérén.")).toHaveLength(10);
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

describe("questionHidesPinyin", () => {
  const opts = (...l: string[]) => ({ options: l.map((label, i) => ({ id: `o${i}`, label })) });
  it("đề hỏi pinyin / phiên âm / cách đọc / thanh điệu", () => {
    expect(questionHidesPinyin("Màn hình đang 播放 một đoạn video. Chọn pinyin đúng của 播放.", opts("bōfāng", "bōfàng"))).toBe(true);
    expect(questionHidesPinyin("Chọn phiên âm đúng của 袋", {})).toBe(true);
    expect(questionHidesPinyin("Từ nào có cách đọc khác?", {})).toBe(true);
    expect(questionHidesPinyin("Thanh điệu của 一 ở đây là gì?", {})).toBe(true);
  });
  it("cờ hidePinyin trên câu hỏi", () => {
    expect(questionHidesPinyin("Chọn từ đúng.", { hidePinyin: true })).toBe(true);
    expect(questionHidesPinyin("Chọn từ đúng.", { hidePinyin: false })).toBe(false);
  });
  it("phương án đều là pinyin thì đó là bài kiểm cách đọc, dù đề không nhắc chữ pinyin", () => {
    expect(questionHidesPinyin("播放", opts("bōfāng", "bōfàng", "bófàng"))).toBe(true);
  });
  it("câu thường không bị tắt: phương án chữ Hán, nghĩa tiếng Việt (kể cả từ giống âm tiết pinyin)", () => {
    expect(questionHidesPinyin("我在超市买了一____面包。", opts("袋", "台"))).toBe(false);
    expect(questionHidesPinyin("Nối từ tiếng Trung với nghĩa tiếng Việt.", opts("cái túi", "chìa khoá", "cây"))).toBe(false);
    expect(questionHidesPinyin("Chọn nghĩa của 桶", opts("cái xô", "đồ đạc"))).toBe(false);
  });
});
