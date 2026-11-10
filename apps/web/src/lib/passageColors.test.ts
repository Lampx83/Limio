import { describe, expect, it } from "vitest";
import { PASSAGE_HIGHLIGHT_COLORS, PASSAGE_TEXT_COLORS, normalizeColor, passageHighlightColor, passageTextColor } from "./passageColors";

describe("normalizeColor", () => {
  it("đưa #abc, #AABBCC, rgb() và rgba() về #rrggbb thường; không hiểu thì null", () => {
    expect(normalizeColor("#ABC")).toBe("#aabbcc");
    expect(normalizeColor("#DC2626")).toBe("#dc2626");
    expect(normalizeColor("rgb(220, 38, 38)")).toBe("#dc2626");
    expect(normalizeColor("rgba(220,38,38,0.5)")).toBe("#dc2626");
    for (const bad of ["red", "url(x)", "#12", "rgb(1,2)", "red;background:url(x)", 5, null, undefined]) expect(normalizeColor(bad), String(bad)).toBeNull();
  });
});

describe("bảng màu", () => {
  it("chỉ nhận màu trong bảng (kể cả khi trình duyệt trả rgb)", () => {
    for (const c of PASSAGE_TEXT_COLORS) expect(passageTextColor(c.value)).toBe(c.value);
    for (const c of PASSAGE_HIGHLIGHT_COLORS) expect(passageHighlightColor(c.value)).toBe(c.value);
    expect(passageTextColor("rgb(220, 38, 38)")).toBe("#dc2626");
    expect(passageTextColor("#123456")).toBeNull();
    expect(passageHighlightColor("#dc2626")).toBeNull(); // màu chữ không phải màu tô
    expect(passageTextColor("#fef08a")).toBeNull(); // màu tô không phải màu chữ
  });
  it("mỗi bảng không có màu trùng", () => {
    expect(new Set(PASSAGE_TEXT_COLORS.map((c) => c.value)).size).toBe(PASSAGE_TEXT_COLORS.length);
    expect(new Set(PASSAGE_HIGHLIGHT_COLORS.map((c) => c.value)).size).toBe(PASSAGE_HIGHLIGHT_COLORS.length);
  });
});
