import { describe, expect, it } from "vitest";
import { CHECKIN_OPEN_BEFORE_MIN, DEFAULT_CHECKIN_THRESHOLD_MIN, checkInWindow, classifyCheckIn } from "../teacherCheckInCalc";

// Buổi 18:30–20:30 giờ VN, thứ ba 03/11/2026.
const START = new Date("2026-11-03T11:30:00.000Z");
const END = new Date("2026-11-03T13:30:00.000Z");
const at = (minFromStart: number) => new Date(START.getTime() + minFromStart * 60_000);
const base = { startsAt: START, endsAt: END, cancelled: false, expectedTeacherId: "T1", thresholdMin: 15 };

describe("checkInWindow — khi nào được bấm 'Bắt đầu buổi' (C5.1)", () => {
  it("mở trước giờ bắt đầu 30 phút, đóng khi buổi kết thúc", () => {
    expect(CHECKIN_OPEN_BEFORE_MIN).toBe(30);
    const w = checkInWindow(START, END);
    expect(w.opensAt).toEqual(at(-30));
    expect(w.closesAt).toEqual(END);
    expect(DEFAULT_CHECKIN_THRESHOLD_MIN).toBe(15);
  });
});

describe("classifyCheckIn — phân loại tính khi đọc (C5.4)", () => {
  const ci = (minIn: number, minOut: number | null = null, teacherId = "T1") => ({
    teacherId,
    checkedInAt: at(minIn),
    checkedOutAt: minOut === null ? null : at(minOut),
  });

  it.each([
    [-10, "on_time"], // đến sớm
    [0, "on_time"],
    [15, "on_time"], // đúng ngưỡng vẫn đúng giờ
    [16, "late"],
    [60, "late"],
  ])("vào lúc %d phút so với giờ bắt đầu → %s", (min, flag) => {
    const r = classifyCheckIn({ ...base, checkIn: ci(min), now: at(30) });
    expect(r.state).toBe("checked_in");
    expect(r.flags).toEqual([flag]);
    expect(r.minutesAfterStart).toBe(min);
  });

  it("ngưỡng theo tổ chức: ngưỡng 5 phút thì vào lúc +10 là trễ, ngưỡng 30 thì đúng giờ", () => {
    expect(classifyCheckIn({ ...base, thresholdMin: 5, checkIn: ci(10), now: at(30) }).flags).toEqual(["late"]);
    expect(classifyCheckIn({ ...base, thresholdMin: 30, checkIn: ci(10), now: at(30) }).flags).toEqual(["on_time"]);
  });

  it("kết thúc sớm: ra trước giờ kết thúc quá ngưỡng; ra trong ngưỡng hoặc muộn thì không", () => {
    // buổi dài 120 phút; ngưỡng 15 → ra từ phút 104 trở xuống là kết thúc sớm
    expect(classifyCheckIn({ ...base, checkIn: ci(0, 104), now: at(130) }).flags).toEqual(["on_time", "early_end"]);
    expect(classifyCheckIn({ ...base, checkIn: ci(0, 105), now: at(130) }).flags).toEqual(["on_time"]);
    expect(classifyCheckIn({ ...base, checkIn: ci(0, 125), now: at(130) }).flags).toEqual(["on_time"]);
    expect(classifyCheckIn({ ...base, checkIn: ci(0, 104), now: at(130) }).minutesBeforeEnd).toBe(16);
  });

  it("chưa kết thúc buổi (chưa có giờ ra) thì không bao giờ là kết thúc sớm", () => {
    const r = classifyCheckIn({ ...base, checkIn: ci(0), now: at(40) });
    expect(r.flags).toEqual(["on_time"]);
    expect(r.minutesBeforeEnd).toBeNull();
  });

  it("dạy thay: người bấm khác giáo viên dự kiến; có thể đi cùng trễ", () => {
    expect(classifyCheckIn({ ...base, checkIn: ci(0, null, "T2"), now: at(30) }).flags).toEqual(["on_time", "substitute"]);
    expect(classifyCheckIn({ ...base, checkIn: ci(40, null, "T2"), now: at(60) }).flags).toEqual(["late", "substitute"]);
  });

  it("buổi chưa xếp giáo viên (không có người dự kiến): bấm là bình thường, không phải dạy thay", () => {
    expect(classifyCheckIn({ ...base, expectedTeacherId: null, checkIn: ci(0, null, "T9"), now: at(30) }).flags).toEqual(["on_time"]);
  });

  it("không ai bấm: chưa qua giờ thì 'đang chờ'; qua giờ kết thúc thì 'không check-in'", () => {
    expect(classifyCheckIn({ ...base, checkIn: null, now: at(-60) })).toMatchObject({ state: "waiting", flags: [] });
    expect(classifyCheckIn({ ...base, checkIn: null, now: at(60) })).toMatchObject({ state: "waiting", flags: [] });
    expect(classifyCheckIn({ ...base, checkIn: null, now: at(120) })).toMatchObject({ state: "waiting", flags: [] }); // đúng giờ kết thúc: còn trong cửa sổ
    expect(classifyCheckIn({ ...base, checkIn: null, now: at(121) })).toMatchObject({ state: "no_check_in", flags: ["no_check_in"] });
  });

  it("buổi huỷ: không phân loại gì", () => {
    expect(classifyCheckIn({ ...base, cancelled: true, checkIn: null, now: at(500) })).toMatchObject({ state: "cancelled", flags: [] });
  });
});
