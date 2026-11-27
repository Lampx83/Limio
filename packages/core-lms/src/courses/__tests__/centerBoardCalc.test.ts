import { describe, expect, it } from "vitest";
import {
  attendanceRate,
  classLifecycle,
  consecutiveAbsences,
  deriveCourseLevel,
  detectClashes,
  meetingDisplayState,
  meetingFlags,
  roomKey,
} from "../centerBoardCalc";

const T = (hhmm: string, day = "2026-11-27") => new Date(`${day}T${hhmm}:00+07:00`);

describe("meetingDisplayState (L0.1)", () => {
  const base = { startsAt: T("18:00"), endsAt: T("20:00") };
  it("ưu tiên huỷ › đã dạy › đang diễn ra › quá giờ › sắp tới", () => {
    expect(meetingDisplayState({ ...base, status: "cancelled", now: T("19:00") })).toBe("cancelled");
    expect(meetingDisplayState({ ...base, status: "held", now: T("19:00") })).toBe("held");
    expect(meetingDisplayState({ ...base, status: "planned", now: T("19:00") })).toBe("live");
    expect(meetingDisplayState({ ...base, status: "planned", now: T("20:00") })).toBe("overdue"); // đúng giờ kết thúc = đã qua
    expect(meetingDisplayState({ ...base, status: "planned", now: T("17:59") })).toBe("upcoming");
    expect(meetingDisplayState({ ...base, status: "planned", now: T("18:00") })).toBe("live"); // đúng giờ bắt đầu = đang diễn ra
  });
});

describe("meetingFlags (L0.2)", () => {
  const ok = { state: "upcoming" as const, hasExpectedTeacher: true, checkedIn: false, checkInFlags: [], attendanceMissing: false, startsAt: T("18:00"), thresholdMin: 15, now: T("12:00"), clash: { room: false, teacher: false } };
  it("buổi bình thường không cờ", () => expect(meetingFlags(ok)).toEqual([]));
  it("chưa có giáo viên: báo khi chưa dạy; đã dạy rồi thì thôi", () => {
    expect(meetingFlags({ ...ok, hasExpectedTeacher: false })).toEqual(["no_teacher"]);
    expect(meetingFlags({ ...ok, hasExpectedTeacher: false, state: "held" })).toEqual([]);
  });
  it("chưa check-in: chỉ sau giờ bắt đầu + ngưỡng", () => {
    const live = { ...ok, state: "live" as const };
    expect(meetingFlags({ ...live, now: T("18:15") })).toEqual([]); // đúng ngưỡng, chưa quá
    expect(meetingFlags({ ...live, now: T("18:16") })).toEqual(["no_checkin"]);
    expect(meetingFlags({ ...live, now: T("18:30"), checkedIn: true })).toEqual([]);
    expect(meetingFlags({ ...ok, state: "overdue", now: T("21:00") })).toEqual(["no_checkin"]);
    // buổi đã dạy mà không ai bấm "Bắt đầu buổi" vẫn tính (khớp đối chiếu C5.4)
    expect(meetingFlags({ ...ok, state: "held", now: T("21:00") })).toEqual(["no_checkin"]);
    expect(meetingFlags({ ...ok, state: "held", now: T("21:00"), checkedIn: true })).toEqual([]);
  });
  it("trễ, dạy thay, chưa điểm danh, trùng phòng/giáo viên", () => {
    expect(
      meetingFlags({ ...ok, state: "held", checkedIn: true, checkInFlags: ["late", "substitute"], attendanceMissing: true, clash: { room: true, teacher: true } }).sort(),
    ).toEqual(["late", "no_attendance", "room_clash", "substitute", "teacher_clash"].sort());
  });
  it("buổi huỷ không có cờ nào", () => expect(meetingFlags({ ...ok, state: "cancelled", hasExpectedTeacher: false, clash: { room: true, teacher: true } })).toEqual([]));
});

describe("roomKey (Q2)", () => {
  it("chuẩn hoá khoảng trắng và hoa thường; rỗng = chưa xếp phòng", () => {
    expect(roomKey("  Phòng   B2 ")).toBe("phòng b2");
    expect(roomKey("PHÒNG B2")).toBe(roomKey("phòng b2"));
    expect(roomKey("  ")).toBeNull();
    expect(roomKey(null)).toBeNull();
  });
});

describe("detectClashes", () => {
  const m = (id: string, s: string, e: string, room: string | null, teacherId: string | null, cancelled = false) => ({ id, startsAt: T(s), endsAt: T(e), room, teacherId, cancelled });
  it("trùng phòng (khác cách viết) và trùng giáo viên khi giờ giao nhau", () => {
    const r = detectClashes([m("a", "18:00", "20:00", "B2", "t1"), m("b", "19:00", "21:00", " b2 ", "t2"), m("c", "19:30", "21:00", "C1", "t1")]);
    expect(r.get("a")).toEqual({ room: true, teacher: true });
    expect(r.get("b")).toEqual({ room: true, teacher: false });
    expect(r.get("c")).toEqual({ room: false, teacher: true });
  });
  it("chạm đầu mút, buổi huỷ, chưa có phòng/giáo viên thì không tính là trùng", () => {
    const r = detectClashes([m("a", "18:00", "20:00", "B2", "t1"), m("b", "20:00", "22:00", "B2", "t1"), m("c", "18:30", "19:30", "B2", "t1", true), m("d", "18:30", "19:30", null, null), m("e", "18:30", "19:30", null, null)]);
    expect([...r.values()].every((v) => !v.room && !v.teacher)).toBe(true);
  });
});

