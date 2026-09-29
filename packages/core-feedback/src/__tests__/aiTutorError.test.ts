import { describe, expect, it } from "vitest";
import { AiTutorError } from "../aiTutor/errors";

describe("AiTutorError — giữ lỗi gốc", () => {
  it("mang theo cause để tầng route nhận ra 429 của OpenAI", () => {
    const original = Object.assign(new Error("429 rate limit"), { status: 429 });
    const e = new AiTutorError("openai_error", original.message, original);
    expect(e.code).toBe("openai_error");
    expect(e.details).toBe("429 rate limit");
    expect((e as { cause?: unknown }).cause).toBe(original);
  });

  it("không có cause thì không đặt thuộc tính (hành vi cũ giữ nguyên)", () => {
    const e = new AiTutorError("rate_limited");
    expect("cause" in e).toBe(false);
  });
});
