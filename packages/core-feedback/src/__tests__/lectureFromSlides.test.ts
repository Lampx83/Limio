import { describe, expect, it } from "vitest";
import { buildOutlinePrompt, fromSlidesRule, type LectureOutlineInput } from "../aiTutor/lectureOutline";

/** Soạn lại mạch một bài PowerPoint (tiêu chí P24, docs/tieu-chi/nhap-powerpoint.md): chỉ là lời nhắc, không gọi mô hình. */
const base: LectureOutlineInput = {
  sourceText: "Slide 1: Phản hồi\nSlide 2: Ba câu hỏi\n- Đích đến là gì?",
  minutes: 30,
  minSlides: 14,
  maxSlides: 18,
};

describe("buildOutlinePrompt với fromSlides", () => {
  it("nêu số slide gốc, luật from/basis, không bỏ ý, giữ tiêu đề gốc", () => {
    const { system } = buildOutlinePrompt({ ...base, fromSlides: 24 });
    expect(system).toContain("bài trình chiếu PowerPoint có sẵn");
    expect(system).toContain("gồm 24 slide");
    expect(system).toContain('"from"');
    expect(system).toContain('"basis"');
    expect(system).toContain("không bỏ ý nào");
    expect(system).toContain("chép đúng tiêu đề gốc");
    // P45: dòng dẫn mở phần, tài liệu tham khảo, hoạt động là slide tương tác.
    expect(system).toContain("slide mở phần");
    expect(system).toContain("tài liệu tham khảo");
    expect(system).toContain("là slide tương tác");
  });
  it("bài từ tài liệu thường không có luật này", () => {
    expect(buildOutlinePrompt(base).system).not.toContain('"from"');
    expect(fromSlidesRule(3)).toContain("gồm 3 slide");
  });
});
