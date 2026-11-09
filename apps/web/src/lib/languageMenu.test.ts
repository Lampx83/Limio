import { describe, expect, it } from "vitest";
import { isLanguageMenuActive, languageMenuGroups, languageShellIsLearner } from "./languageMenu";

describe("languageMenu — đợt 1 (học viên)", () => {
  it("có đúng hai mục theo Figma: Lộ trình của tôi và Đã lưu & ghi chú", () => {
    const items = languageMenuGroups().flatMap((g) => g.items);
    expect(items.map((i) => i.label)).toEqual(["Lộ trình của tôi", "Đã lưu & ghi chú"]);
    expect(items.map((i) => i.href)).toEqual(["/language", "/me/notes"]);
  });

  it("không có mục chết: chưa đưa Thư viện giáo trình và Lịch ôn tập vào", () => {
    const labels = languageMenuGroups().flatMap((g) => g.items.map((i) => i.label));
    expect(labels).not.toContain("Thư viện giáo trình");
    expect(labels).not.toContain("Lịch ôn tập");
  });

  it("href không trùng nhau", () => {
    const hrefs = languageMenuGroups().flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("/language chỉ sáng ở đúng trang chủ, mục khác sáng cả ở trang con và bỏ query", () => {
    expect(isLanguageMenuActive("/language", "/language")).toBe(true);
    expect(isLanguageMenuActive("/language", "/language/practice")).toBe(false);
    expect(isLanguageMenuActive("/me/notes", "/me/notes")).toBe(true);
    expect(isLanguageMenuActive("/me/notes", "/me/notes/abc?x=1")).toBe(true);
    expect(isLanguageMenuActive("/me/notes", "/me/notes-khac")).toBe(false);
    expect(isLanguageMenuActive("/me/notes", "/me/notes?tab=1")).toBe(true);
  });

  it("giảng viên và admin không dùng vỏ học viên", () => {
    expect(languageShellIsLearner("learner")).toBe(true);
    expect(languageShellIsLearner("instructor")).toBe(false);
    expect(languageShellIsLearner("admin")).toBe(false);
  });
});
