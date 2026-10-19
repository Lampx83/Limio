import { describe, expect, it } from "vitest";
import { examTabsFor, resolveExamTab } from "@/lib/examTabs";

/** LANG L4.3 — bộ tab của trang sửa đề theo LOẠI đề (thường · vấn đáp · ngoại ngữ thi thử). */

describe("examTabsFor", () => {
  it("đề thường (viết): giữ nguyên Tổng quan · Nội dung — không có tab của thi thử", () => {
    expect(examTabsFor("written", false)).toEqual(["overview", "content"]);
  });
  it("đề vấn đáp: giữ nguyên Tổng quan · Tài liệu · Tổ chức thi", () => {
    expect(examTabsFor("oral", false)).toEqual(["overview", "materials", "organize"]);
  });
  it("đề ngoại ngữ (thi thử): Cấu trúc · Nội dung · Thang điểm · Luyện đề · Xem trước; KHÔNG có Tổ chức thi/Tài liệu", () => {
    const tabs = examTabsFor("written", true);
    expect(tabs).toEqual(["structure", "content", "scoring", "practice", "preview"]);
    expect(tabs).not.toContain("organize");
    expect(tabs).not.toContain("materials");
  });
});

describe("resolveExamTab", () => {
  it("tab hợp lệ với loại đề thì giữ nguyên", () => {
    expect(resolveExamTab("content", "written", false)).toBe("content");
    expect(resolveExamTab("scoring", "written", true)).toBe("scoring");
    expect(resolveExamTab("materials", "oral", false)).toBe("materials");
  });
  it("không có/không hợp lệ → tab đầu của loại đề (đề ngoại ngữ vào Cấu trúc)", () => {
    expect(resolveExamTab(undefined, "written", false)).toBe("overview");
    expect(resolveExamTab("zzz", "written", true)).toBe("structure");
    expect(resolveExamTab(undefined, "written", true)).toBe("structure");
  });
  it("link cũ vẫn dùng được, rơi về tab tương ứng (không lỗi, không trang trắng)", () => {
    expect(resolveExamTab("overview", "written", true)).toBe("structure"); // đề thi thử không còn Tổng quan riêng
    expect(resolveExamTab("content", "oral", false)).toBe("materials");
    expect(resolveExamTab("materials", "written", false)).toBe("content");
    expect(resolveExamTab("organize", "written", false)).toBe("overview");
    expect(resolveExamTab("structure", "written", false)).toBe("overview"); // tab ngoại ngữ trên đề thường
    expect(resolveExamTab("organize", "written", true)).toBe("structure");
  });
  it("nhận giá trị mảng của searchParams", () => {
    expect(resolveExamTab(["scoring", "content"], "written", true)).toBe("scoring");
  });
});
