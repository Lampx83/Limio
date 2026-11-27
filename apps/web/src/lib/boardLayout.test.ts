import { describe, expect, it } from "vitest";
import { assignLanes, overlapsRange, timeToPct } from "./boardLayout";

const T = (hhmm: string, day = "2026-11-27") => new Date(`${day}T${hhmm}:00+07:00`);

describe("assignLanes (M1.5)", () => {
  it("khối giao giờ xuống làn dưới, khối nối tiếp dùng lại làn", () => {
    const b = [
      { startsAt: T("18:00"), endsAt: T("20:00") },
      { startsAt: T("19:00"), endsAt: T("21:00") },
      { startsAt: T("20:00"), endsAt: T("22:00") }, // chạm đầu mút buổi 1 → lại làn 0
    ];
    expect(assignLanes(b)).toEqual({ lanes: [0, 1, 0], laneCount: 2 });
    expect(assignLanes([])).toEqual({ lanes: [], laneCount: 1 });
  });
  it("không phụ thuộc thứ tự đầu vào", () => {
    const b = [
      { startsAt: T("19:00"), endsAt: T("21:00") },
      { startsAt: T("18:00"), endsAt: T("20:00") },
    ];
    expect(assignLanes(b).lanes).toEqual([1, 0]);
  });
});

describe("timeToPct / overlapsRange", () => {
  it("quy đổi và kẹp vào 0–100", () => {
    expect(timeToPct(T("12:00"), T("06:00"), T("18:00"))).toBe(50);
    expect(timeToPct(T("05:00"), T("06:00"), T("18:00"))).toBe(0);
    expect(timeToPct(T("23:00"), T("06:00"), T("18:00"))).toBe(100);
    expect(timeToPct(T("12:00"), T("12:00"), T("12:00"))).toBe(0);
  });
  it("giao khoảng xem nửa mở", () => {
    expect(overlapsRange(T("18:00"), T("20:00"), T("20:00"), T("22:00"))).toBe(false);
    expect(overlapsRange(T("18:00"), T("20:01"), T("20:00"), T("22:00"))).toBe(true);
  });
});

