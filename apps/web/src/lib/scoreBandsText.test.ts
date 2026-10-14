import { describe, expect, it } from "vitest";
import { formatScoreBands, parseScoreBandsText } from "@/lib/scoreBandsText";

describe("parseScoreBandsText — giảng viên gõ bảng quy đổi mỗi dòng một khoảng", () => {
  it("'từ-đến: nhãn' mỗi dòng; chấp nhận khoảng trắng, dấu gạch/en-dash, số thập phân", () => {
    const r = parseScoreBandsText("0-9: 100–150\n10 - 19 : 150-200\n20.5-30: Cao");
    expect(r).toEqual({
      ok: true,
      bands: [
        { from: 0, to: 9, label: "100–150" },
        { from: 10, to: 19, label: "150-200" },
        { from: 20.5, to: 30, label: "Cao" },
      ],
    });
  });
  it("điểm đơn ('5: Trung bình') là khoảng from = to; dòng trống bị bỏ qua; rỗng = không có bảng", () => {
    expect(parseScoreBandsText("\n5: Trung bình\n\n")).toEqual({ ok: true, bands: [{ from: 5, to: 5, label: "Trung bình" }] });
    expect(parseScoreBandsText("  \n ")).toEqual({ ok: true, bands: [] });
  });
  it("sai cú pháp → báo đúng số dòng, không đoán", () => {
    expect(parseScoreBandsText("0-9: A\nabc")).toEqual({ ok: false, line: 2 });
    expect(parseScoreBandsText("0-9:")).toEqual({ ok: false, line: 1 });
    expect(parseScoreBandsText("a-b: X")).toEqual({ ok: false, line: 1 });
  });
});

describe("formatScoreBands — ngược lại để hiện trong ô soạn", () => {
  it("định dạng lại đúng dạng parse đọc được (khứ hồi)", () => {
    const bands = [{ from: 0, to: 9, label: "100–150" }, { from: 10, to: 10, label: "Một điểm" }];
    expect(formatScoreBands(bands)).toBe("0-9: 100–150\n10: Một điểm");
    expect(parseScoreBandsText(formatScoreBands(bands))).toEqual({ ok: true, bands });
    expect(formatScoreBands(null)).toBe("");
  });
});
