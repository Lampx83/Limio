import { describe, expect, it } from "vitest";
import { M4A_COPY, M4A_COURSES, resolveM4aLang } from "../micro4asia";

describe("trang MICRO4ASIA", () => {
  it("có đúng sáu vi tín chỉ, slug không trùng", () => {
    expect(M4A_COURSES).toHaveLength(6);
    expect(new Set(M4A_COURSES.map((c) => c.slug)).size).toBe(6);
  });

  it("mọi vi tín chỉ có đủ chữ cả hai ngôn ngữ", () => {
    for (const c of M4A_COURSES) {
      for (const lang of ["en", "vi"] as const) {
        expect(c.topic[lang].trim(), `${c.slug} topic ${lang}`).not.toBe("");
        expect(c.outcome[lang].trim(), `${c.slug} outcome ${lang}`).not.toBe("");
      }
    }
  });

  it("ba khoá đã có trên Limio dùng đúng slug của khoá", () => {
    const slugs = M4A_COURSES.map((c) => c.slug);
    expect(slugs).toContain("programming-for-data-science");
    expect(slugs).toContain("fundamental-of-machine-learning");
    expect(slugs).toContain("mathematical-foundations-for-data-science");
  });

  it("hai bản chữ có cùng số nguyên tắc và số bước", () => {
    expect(M4A_COPY.vi.principles).toHaveLength(M4A_COPY.en.principles.length);
    expect(M4A_COPY.vi.steps).toHaveLength(M4A_COPY.en.steps.length);
  });

  it("không đưa thông tin nội bộ (kinh phí) lên trang công khai", () => {
    const all = JSON.stringify([M4A_COURSES, M4A_COPY.en, M4A_COPY.vi]).toLowerCase();
    expect(all).not.toMatch(/vnđ|vnd|kinh phí|budget/);
  });

  it("resolveM4aLang mặc định tiếng Anh, chỉ nhận vi khi được yêu cầu", () => {
    expect(resolveM4aLang(undefined)).toBe("en");
    expect(resolveM4aLang("fr")).toBe("en");
    expect(resolveM4aLang("vi")).toBe("vi");
    expect(resolveM4aLang(["vi", "en"])).toBe("vi");
  });
});