describe("attendanceRate (L0.3)", () => {
  it("vắng có phép không vào mẫu số; chưa có buổi thì null", () => {
    expect(attendanceRate({ present: 6, late: 2, absent: 2 })).toBeCloseTo(0.8);
    expect(attendanceRate({ present: 0, late: 0, absent: 0 })).toBeNull();
  });
});

describe("consecutiveAbsences (L0.4)", () => {
  const r = (day: number, status: "present" | "late" | "absent" | "excused") => ({ startsAt: T("18:00", `2026-11-${String(day).padStart(2, "0")}`), status });
  it("đếm từ buổi gần nhất cho tới khi gặp buổi có mặt", () => {
    expect(consecutiveAbsences([r(1, "absent"), r(8, "present"), r(15, "absent"), r(22, "absent")])).toBe(2);
  });
  it("có phép bị bỏ qua: không cắt chuỗi và không cộng thêm", () => {
    expect(consecutiveAbsences([r(1, "present"), r(8, "absent"), r(15, "excused"), r(22, "absent")])).toBe(2);
  });
  it("trễ cắt chuỗi; không dữ liệu = 0", () => {
    expect(consecutiveAbsences([r(8, "absent"), r(15, "late")])).toBe(0);
    expect(consecutiveAbsences([])).toBe(0);
  });
});

describe("classLifecycle (L0.5)", () => {
  const m = (day: number, status: "planned" | "held" | "cancelled") => ({ startsAt: T("18:00", `2026-11-${String(day).padStart(2, "0")}`), endsAt: T("20:00", `2026-11-${String(day).padStart(2, "0")}`), status });
  it("chưa có buổi hoặc chỉ có buổi huỷ = chưa đặt lịch", () => {
    expect(classLifecycle([], T("12:00")).status).toBe("no_schedule");
    expect(classLifecycle([m(3, "cancelled")], T("12:00")).status).toBe("no_schedule");
  });
  it("planned / running / finished, tiến độ bỏ qua buổi huỷ, start-end theo buổi đầu và cuối", () => {
    const meetings = [m(3, "held"), m(10, "cancelled"), m(17, "planned"), m(24, "planned")];
    const lc = classLifecycle(meetings, T("12:00", "2026-11-12"));
    expect(lc).toMatchObject({ status: "running", held: 1, total: 3 });
    expect(lc.start).toEqual(T("18:00", "2026-11-03"));
    expect(lc.end).toEqual(T("20:00", "2026-11-24"));
    expect(classLifecycle(meetings, T("12:00", "2026-11-01")).status).toBe("planned");
    expect(classLifecycle([m(3, "held"), m(10, "held"), m(17, "cancelled")], T("12:00", "2026-12-30")).status).toBe("finished");
  });
  it("buổi dạy bù ở cuối kéo dài vòng đời", () => {
    expect(classLifecycle([m(3, "held"), m(30, "planned")], T("12:00", "2026-11-10")).end).toEqual(T("20:00", "2026-11-30"));
  });
});

describe("deriveCourseLevel (hàng theo trình độ)", () => {
  it("ưu tiên trình độ đầu ra của giáo trình gốc, rồi HSK trong tên, rồi CEFR", () => {
    expect(deriveCourseLevel({ packLevel: " HSK  3 ", title: "Bất kỳ", levelBand: "A2" })).toBe("HSK 3");
    expect(deriveCourseLevel({ title: "Tiếng Trung HSK 3.0 — Cấp 4 — Quyển 1" })).toBe("HSK 4");
    expect(deriveCourseLevel({ title: "Giáo trình HSK4 (3.0) - Quyển 1" })).toBe("HSK 4");
    expect(deriveCourseLevel({ title: "Tiếng Trung sơ cấp 1 (HSK 1)" })).toBe("HSK 1");
    expect(deriveCourseLevel({ title: "English for work", levelBand: "B1-B2" })).toBe("B1-B2");
  });
  it("không nhận ra thì null; HSK 3.0 một mình không phải cấp 3", () => {
    expect(deriveCourseLevel({ title: "Tiếng Trung giao tiếp" })).toBeNull();
    expect(deriveCourseLevel({ title: "Chương trình HSK 3.0 tổng quan" })).toBeNull();
    expect(deriveCourseLevel({ title: "x", levelBand: "  " })).toBeNull();
  });
});
