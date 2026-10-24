import { describe, expect, it } from "vitest";
import {
  addDays,
  generateMeetings,
  isoWeekday,
  overlaps,
  vnDateTime,
  vnDayKey,
  type SlotInput,
} from "../classScheduleCalc";

const slot = (weekday: number, startTime: string, durationMin = 120, extra: Partial<SlotInput> = {}): SlotInput => ({
  weekday,
  startTime,
  durationMin,
  room: null,
  plannedTeacherId: null,
  ...extra,
});

describe("ngày theo lịch Việt Nam", () => {
  it("isoWeekday: 1 = thứ hai … 7 = chủ nhật", () => {
    expect(isoWeekday("2026-11-02")).toBe(1); // thứ hai
    expect(isoWeekday("2026-11-03")).toBe(2);
    expect(isoWeekday("2026-11-08")).toBe(7); // chủ nhật
  });

  it("addDays qua cuối tháng và cuối năm", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });

  it("vnDateTime: 18:30 giờ Việt Nam là 11:30 UTC", () => {
    expect(vnDateTime("2026-11-03", "18:30").toISOString()).toBe("2026-11-03T11:30:00.000Z");
  });

  it("vnDayKey: 06:00 sáng Việt Nam vẫn là ngày hôm đó dù UTC còn là hôm trước", () => {
    const sixAm = vnDateTime("2026-11-07", "06:00"); // 2026-11-06T23:00:00Z
    expect(sixAm.toISOString()).toBe("2026-11-06T23:00:00.000Z");
    expect(vnDayKey(sixAm)).toBe("2026-11-07");
  });

  it("vnDayKey: 23:30 tối thứ bảy không bị đẩy sang chủ nhật", () => {
    expect(vnDayKey(vnDateTime("2026-11-07", "23:30"))).toBe("2026-11-07");
  });
});

describe("generateMeetings", () => {
  it("T3 + T5 18:30, 24 buổi: bắt đầu thứ ba 03/11/2026, buổi cuối thứ năm 21/01/2027", () => {
    const out = generateMeetings({
      startDay: "2026-11-03",
      need: 24,
      slots: [slot(2, "18:30"), slot(4, "18:30")],
    });
    expect(out).toHaveLength(24);
    expect(out[0]!.startsAt.toISOString()).toBe("2026-11-03T11:30:00.000Z");
    expect(out[1]!.startsAt.toISOString()).toBe("2026-11-05T11:30:00.000Z");
    expect(vnDayKey(out[23]!.startsAt)).toBe("2027-01-21");
    expect(out[0]!.endsAt.toISOString()).toBe("2026-11-03T13:30:00.000Z"); // 120 phút
  });

  it("kết quả luôn sắp theo thời gian dù khung giờ khai ngược thứ tự", () => {
    const out = generateMeetings({
      startDay: "2026-11-02",
      need: 6,
      slots: [slot(5, "09:00"), slot(1, "19:00"), slot(1, "08:00")],
    });
    const times = out.map((m) => m.startsAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // Thứ hai có hai khung: 08:00 trước 19:00.
    expect(out.slice(0, 3).map((m) => vnDayKey(m.startsAt))).toEqual(["2026-11-02", "2026-11-02", "2026-11-06"]);
  });

  it("mỗi buổi mang phòng và giáo viên của đúng khung sinh ra nó", () => {
    const out = generateMeetings({
      startDay: "2026-11-03",
      need: 4,
      slots: [slot(2, "18:30", 90, { room: "B2", plannedTeacherId: "t1" }), slot(4, "09:00", 60, { room: "A1", plannedTeacherId: "t2" })],
    });
    expect(out.map((m) => [m.room, m.plannedTeacherId])).toEqual([
      ["B2", "t1"],
      ["A1", "t2"],
      ["B2", "t1"],
      ["A1", "t2"],
    ]);
    expect(out[1]!.endsAt.getTime() - out[1]!.startsAt.getTime()).toBe(60 * 60_000);
  });

  it("ngày bắt đầu không khớp thứ nào thì buổi đầu là thứ khớp đầu tiên sau đó", () => {
    // 04/11/2026 là thứ tư; khung chỉ có thứ năm.
    const out = generateMeetings({ startDay: "2026-11-04", need: 1, slots: [slot(4, "18:30")] });
    expect(vnDayKey(out[0]!.startsAt)).toBe("2026-11-05");
  });

  it("bỏ qua thời điểm đã có buổi (occupied) và sinh bù buổi ở cuối", () => {
    const first = vnDateTime("2026-11-03", "18:30").getTime();
    const out = generateMeetings({
      startDay: "2026-11-03",
      need: 2,
      slots: [slot(2, "18:30")],
      occupied: new Set([first]),
    });
    expect(out.map((m) => vnDayKey(m.startsAt))).toEqual(["2026-11-10", "2026-11-17"]);
  });

  it("notBefore: không sinh buổi ở quá khứ khi áp lại kế hoạch", () => {
    const out = generateMeetings({
      startDay: "2026-11-03",
      notBefore: "2026-11-10",
      need: 2,
      slots: [slot(2, "18:30")],
    });
    expect(out.map((m) => vnDayKey(m.startsAt))).toEqual(["2026-11-10", "2026-11-17"]);
  });

  it("need = 0 hoặc không có khung giờ thì không sinh gì", () => {
    expect(generateMeetings({ startDay: "2026-11-03", need: 0, slots: [slot(2, "18:30")] })).toEqual([]);
    expect(generateMeetings({ startDay: "2026-11-03", need: 5, slots: [] })).toEqual([]);
  });

  it("có trần số ngày dò để không lặp vô hạn", () => {
    const out = generateMeetings({ startDay: "2026-11-03", need: 100_000, slots: [slot(2, "18:30")] });
    expect(out.length).toBeLessThan(200);
  });
});

describe("overlaps", () => {
  const t = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 3, h, m));
  it("hai khoảng chồng nhau", () => {
    expect(overlaps({ startsAt: t(10), endsAt: t(12) }, { startsAt: t(11), endsAt: t(13) })).toBe(true);
  });
  it("nối liền nhau (kết thúc đúng lúc buổi kia bắt đầu) thì không chồng", () => {
    expect(overlaps({ startsAt: t(10), endsAt: t(12) }, { startsAt: t(12), endsAt: t(14) })).toBe(false);
  });
  it("tách rời", () => {
    expect(overlaps({ startsAt: t(8), endsAt: t(9) }, { startsAt: t(12), endsAt: t(14) })).toBe(false);
  });
});
