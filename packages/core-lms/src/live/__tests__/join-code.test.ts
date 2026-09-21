import { describe, expect, it } from "vitest";
import { generateJoinCode, normalizeJoinCode } from "../present";

describe("mã tham gia phiên trình chiếu", () => {
  it("sinh mã 6 ký tự, không chứa ký tự dễ nhầm", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    }
  });

  it("chuẩn hoá chữ thường và khoảng trắng", () => {
    expect(normalizeJoinCode("  ab3xk9 ")).toBe("AB3XK9");
  });

  it("từ chối mã sai độ dài hoặc chứa ký tự dễ nhầm", () => {
    expect(normalizeJoinCode("ABC")).toBeNull();
    expect(normalizeJoinCode("ABCDEFG")).toBeNull();
    expect(normalizeJoinCode("AB0XK9")).toBeNull();
    expect(normalizeJoinCode("ABIXK9")).toBeNull();
  });
});
