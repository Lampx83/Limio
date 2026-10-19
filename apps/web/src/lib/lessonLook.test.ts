import { describe, expect, it } from "vitest";
import { LESSON_PALETTE_KEYS } from "@feedbackme/shared-types";
import { LESSON_PALETTES, contrastRatio, lessonStyleVars } from "./lessonLook";

// K7: chữ đủ tương phản (từ 4,5:1) ở cả 6 bảng màu, cả sáng lẫn tối.
describe("bảng màu bài học — độ tương phản", () => {
  for (const key of LESSON_PALETTE_KEYS) {
    for (const mode of ["light", "dark"] as const) {
      const c = LESSON_PALETTES[key][mode];
      // Từng cặp chữ/nền thật sự xuất hiện trong lessonLook.css.
      const accents: Array<[string, string]> = LESSON_PALETTES[key].cycle?.[mode] ?? [[c.accent, c.soft]];

      it(`${key}/${mode}: chữ thường và chữ phụ trên nền bài và nền hộp`, () => {
        expect(contrastRatio(c.text, c.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(c.muted, c.bg)).toBeGreaterThanOrEqual(4.5);
        for (const [, soft] of accents) {
          expect(contrastRatio(c.text, soft)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(c.muted, soft)).toBeGreaterThanOrEqual(4.5);
        }
      });

      it(`${key}/${mode}: màu nhấn (tiêu đề phần, số lớn) trên nền bài và nền hộp`, () => {
        for (const [accent, soft] of accents) {
          expect(contrastRatio(accent, c.bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(accent, soft)).toBeGreaterThanOrEqual(4.5);
          // Số thứ tự trong vòng tròn ở bố cục Các bước: chữ màu nền trên nền màu nhấn.
          expect(contrastRatio(c.bg, accent)).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }
});

describe("lessonStyleVars", () => {
  it("đặt đủ bản sáng và tối cho mọi màu", () => {
    const vars = lessonStyleVars({ palette: "paper", font: "modern" }) as Record<string, string>;
    expect(vars["--lk-bg-l"]).toBe("#fbf7ef");
    expect(vars["--lk-accent-d"]).toBe("#f0b36c");
    expect(vars["--lk-c1-l"]).toBeUndefined();
  });

  it("Sinh động có 5 cặp màu xoay vòng theo mục", () => {
    const vars = lessonStyleVars({ palette: "vibrant", font: "modern" }) as Record<string, string>;
    for (let i = 1; i <= 5; i++) {
      expect(vars[`--lk-c${i}-l`]).toMatch(/^#/);
      expect(vars[`--lk-s${i}-d`]).toMatch(/^#/);
    }
  });
});
