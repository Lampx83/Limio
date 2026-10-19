import { describe, expect, it } from "vitest";
import { DECK_LANGUAGES } from "@feedbackme/shared-types";
import { deckLanguageName, slideLanguageRule } from "../aiTutor/lectureLanguage";
import { buildOutlinePrompt } from "../aiTutor/lectureOutline";
import { buildSlidesPrompt } from "../aiTutor/lectureSlides";
import { buildSlideEditPrompt } from "../aiTutor/lectureSlideEdit";
import { buildSlideChatPrompt } from "../aiTutor/lectureSlideChat";

/** Slide viết theo ngôn ngữ của bài giảng — docs/tieu-chi/ngon-ngu-slide.md (L7–L10, L14). */

const doc = "Feedback is information about the gap between current performance and the learning goal. ".repeat(5);

describe("slideLanguageRule", () => {
  it("tiếng Việt giữ quy tắc thuật ngữ như cũ", () => {
    const r = slideLanguageRule("vi", "tài liệu dùng");
    expect(r).toContain("Viết bằng tiếng Việt");
    expect(r).toContain("giữ nguyên thuật ngữ tiếng Anh nếu tài liệu dùng");
  });
  it("ngôn ngữ khác: viết toàn bộ nội dung bằng ngôn ngữ đó, kể cả chữ mặc định trong chỉ dẫn", () => {
    const r = slideLanguageRule("en", "tài liệu dùng");
    expect(r).toContain("bằng tiếng Anh");
    expect(r).toContain("ghi chú giảng");
    expect(r).toMatch(/kể cả khi chỉ dẫn này viết bằng tiếng Việt/);
    expect(r).not.toContain("Viết bằng tiếng Việt");
  });
  it("chưa xác định: theo ngôn ngữ của nguồn, không rõ thì tiếng Việt", () => {
    for (const lang of [null, undefined, "xx"]) {
      const r = slideLanguageRule(lang, "tài liệu dùng");
      expect(r).toMatch(/cùng ngôn ngữ/);
      expect(r).toContain("tiếng Việt");
    }
  });
  it("mọi ngôn ngữ trong danh sách đều có tên gọi", () => {
    for (const l of DECK_LANGUAGES) expect(deckLanguageName(l.code)).toMatch(/^tiếng /);
  });
});

describe("bốn câu lệnh nhận ngôn ngữ của bài (L7)", () => {
  it("soạn dàn ý", () => {
    const base = { sourceText: doc, minutes: 30, minSlides: 16, maxSlides: 20 };
    expect(buildOutlinePrompt({ ...base, language: "en" }).system).toContain("bằng tiếng Anh");
    expect(buildOutlinePrompt({ ...base, language: "vi" }).system).toContain("Viết bằng tiếng Việt");
    expect(buildOutlinePrompt(base).system).toMatch(/cùng ngôn ngữ/);
  });

  it("tạo slide (cả khi cập nhật theo dàn ý)", () => {
    const base = {
      sourceText: doc,
      deckTitle: "Feedback in teaching",
      outline: [{ index: 0, kind: "content" as const, layout: "image", title: "What is feedback", points: ["Feedback closes the gap."] }],
      batch: [0],
    };
    expect(buildSlidesPrompt({ ...base, language: "en" }).system).toContain("bằng tiếng Anh");
    expect(buildSlidesPrompt({ ...base, language: "vi" }).system).toContain("Viết bằng tiếng Việt");
  });

  it("Nhờ AI sửa slide: slide trống vẫn viết theo ngôn ngữ của bài (L9)", () => {
    const base = { action: "custom" as const, instruction: "Viết slide giới thiệu phản hồi.", sourceText: doc, deckTitle: "Feedback", targetKey: "image", current: {} };
    expect(buildSlideEditPrompt({ ...base, language: "en" }).system).toContain("bằng tiếng Anh");
    expect(buildSlideEditPrompt({ ...base, language: "vi" }).system).toContain("Viết bằng tiếng Việt");
  });

  it("Nhờ AI hỏi đáp: trả lời giảng viên bằng tiếng Việt, bản nháp slide theo ngôn ngữ của bài (L8)", () => {
    const base = { sourceText: doc, deckTitle: "Feedback", targetKey: "image", current: { layout: "image", title: "What is feedback" }, history: [], message: "Viết lại ngắn hơn." };
    const { system } = buildSlideChatPrompt({ ...base, language: "en" });
    expect(system).toMatch(/"reply".*tiếng Việt.*thầy\/cô/s);
    expect(system).toContain("bằng tiếng Anh");
  });
});
