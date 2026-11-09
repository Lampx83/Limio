import { describe, expect, it } from "vitest";
import { isLanguageMenuActive, languageMenuGroups, languageShellIsLearner } from "./languageMenu";

describe("languageMenu — học viên", () => {
  it("có ba mục theo Figma: Lộ trình của tôi, Thư viện giáo trình, Đã lưu & ghi chú", () => {
    const items = languageMenuGroups().flatMap((g) => g.items);
    expect(items.map((i) => i.label)).toEqual(["Lộ trình của tôi", "Thư viện giáo trình", "Đã lưu & ghi chú"]);
    expect(items.map((i) => i.href)).toEqual(["/language", "/language/thu-vien", "/me/notes"]);
  });

  it("không có mục chết: chưa đưa Lịch ôn tập vào vì chưa có trang", () => {
    const labels = languageMenuGroups().flatMap((g) => g.items.map((i) => i.label));
    expect(labels).not.toContain("Lịch ôn tập");
  });

  it("href không trùng nhau", () => {
    const hrefs = languageMenuGroups().flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("/language chỉ sáng ở đúng trang chủ, mục khác sáng cả ở trang con và bỏ query", () => {
    expect(isLanguageMenuActive("/language", "/language")).toBe(true);
    expect(isLanguageMenuActive("/language", "/language/practice")).toBe(false);
    expect(isLanguageMenuActive("/language", "/language/thu-vien")).toBe(false);
    expect(isLanguageMenuActive("/language/thu-vien", "/language/thu-vien?tab=saved")).toBe(true);
    expect(isLanguageMenuActive("/language/thu-vien", "/language")).toBe(false);
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
