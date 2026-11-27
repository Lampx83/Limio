import { describe, expect, it } from "vitest";
import { classAttendance, findAtRisk, hoursByTeacher, isEndingSoon, OVERVIEW_DEFAULTS, type AttendanceRow, type OverviewThresholds } from "../centerOverviewCalc";

const th: OverviewThresholds = { ...OVERVIEW_DEFAULTS };
const D = (day: number) => new Date(Date.UTC(2026, 10, day, 11, 0, 0));
const row = (userId: string, day: number, status: AttendanceRow["status"], sectionId = "S1"): AttendanceRow => ({ userId, sectionId, startsAt: D(day), status });
const WIN = D(1);

describe("findAtRisk", () => {
  it("vắng liên tiếp đủ ngưỡng thì vào danh sách, bị cắt bởi buổi có mặt thì không", () => {
    const rows = [row("a", 3, "present"), row("a", 5, "absent"), row("a", 7, "absent"), row("b", 3, "absent"), row("b", 5, "absent"), row("b", 7, "present")];
    const r = findAtRisk(rows, WIN, th);
    expect(r.map((x) => x.userId)).toEqual(["a"]);
    expect(r[0]).toMatchObject({ consecutive: 2, reasons: ["consecutive"], rate: null });
  });

  it("vắng có phép xen giữa không cắt chuỗi và không cộng vào chuỗi", () => {
    const rows = [row("a", 3, "absent"), row("a", 5, "excused"), row("a", 7, "absent")];
    expect(findAtRisk(rows, WIN, th)[0]).toMatchObject({ consecutive: 2 });
  });

  it("chuyên cần thấp chỉ tính khi đủ mẫu; đủ cả hai lý do thì MỘT dòng", () => {
    // 6 lượt: có 2, vắng 4 (2 vắng cuối liên tiếp) → 33%
    const rows = [row("a", 2, "present"), row("a", 3, "present"), row("a", 4, "absent"), row("a", 5, "absent"), row("a", 6, "absent"), row("a", 7, "absent")];
    const r = findAtRisk(rows, WIN, th);
    expect(r).toHaveLength(1);
    expect(r[0]!.reasons).toEqual(["consecutive", "low_rate"]);
    expect(r[0]!.rate).toBeCloseTo(2 / 6);
    // mẫu nhỏ (3 lượt) với chuyên cần thấp nhưng chỉ 1 vắng cuối: không gắn cờ
    expect(findAtRisk([row("b", 3, "absent"), row("b", 5, "present"), row("b", 7, "present")], WIN, th)).toHaveLength(0);
  });

  it("vắng ở hai lớp khác nhau tính riêng từng lớp", () => {
    const rows = [row("a", 3, "absent", "S1"), row("a", 5, "present", "S2"), row("a", 7, "absent", "S1")];
    const r = findAtRisk(rows, WIN, th);
    expect(r).toHaveLength(1);
    expect(r[0]!.sectionId).toBe("S1");
  });

  it("chuỗi vắng không bị cắt ở đầu cửa sổ chuyên cần; chuyên cần chỉ tính trong cửa sổ", () => {
    const rows = [row("a", 28, "absent"), row("a", 29, "absent")].map((r) => ({ ...r, startsAt: new Date(r.startsAt.getTime() - 40 * 86_400_000) }));
    const r = findAtRisk(rows, new Date(D(1).getTime() - 30 * 86_400_000), th);
    expect(r[0]).toMatchObject({ consecutive: 2, rate: null });
  });

  it("sắp nặng trước: vắng liên tiếp nhiều hơn đứng trước", () => {
    const rows = [row("a", 3, "absent"), row("a", 5, "absent"), row("b", 3, "absent"), row("b", 5, "absent"), row("b", 7, "absent")];
    expect(findAtRisk(rows, WIN, th).map((x) => x.userId)).toEqual(["b", "a"]);
  });
});

describe("hoursByTeacher", () => {
  const m = (id: string | null, s: number, e: number, status: "planned" | "held" | "cancelled") => ({ teacherId: id, startsAt: D(s), endsAt: new Date(D(s).getTime() + e * 3600_000), status });
  it("cộng giờ theo giáo viên, bỏ buổi huỷ và buổi ngoài khoảng, lọc theo trạng thái", () => {
    const list = [m("a", 3, 2, "held"), m("a", 4, 1.5, "planned"), m("a", 5, 2, "cancelled"), m("b", 3, 2, "held"), m(null, 3, 2, "held"), m("a", 20, 2, "held")];
    const range = { from: D(1), to: D(10) };
    expect(hoursByTeacher(list, range, "held").get("a")).toBe(2);
    expect(hoursByTeacher(list, range, "planned").get("a")).toBe(1.5);
    expect(hoursByTeacher(list, range).get("a")).toBe(3.5);
    expect(hoursByTeacher(list, range).has("null")).toBe(false);
  });
});

describe("isEndingSoon / classAttendance", () => {
  it("lớp đang chạy còn ≤ 3 buổi là sắp kết thúc; lớp đã xong hoặc chưa bắt đầu thì không", () => {
    expect(isEndingSoon({ status: "running", total: 24, held: 21 }, th)).toBe(true);
    expect(isEndingSoon({ status: "running", total: 24, held: 20 }, th)).toBe(false);
    expect(isEndingSoon({ status: "finished", total: 24, held: 24 }, th)).toBe(false);
    expect(isEndingSoon({ status: "planned", total: 3, held: 0 }, th)).toBe(false);
  });
  it("chuyên cần lớp: dưới 70% là thấp, mẫu nhỏ thì không kết luận", () => {
    expect(classAttendance({ present: 6, late: 0, absent: 4 }, th)).toMatchObject({ low: true, marks: 10 });
    expect(classAttendance({ present: 8, late: 1, absent: 1 }, th).low).toBe(false);
    expect(classAttendance({ present: 1, late: 0, absent: 3 }, th)).toMatchObject({ rate: null, low: false });
  });
});
