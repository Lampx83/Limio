import { describe, expect, it } from "vitest";
import { isLanguageMenuActive, languageMenuGroups } from "@/lib/languageMenu";

/** LANG L2.2 / L2.3 — menu của vỏ Limio Language. */

const flat = (role: "teacher" | "student") => languageMenuGroups(role).flatMap((g) => g.items);

describe("languageMenuGroups", () => {
  it("L2.2: menu giảng viên đúng 5 mục đã chốt", () => {
    expect(flat("teacher").map((i) => i.label)).toEqual([
      "Tổng quan",
      "Khoá ngoại ngữ",
      "Đề thi (thi thử & luyện đề)",
      "Chờ duyệt / chấm",
      "Token AI",
    ]);
  });
  it("L2.3: menu học viên đúng 6 mục", () => {
    expect(flat("student").map((i) => i.label)).toEqual([
      "Tổng quan",
      "Khoá của tôi",
      "Luyện thi",
      "Hồ sơ kỹ năng",
      "Thẻ ôn từ",
      "Token AI",
    ]);
  });
  it("mọi liên kết là đường dẫn nội bộ, không trùng nhau trong một menu", () => {
    for (const role of ["teacher", "student"] as const) {
      const hrefs = flat(role).map((i) => i.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      for (const h of hrefs) expect(h).toMatch(/^\/[a-z]/);
    }
  });
  it("không còn các nhóm của LMS thường (Limio-Live, Vấn đáp AI, Đấu trường...)", () => {
    const all = JSON.stringify(languageMenuGroups("teacher")) + JSON.stringify(languageMenuGroups("student"));
    for (const s of ["Limio-Live", "Vấn đáp", "Đấu trường", "Gameshow", "Padlet"]) expect(all).not.toContain(s);
  });
  it("mục Tổng quan luôn là mục đầu và trỏ /language", () => {
    for (const role of ["teacher", "student"] as const) {
      expect(flat(role)[0]).toMatchObject({ label: "Tổng quan", href: "/language" });
    }
  });
});

describe("isLanguageMenuActive", () => {
  it("/language chỉ sáng khi đúng trang chủ, không sáng ở trang con", () => {
    expect(isLanguageMenuActive("/language", "/language")).toBe(true);
    expect(isLanguageMenuActive("/language", "/language/courses")).toBe(false);
  });
  it("mục khác sáng ở chính nó và trang con, không nhầm tiền tố gần giống", () => {
    expect(isLanguageMenuActive("/language/exams", "/language/exams")).toBe(true);
    expect(isLanguageMenuActive("/language/exams", "/language/exams/new")).toBe(true);
    expect(isLanguageMenuActive("/language/exams", "/language/examsx")).toBe(false);
    expect(isLanguageMenuActive("/me/skills", "/me/skills?tab=1")).toBe(true);
  });
});

import { languageShellRole } from "@/lib/languageMenu";

describe("languageShellRole — vỏ nào cho vai đang chọn", () => {
  it("giảng viên và admin → menu giảng viên; còn lại → học viên", () => {
    expect(languageShellRole("instructor")).toBe("teacher");
    expect(languageShellRole("admin")).toBe("teacher");
    expect(languageShellRole("learner")).toBe("student");
    expect(languageShellRole("mentor")).toBe("student");
    expect(languageShellRole("")).toBe("student");
  });
});
