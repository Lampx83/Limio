// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { DEFAULT_READER_PREFS, courseHasPinyin, parseReaderPrefs, readerPrefsKey, serializeReaderPrefs, tapBlockOf } from "./readerPrefs";

describe("parseReaderPrefs", () => {
  it("thiếu hoặc hỏng thì về mặc định", () => {
    expect(parseReaderPrefs(null)).toEqual(DEFAULT_READER_PREFS);
    expect(parseReaderPrefs("")).toEqual(DEFAULT_READER_PREFS);
    expect(parseReaderPrefs("không phải json")).toEqual(DEFAULT_READER_PREFS);
    expect(parseReaderPrefs("null")).toEqual(DEFAULT_READER_PREFS);
  });
  it("đọc lại đúng giá trị đã lưu", () => {
    const p = { pinyin: "tap", size: "xl" } as const;
    expect(parseReaderPrefs(serializeReaderPrefs(p))).toEqual(p);
  });
  it("trường sai chỉ trường đó về mặc định", () => {
    expect(parseReaderPrefs('{"pinyin":"off","size":"khổng lồ"}')).toEqual({ pinyin: "off", size: "m" });
    expect(parseReaderPrefs('{"pinyin":"lạ","size":"l"}')).toEqual({ pinyin: "show", size: "l" });
  });
  it("khoá lưu theo slug khoá", () => {
    expect(readerPrefsKey("hsk-4-goc")).toBe("limio:reader:hsk-4-goc");
  });
});

describe("tapBlockOf", () => {
  it("chạm vào chữ trong đoạn thì lấy đoạn đó; chạm vào nút/liên kết thì không", () => {
    document.body.innerHTML = '<div><p id="p">xin <span id="s">chào</span> <button id="b">nghe</button> <a id="a" href="#">x</a></p></div>';
    expect(tapBlockOf(document.getElementById("s"))?.id).toBe("p");
    expect(tapBlockOf(document.getElementById("b"))).toBeNull();
    expect(tapBlockOf(document.getElementById("a"))).toBeNull();
    expect(tapBlockOf(null)).toBeNull();
  });
});

describe("courseHasPinyin", () => {
  it("khoá tiếng Trung (zh, vi, không ghi) có pinyin; tiếng Anh/Nhật/Hàn thì không", () => {
    expect(courseHasPinyin("zh")).toBe(true);
    expect(courseHasPinyin("zh-CN")).toBe(true);
    expect(courseHasPinyin("vi")).toBe(true);
    expect(courseHasPinyin(null)).toBe(true);
    expect(courseHasPinyin("en")).toBe(false);
    expect(courseHasPinyin("ja")).toBe(false);
  });
});
