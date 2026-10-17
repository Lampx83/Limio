import { describe, expect, it } from "vitest";
import { validateContentPayload } from "../contentSchemas";

/**
 * Bài học văn bản — bảng màu + kiểu chữ của cả bài (`payload.look`, K4).
 * Không bắt buộc: bài cũ không có vẫn hợp lệ và hiển thị như trước.
 */
describe("richtext payload.look", () => {
  it("nhận bảng màu + kiểu chữ hợp lệ và giữ lại", () => {
    const out = validateContentPayload("richtext", {
      html: "<p>x</p>",
      look: { palette: "paper", font: "academic" },
    }) as { look?: unknown };
    expect(out.look).toEqual({ palette: "paper", font: "academic" });
  });

  it("bài cũ không có look vẫn hợp lệ", () => {
    expect(validateContentPayload("richtext", { html: "<p>x</p>" })).toEqual({ html: "<p>x</p>" });
  });

  it("từ chối bảng màu hoặc kiểu chữ lạ", () => {
    expect(() =>
      validateContentPayload("richtext", { html: "<p>x</p>", look: { palette: "neon", font: "modern" } }),
    ).toThrow();
    expect(() =>
      validateContentPayload("richtext", { html: "<p>x</p>", look: { palette: "limio", font: "comic" } }),
    ).toThrow();
  });
});
