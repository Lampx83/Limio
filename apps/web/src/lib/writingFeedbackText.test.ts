import { describe, expect, it } from "vitest";
import { CATEGORY_LABEL, describeWritingError } from "@/lib/writingFeedbackText";

describe("describeWritingError (G6b.2 — không thất bại lặng lẽ)", () => {
  it("hết ví token nói rõ là hết lượt AI của THÁNG và đường ra", () => {
    const t = describeWritingError("no_token_budget");
    expect(t).toMatch(/hết lượt AI của tháng/);
    expect(t).toMatch(/mua thêm|cấp lại/);
  });
  it("mỗi mã lỗi của G6 có lời nhắn riêng, khác lời nhắn mặc định", () => {
    const fallback = describeWritingError("???");
    for (const code of [
      "no_token_budget", "global_token_cap", "rate_limited", "text_empty", "text_too_long",
      "control_group", "not_language_course", "forbidden", "submission_not_found", "openai_not_configured", "openai_error", "unauthorized",
    ]) {
      expect(describeWritingError(code), code).not.toBe(fallback);
    }
  });
  it("lỗi AI hạ tầng nói rõ chưa bị trừ lượt", () => {
    expect(describeWritingError("openai_error")).toMatch(/chưa bị trừ/);
  });
  it("mọi danh mục lỗi có nhãn tiếng Việt", () => {
    for (const c of ["grammar", "vocabulary", "spelling", "word_order", "particle_or_measure", "punctuation", "cohesion", "register", "other"]) {
      expect(CATEGORY_LABEL[c]).toBeTruthy();
    }
  });
});
