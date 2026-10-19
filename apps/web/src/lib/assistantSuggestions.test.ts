import { describe, expect, it } from "vitest";
import { IDEA_QUESTION, MAX_SUGGESTIONS, allSuggestions, openCourseQuestion, suggestionsFor } from "./assistantSuggestions";
import { isTechnicalProbe } from "./teacherAssistantGuard";
import { selectGuides } from "./teacherAssistantGuide";

describe("suggestionsFor", () => {
  it("trang tổ chức thi gợi ý về link thi nhanh và danh sách thí sinh, luôn kèm câu hỏi 'nên làm gì'", () => {
    const s = suggestionsFor("/instructor/organize/quick");
    expect(s).toHaveLength(MAX_SUGGESTIONS);
    expect(s[0]).toMatch(/link thi nhanh/i);
    expect(s).toContain(IDEA_QUESTION);
    expect(s[s.length - 1]).toBe(IDEA_QUESTION);
  });

  it("mỗi nhóm trang cho gợi ý khác nhau", () => {
    const sets = ["/instructor/organize", "/instructor/exams", "/instructor/limio-live", "/instructor/assignments", "/instructor/courses/abc"].map((p) => suggestionsFor(p)[0]);
    expect(new Set(sets).size).toBe(sets.length);
  });

  it("trang không có nhóm riêng (trang chủ, trang lạ, rỗng) vẫn có đủ gợi ý chung, không trùng", () => {
    for (const p of ["/instructor/dashboard", "/instructor/trang-la", "", null, undefined]) {
      const s = suggestionsFor(p);
      expect(s).toHaveLength(MAX_SUGGESTIONS);
      expect(new Set(s).size).toBe(s.length);
    }
  });

  it("nhóm ít câu được bổ sung từ gợi ý chung cho đủ số lượng", () => {
    expect(suggestionsFor("/instructor/tournaments")).toHaveLength(MAX_SUGGESTIONS);
  });
});

describe("gợi ý mở khoá gần đây", () => {
  it("trang chủ (không nhóm riêng) có câu mở khoá đứng đầu, vẫn đủ số lượng và kết bằng câu 'nên làm gì'", () => {
    const s = suggestionsFor("/instructor/dashboard", "Thiết kế UI/UX");
    expect(s).toHaveLength(MAX_SUGGESTIONS);
    expect(s[0]).toBe('Mở khoá học "Thiết kế UI/UX"');
    expect(s[s.length - 1]).toBe(IDEA_QUESTION);
    expect(new Set(s).size).toBe(s.length);
  });

  it("trang có nhóm đủ câu riêng thì giữ câu của trang, không chen câu mở khoá", () => {
    const s = suggestionsFor("/instructor/organize", "Thiết kế UI/UX");
    expect(s.some((q) => q.startsWith("Mở khoá học"))).toBe(false);
  });

  it("chưa có khoá thì không có câu mở khoá", () => {
    expect(suggestionsFor("/instructor/dashboard", null).some((q) => q.startsWith("Mở khoá học"))).toBe(false);
    expect(openCourseQuestion("   ")).toBeNull();
  });

  it("tên khoá dài bị cắt có dấu …, tên có nhiều khoảng trắng được gọn lại", () => {
    const long = openCourseQuestion("Các công nghệ giáo dục tiên tiến và ứng dụng trí tuệ nhân tạo trong dạy học")!;
    expect(long).toMatch(/…"$/);
    expect(openCourseQuestion("Tiếng   Trung  III")).toBe('Mở khoá học "Tiếng Trung III"');
  });
});

describe("chất lượng của từng câu gợi ý", () => {
  const questions = allSuggestions().filter((q) => q !== IDEA_QUESTION);

  for (const q of questions) {
    it(`có hướng dẫn trả lời, không phải dò hỏi kỹ thuật, đủ ngắn: ${q}`, () => {
      expect(selectGuides(q).length, "không mục hướng dẫn nào khớp câu này").toBeGreaterThan(0);
      expect(isTechnicalProbe(q)).toBe(false);
      expect(q.length).toBeLessThanOrEqual(60);
    });
  }
});
