import { describe, expect, it } from "vitest";
import {
  parseUiLang,
  resolveUiLang,
  translate,
  uiLangForCourse,
} from "./core";
import { EN, VI } from "./dict";

describe("uiLangForCourse", () => {
  it("chỉ khoá tiếng Anh mới đổi sang giao diện en", () => {
    expect(uiLangForCourse("en")).toBe("en");
    expect(uiLangForCourse("EN")).toBe("en");
    expect(uiLangForCourse("en-US")).toBe("en");
    expect(uiLangForCourse("vi")).toBe("vi");
    expect(uiLangForCourse("ja")).toBe("vi");
    expect(uiLangForCourse("")).toBe("vi");
    expect(uiLangForCourse(null)).toBe("vi");
    expect(uiLangForCourse(undefined)).toBe("vi");
  });
});

describe("parseUiLang", () => {
  it("chỉ nhận en/vi", () => {
    expect(parseUiLang("en")).toBe("en");
    expect(parseUiLang("vi")).toBe("vi");
    expect(parseUiLang("fr")).toBeNull();
    expect(parseUiLang("")).toBeNull();
    expect(parseUiLang(null)).toBeNull();
  });
});

describe("resolveUiLang", () => {
  it("mặc định là vi khi không có gì", () => {
    expect(resolveUiLang({})).toBe("vi");
  });
  it("theo course.language khi chưa chọn tay", () => {
    expect(resolveUiLang({ courseLanguage: "en" })).toBe("en");
    expect(resolveUiLang({ courseLanguage: "vi" })).toBe("vi");
    expect(resolveUiLang({ cookie: "garbage", courseLanguage: "en" })).toBe("en");
  });
  it("lựa chọn tay (cookie) luôn thắng khoá học", () => {
    expect(resolveUiLang({ cookie: "vi", courseLanguage: "en" })).toBe("vi");
    expect(resolveUiLang({ cookie: "en", courseLanguage: "vi" })).toBe("en");
    expect(resolveUiLang({ cookie: "en" })).toBe("en");
  });
});

describe("translate", () => {
  const vi = { a: "Xin chào {name}", b: "Chỉ có vi" };
  const en: Partial<Record<keyof typeof vi, string>> = { a: "Hello {name}" };
  it("dịch theo ngôn ngữ và điền tham số", () => {
    expect(translate(vi, en, "en", "a", { name: "Lâm" })).toBe("Hello Lâm");
    expect(translate(vi, en, "vi", "a", { name: "Lâm" })).toBe("Xin chào Lâm");
  });
  it("chuỗi chưa dịch rơi về tiếng Việt, không hiện khoá thô", () => {
    expect(translate(vi, en, "en", "b")).toBe("Chỉ có vi");
  });
  it("khoá lạ trả về chính khoá; tham số thiếu giữ nguyên chỗ trống", () => {
    expect(translate(vi, en, "en", "zzz" as "a")).toBe("zzz");
    expect(translate(vi, en, "en", "a")).toBe("Hello {name}");
  });
});

describe("từ điển thật", () => {
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

  it("mọi khoá en đều có trong vi (không dịch khoá ma)", () => {
    const orphan = Object.keys(EN).filter((k) => !(k in VI));
    expect(orphan).toEqual([]);
  });

  it("chuỗi en giữ đúng bộ tham số {…} của chuỗi vi", () => {
    const bad = Object.entries(EN)
      .filter(([k, v]) => typeof v === "string" && placeholders(v) !== placeholders((VI as Record<string, string>)[k] ?? ""))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it("không có chuỗi rỗng", () => {
    expect(Object.entries(VI).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    expect(Object.entries(EN).filter(([, v]) => typeof v === "string" && !v.trim()).map(([k]) => k)).toEqual([]);
  });
});
