import { describe, expect, it } from "vitest";
import { formatClock, progressPct } from "@/lib/audioClock";

describe("formatClock", () => {
  it("phút:giây, giây luôn 2 chữ số, phút không đệm 0", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(600)).toBe("10:00");
    expect(formatClock(3725)).toBe("62:05");
  });
  it("làm tròn xuống (không báo trước giờ chưa tới)", () => {
    expect(formatClock(9.99)).toBe("0:09");
  });
  it("giá trị chưa biết (NaN, Infinity, âm) hiện 0:00 thay vì NaN:NaN", () => {
    for (const v of [NaN, Infinity, -Infinity, -3]) expect(formatClock(v)).toBe("0:00");
  });
});

describe("progressPct", () => {
  it("tỉ lệ phần trăm, kẹp trong 0–100", () => {
    expect(progressPct(0, 13)).toBe(0);
    expect(progressPct(6.5, 13)).toBe(50);
    expect(progressPct(13, 13)).toBe(100);
    expect(progressPct(20, 13)).toBe(100);
    expect(progressPct(-1, 13)).toBe(0);
  });
  it("chưa biết độ dài (0, NaN, Infinity) thì 0%", () => {
    for (const d of [0, NaN, Infinity]) expect(progressPct(5, d)).toBe(0);
  });
});
