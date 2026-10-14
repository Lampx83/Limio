import { describe, expect, it } from "vitest";
import { buildPracticeRequest, countInScope } from "@/lib/practiceSetup";

const sections = [
  { id: "s1", title: "Nghe", languageSkill: "listening", questionCount: 10, unansweredCount: 4, wrongCount: 2 },
  { id: "s2", title: "Đọc", languageSkill: "reading", questionCount: 20, unansweredCount: 20, wrongCount: 0 },
  { id: "s3", title: "Viết", languageSkill: "writing", questionCount: 2, unansweredCount: 1, wrongCount: 1 },
];

describe("buildPracticeRequest — dựng yêu cầu bắt đầu buổi luyện", () => {
  it("chọn kỹ năng và/hoặc phần → gửi đúng danh sách; mặc định kiểm tra từng câu bật, bấm giờ tắt", () => {
    const r = buildPracticeRequest({ skills: ["listening"], sectionIds: ["s3"], all: false, filter: "all", timed: false, checkEnabled: true });
    expect(r).toEqual({ skills: ["listening"], sectionIds: ["s3"], filter: "all", timed: false, checkEnabled: true });
  });
  it("cả đề → { all: true } và bỏ kỹ năng/phần", () => {
    const r = buildPracticeRequest({ skills: ["listening"], sectionIds: ["s1"], all: true, filter: "wrong", timed: true, checkEnabled: false });
    expect(r).toEqual({ all: true, filter: "wrong", timed: true, checkEnabled: false });
  });
  it("không chọn gì → null (nút Bắt đầu bị khoá, không gửi phạm vi rỗng)", () => {
    expect(buildPracticeRequest({ skills: [], sectionIds: [], all: false, filter: "all", timed: false, checkEnabled: true })).toBeNull();
  });
});

describe("countInScope — số câu sẽ vào buổi luyện để hiện trên nút", () => {
  it("cộng các phần được chọn qua kỹ năng hoặc id, không đếm trùng; theo bộ lọc", () => {
    expect(countInScope(sections, { skills: ["listening"], sectionIds: ["s1", "s3"], all: false, filter: "all" })).toBe(12);
    expect(countInScope(sections, { skills: [], sectionIds: [], all: true, filter: "all" })).toBe(32);
    expect(countInScope(sections, { skills: [], sectionIds: [], all: true, filter: "unanswered" })).toBe(25);
    expect(countInScope(sections, { skills: ["reading"], sectionIds: [], all: false, filter: "wrong" })).toBe(0);
    expect(countInScope(sections, { skills: [], sectionIds: [], all: false, filter: "all" })).toBe(0);
  });
});
