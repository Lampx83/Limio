import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SLIDE_THEMES,
  SLIDE_THEME_GROUPS,
  SLIDE_THEME_IDS,
  isDarkTheme,
  layoutThemeClass,
  slideBgFor,
  slideThemeBg,
} from "./slideThemes";

const css = readFileSync(resolve(__dirname, "slideLayouts.css"), "utf8");
const VARS = ["--sbg", "--stext", "--smuted", "--sa", "--sa2", "--ssoft", "--ssoft2", "--scard", "--scardb", "--son", "--sok", "--sbad", "--sg", "--sgb"];

describe("giao diện slide", () => {
  it("mã giao diện không trùng và đủ 18 giao diện", () => {
    expect(new Set(SLIDE_THEME_IDS).size).toBe(SLIDE_THEMES.length);
    expect(SLIDE_THEMES).toHaveLength(18);
  });
  it("mỗi giao diện thuộc một nhóm có thật, và mỗi nhóm đều có giao diện", () => {
    const groups = new Set(SLIDE_THEME_GROUPS.map((g) => g.id));
    for (const t of SLIDE_THEMES) expect(groups.has(t.group)).toBe(true);
    for (const g of SLIDE_THEME_GROUPS) expect(SLIDE_THEMES.some((t) => t.group === g.id)).toBe(true);
    expect(SLIDE_THEME_GROUPS.map((g) => g.id)).toEqual(["basic", "pastel", "mono", "dark"]);
  });
  it("có nhóm Đơn sắc (Mono) với 4 giao diện", () => {
    expect(SLIDE_THEMES.filter((t) => t.group === "mono").map((t) => t.id)).toEqual(["monogray", "monoblue", "monogreen", "monoblack"]);
  });
  it("mỗi lớp bảng màu có khai báo trong slideLayouts.css và đủ biến màu bắt buộc", () => {
    for (const cls of new Set(SLIDE_THEMES.map((t) => t.cls))) {
      const m = new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`).exec(css);
      expect(m, `thiếu .${cls} trong slideLayouts.css`).not.toBeNull();
      for (const v of VARS) expect(m![1], `${cls} thiếu ${v}`).toContain(`${v}:`);
    }
  });
  it("giao diện tối: lớp có thêm lt-dark, chỉ slide bố cục mới dùng nền tối, slide khác rơi về nền Limio", () => {
    for (const t of SLIDE_THEMES) {
      expect(isDarkTheme(t.id)).toBe(t.dark);
      expect(layoutThemeClass(t.id).includes("lt-dark")).toBe(t.dark);
    }
    expect(slideBgFor("monoblack", false)).toBe(slideThemeBg("brand"));
    expect(slideBgFor("monoblack", true)).toBe(slideThemeBg("monoblack"));
    expect(slideBgFor("lavender", false)).toBe(slideThemeBg("lavender"));
  });
  it("giá trị lạ rơi về giao diện mặc định", () => {
    expect(layoutThemeClass("không có")).toBe("lt-brand");
    expect(isDarkTheme(undefined)).toBe(false);
    expect(slideThemeBg(null)).toBe(slideThemeBg("white"));
  });
});
