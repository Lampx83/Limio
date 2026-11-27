import { describe, expect, it } from "vitest";
import { concurrencyBuckets, weekdayName, axisX, blockSpan, buildRows, dayAxis, dayHourSpan, rangeAxis, vnDayKey, vnMinuteOfDay } from "./boardModel";

const T = (hhmm: string, day = "2026-11-27") => new Date(`${day}T${hhmm}:00+07:00`);

describe("giờ Việt Nam", () => {
  it("vnMinuteOfDay và vnDayKey không phụ thuộc múi giờ của máy", () => {
    expect(vnMinuteOfDay(T("18:30"))).toBe(18 * 60 + 30);
    expect(vnMinuteOfDay(T("00:05"))).toBe(5);
    expect(vnDayKey(T("23:59"))).toBe("2026-11-27");
    expect(vnDayKey(T("00:00", "2026-11-28"))).toBe("2026-11-28");
  });
});

describe("dayHourSpan (M1.1)", () => {
  it("mặc định 06–22; mở rộng khi có buổi ngoài khoảng", () => {
    expect(dayHourSpan([])).toEqual({ startHour: 6, endHour: 22 });
    expect(dayHourSpan([{ startsAt: T("07:00"), endsAt: T("09:00") }])).toEqual({ startHour: 6, endHour: 22 });
    expect(dayHourSpan([{ startsAt: T("05:30"), endsAt: T("07:00") }, { startsAt: T("21:00"), endsAt: T("22:30") }])).toEqual({ startHour: 5, endHour: 23 });
  });
});

describe("axisX / blockSpan — mức Ngày", () => {
  const axis = dayAxis(["2026-11-27"], 6, 22, () => "");
  it("giữa trưa nằm đúng giữa trục 06–18", () => {
    const a = dayAxis(["2026-11-27"], 6, 18, () => "");
    expect(axisX(a, T("12:00"))).toBe(50);
  });
  it("ngoài trục là null; khối được cắt vào trục", () => {
    expect(axisX(axis, T("05:00"))).toBeNull();
    const s = blockSpan(axis, T("18:00"), T("20:00"))!;
    expect(s.left).toBeCloseTo((12 / 16) * 100);
    expect(s.width).toBeCloseTo((2 / 16) * 100);
    expect(blockSpan(axis, T("22:30"), T("23:30"))).toBeNull();
    const clipped = blockSpan(axis, T("21:00"), T("23:00"))!;
    expect(clipped.left + clipped.width).toBeCloseTo(100);
  });
});

describe("blockSpan — mức Tuần", () => {
  const days = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"];
  const axis = dayAxis(days, 6, 22, () => "");
  it("khối đặt vào đúng cột ngày của giờ bắt đầu", () => {
    const s = blockSpan(axis, T("06:00", "2026-11-25"), T("14:00", "2026-11-25"))!;
    expect(s.left).toBeCloseTo((2 / 7) * 100);
    expect(s.width).toBeCloseTo((0.5 / 7) * 100);
    expect(blockSpan(axis, T("10:00", "2026-12-05"), T("11:00", "2026-12-05"))).toBeNull();
  });
});

describe("rangeAxis — mức Kỳ", () => {
  it("một đoạn liền; vòng đời lớp tính theo ngày", () => {
    const axis = rangeAxis("2026-11-01", "2026-11-30"); // 30 ngày
    const s = blockSpan(axis, T("00:00", "2026-11-16"), T("00:00", "2026-11-21"))!;
    expect(s.left).toBeCloseTo((15 / 30) * 100);
    expect(s.width).toBeCloseTo((5 / 30) * 100);
    expect(axisX(axis, T("12:00", "2026-11-01"))).toBeCloseTo((0.5 / 30) * 100);
  });
});

describe("buildRows", () => {
  const mk = (id: string, s: string, e: string, room: string | null) => ({ id, startsAt: T(s), endsAt: T(e), room });
  const keyOf = (x: { room: string | null }) => (x.room ? { key: x.room.toLowerCase(), label: x.room, pinned: false } : { key: "_none", label: "Chưa xếp phòng", pinned: true });
  it("gom theo khoá, ghim hàng cảnh báo lên đầu, sắp còn lại theo nhãn; xếp làn trong hàng", () => {
    const rows = buildRows([mk("1", "18:00", "20:00", "B2"), mk("2", "19:00", "21:00", "B2"), mk("3", "18:00", "20:00", "A1"), mk("4", "18:00", "20:00", null)], keyOf);
    expect(rows.map((r) => r.label)).toEqual(["Chưa xếp phòng", "A1", "B2"]);
    const b2 = rows.find((r) => r.label === "B2")!;
    expect(b2.laneCount).toBe(2);
    expect(b2.items.map((x) => x.lane)).toEqual([0, 1]);
  });
});

describe("weekdayName", () => {
  it("bảng cố định theo ngày", () => {
    expect(weekdayName("2026-11-27")).toBe("Thứ 6");
    expect(weekdayName("2026-11-29")).toBe("Chủ nhật");
    expect(weekdayName("2026-11-23")).toBe("Thứ 2");
  });
});

describe("buildRows — hàng theo trình độ", () => {
  const mk = (id: string, level: string | null) => ({ id, startsAt: T("18:00"), endsAt: T("20:00"), level });
  const keyOf = (x: { level: string | null }) => (x.level ? { key: x.level, label: x.level, pinned: false } : { key: "_none", label: "Chưa rõ trình độ", pinned: false, last: true });
  it("sắp theo số (HSK 2 trước HSK 10), 'chưa rõ' xuống cuối", () => {
    const rows = buildRows([mk("1", "HSK 10"), mk("2", null), mk("3", "HSK 2"), mk("4", "HSK 3"), mk("5", "HSK 3")], keyOf);
    expect(rows.map((r) => r.label)).toEqual(["HSK 2", "HSK 3", "HSK 10", "Chưa rõ trình độ"]);
    expect(rows.find((r) => r.label === "HSK 3")!.items).toHaveLength(2);
  });
});

describe("concurrencyBuckets (nhiều lớp song song buổi tối)", () => {
  const seg = { from: T("18:00"), to: T("22:00") };
  it("đếm số buổi giao với từng ô 30 phút; ô nửa mở", () => {
    const items = [
      { startsAt: T("18:00"), endsAt: T("19:30") },
      { startsAt: T("18:30"), endsAt: T("20:00") },
      { startsAt: T("19:00"), endsAt: T("20:00") },
    ];
    const r = concurrencyBuckets(items, seg);
    expect(r.counts).toEqual([1, 2, 3, 2, 0, 0, 0, 0]);
    expect(r.peak).toBe(3);
    expect(r.peakIndex).toBe(2);
  });
  it("buổi ngoài đoạn không tính; kết thúc đúng ranh giới không lấn sang ô sau", () => {
    const r = concurrencyBuckets([{ startsAt: T("16:00"), endsAt: T("18:00") }, { startsAt: T("22:00"), endsAt: T("23:00") }, { startsAt: T("21:30"), endsAt: T("22:00") }], seg);
    expect(r.counts).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });
  it("không có buổi: peak 0", () => expect(concurrencyBuckets([], seg).peak).toBe(0));
});
