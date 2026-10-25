import { describe, expect, it } from "vitest";
import { SECTION_TABS, resolveSectionTab } from "./sectionTabs";

describe("resolveSectionTab — tab của trang lớp", () => {
  it("khoá dùng tính năng trung tâm: mặc định mở tab Lịch dạy; ?tab=hoc-vien mở tab Học viên", () => {
    expect(resolveSectionTab(undefined, true)).toBe("lich-day");
    expect(resolveSectionTab("lich-day", true)).toBe("lich-day");
    expect(resolveSectionTab("hoc-vien", true)).toBe("hoc-vien");
  });

  it("giá trị lạ hoặc mảng thì rơi về mặc định, không lỗi", () => {
    expect(resolveSectionTab("xyz", true)).toBe("lich-day");
    expect(resolveSectionTab(["hoc-vien", "lich-day"] as unknown as string, true)).toBe("lich-day");
    expect(resolveSectionTab("", true)).toBe("lich-day");
  });

  it("không dùng tính năng trung tâm: luôn là Học viên (không có tab), bất kể đường dẫn", () => {
    expect(resolveSectionTab(undefined, false)).toBe("hoc-vien");
    expect(resolveSectionTab("lich-day", false)).toBe("hoc-vien");
  });

  it("danh sách tab: Lịch dạy rồi Học viên, nhãn đúng", () => {
    expect(SECTION_TABS.map((t) => [t.id, t.label])).toEqual([["lich-day", "Lịch dạy"], ["hoc-vien", "Học viên"]]);
  });
});
