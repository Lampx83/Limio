import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { getOrgOverview, recordRiskListViewed } from "../centerOverview";
import { getOrgBoard } from "../centerBoard";
import { CourseAuthzError } from "../authz";
import { createCourse } from "../courses";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";
const TODAY = "2026-11-27";
const NOW = new Date(`${TODAY}T19:00:00+07:00`);
const at = (hhmm: string, day = TODAY) => new Date(`${day}T${hhmm}:00+07:00`);

async function user(tag: string) {
  return (await registerUser({ email: `${tag}-${randomUUID().slice(0, 6)}@example.com`, password: "password1234", displayName: tag }, BASE)).userId;
}

async function setup() {
  const org = await prisma.organization.create({ data: { code: `OV-${randomUUID().slice(0, 8)}`, name: "Trung tâm tổng quan", centerEnabled: true } });
  const other = await prisma.organization.create({ data: { code: `OV2-${randomUUID().slice(0, 8)}`, name: "Trung tâm khác", centerEnabled: true } });
  const owner = await user("owner");
  const orgAdmin = await user("orgadmin");
  const foreign = await user("foreign");
  const teacher = await user("gv");
  const idle = await user("gv-ranh");
  await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin } });
  await prisma.organizationAdmin.create({ data: { organizationId: other.id, userId: foreign } });
  const c = await createCourse(owner, { title: "HSK 2", description: "Khoá thử tổng quan.", slug: `ov-${randomUUID().slice(0, 6)}` });
  await prisma.course.update({ where: { id: c.courseId }, data: { organizationId: org.id } });
  await prisma.courseInstructor.create({ data: { courseId: c.courseId, userId: teacher, role: "non-editing-teacher" } });
  await prisma.courseInstructor.create({ data: { courseId: c.courseId, userId: idle, role: "non-editing-teacher" } });
  const sec = await prisma.courseSection.create({ data: { courseId: c.courseId, name: "Lớp tối", instructorId: teacher } });
  return { org, other, owner, orgAdmin, foreign, teacher, idle, courseId: c.courseId, sec };
}

async function enroll(courseId: string, sectionId: string, tag: string) {
  const userId = await user(tag);
  await prisma.enrollment.create({ data: { courseId, userId, sectionId, status: "active", courseVersion: 1 } });
  return userId;
}

describe("getOrgOverview", () => {
  it("OrgAdmin thấy tổng quan; người khác, kể cả OrgAdmin trường khác và chủ khoá, bị từ chối", async () => {
    const t = await setup();
    await expect(getOrgOverview(t.orgAdmin, t.org.id, TODAY, NOW)).resolves.toMatchObject({ organizationId: t.org.id });
    await expect(getOrgOverview(t.foreign, t.org.id, TODAY, NOW)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(getOrgOverview(t.owner, t.org.id, TODAY, NOW)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(getOrgOverview(t.teacher, t.org.id, TODAY, NOW)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("ngày không có buổi nào: mọi số bằng 0, không lỗi", async () => {
    const t = await setup();
    const o = await getOrgOverview(t.orgAdmin, t.org.id, TODAY, NOW);
    expect(o.todayCounts).toEqual({ total: 0, live: 0, upcoming: 0, held: 0, overdue: 0, cancelled: 0 });
    expect(o.alerts).toEqual({ noTeacher: 0, noCheckIn: 0, noAttendance: 0, clashes: 0 });
    expect(o.atRisk).toEqual([]);
  });

  it("thẻ hôm nay và cảnh báo khớp bảng điều phối (cùng định nghĩa)", async () => {
    const t = await setup();
    const mk = (s: string, e: string, extra: Record<string, unknown> = {}, day = TODAY) => prisma.classMeeting.create({ data: { sectionId: t.sec.id, startsAt: at(s, day), endsAt: at(e, day), ...extra } });
    await mk("18:00", "20:00", { room: "B2", plannedTeacherId: t.teacher, seq: 1 }); // đang diễn ra, chưa check-in
    await mk("20:30", "21:30", { room: "b2 ", plannedTeacherId: t.teacher, seq: 2 }); // sắp tới
    await mk("21:30", "22:30", { room: "C1", seq: 3 }); // chưa có GV... lớp có GV phụ trách nên có giáo viên
    await mk("09:00", "10:00", { status: "cancelled", seq: 4 });
    const o = await getOrgOverview(t.orgAdmin, t.org.id, TODAY, NOW);
    const board = await getOrgBoard(t.orgAdmin, t.org.id, { from: TODAY, to: TODAY }, NOW);
    const states = (s: string) => board.meetings.filter((m) => m.state === s).length;
    expect(o.todayCounts).toEqual({ total: board.meetings.length, live: states("live"), upcoming: states("upcoming"), held: states("held"), overdue: states("overdue"), cancelled: states("cancelled") });
    expect(o.todayCounts.live).toBe(1);
    expect(o.todayCounts.cancelled).toBe(1);
    expect(o.alerts.noCheckIn).toBe(board.meetings.filter((m) => m.flags.includes("no_checkin")).length);
    expect(o.alerts.noCheckIn).toBeGreaterThanOrEqual(1);
  });

  it("lớp: chuyên cần, buổi chưa điểm danh, sắp kết thúc; giáo viên: giờ dạy và chưa xếp", async () => {
    const t = await setup();
    const a = await enroll(t.courseId, t.sec.id, "hv-a");
    const b = await enroll(t.courseId, t.sec.id, "hv-b");
    // 5 buổi đã dạy (ngày 20..24) + 2 buổi tới = 7 buổi, còn 2 → sắp kết thúc
    const days = ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"];
    const held: string[] = [];
    for (const [i, d] of days.entries()) {
      const m = await prisma.classMeeting.create({ data: { sectionId: t.sec.id, startsAt: at("18:00", d), endsAt: at("20:00", d), plannedTeacherId: t.teacher, status: "held", closedAt: at("20:05", d), seq: i + 1 } });
      held.push(m.id);
    }
    for (const d of ["2026-11-28", "2026-11-29"]) await prisma.classMeeting.create({ data: { sectionId: t.sec.id, startsAt: at("18:00", d), endsAt: at("20:00", d), plannedTeacherId: t.teacher } });
    // A đi đủ 5 buổi; B vắng 3 buổi cuối (2 buổi đầu có mặt) → chuyên cần B = 2/5 = 40%, vắng liên tiếp 3
    for (const [i, id] of held.entries()) {
      await prisma.studentAttendance.create({ data: { meetingId: id, userId: a, status: "present" } });
      await prisma.studentAttendance.create({ data: { meetingId: id, userId: b, status: i < 2 ? "present" : "absent" } });
    }
    const o = await getOrgOverview(t.orgAdmin, t.org.id, TODAY, NOW);
    const cls = o.classes.find((c) => c.sectionId === t.sec.id)!;
    expect(cls).toMatchObject({ enrolled: 2, held: 5, total: 7, endingSoon: true, unmarked: 0 });
    expect(cls.attendanceRate).toBeCloseTo(7 / 10); // (5 + 2) / 10
    expect(cls.attendanceLow).toBe(false);

    expect(o.atRiskTotal).toBe(1);
    expect(o.atRisk[0]).toMatchObject({ userId: b, consecutive: 3, sectionName: "Lớp tối" });
    expect(o.atRisk[0]!.reasons).toContain("consecutive");

    const gv = o.teachers.find((x) => x.teacherId === t.teacher)!;
    expect(gv.hoursTaught).toBe(10);
    expect(gv.hoursPlanned).toBe(4);
    expect(gv.unassigned).toBe(false);
    const rảnh = o.teachers.find((x) => x.teacherId === t.idle)!;
    expect(rảnh.unassigned).toBe(true);
    // người chưa có buổi nào đứng đầu ("cần xếp lại")
    expect(o.teachers[0]!.teacherId).toBe(t.idle);
  });

  it("buổi đã dạy mà chưa điểm danh được đếm; học viên đã nghỉ lớp không vào danh sách liên hệ", async () => {
    const t = await setup();
    const a = await enroll(t.courseId, t.sec.id, "hv-a");
    const m1 = await prisma.classMeeting.create({ data: { sectionId: t.sec.id, startsAt: at("18:00", "2026-11-23"), endsAt: at("20:00", "2026-11-23"), status: "held", closedAt: at("20:05", "2026-11-23") } });
    const m2 = await prisma.classMeeting.create({ data: { sectionId: t.sec.id, startsAt: at("18:00", "2026-11-24"), endsAt: at("20:00", "2026-11-24"), status: "held", closedAt: at("20:05", "2026-11-24") } });
    await prisma.studentAttendance.create({ data: { meetingId: m1.id, userId: a, status: "absent" } });
    await prisma.studentAttendance.create({ data: { meetingId: m2.id, userId: a, status: "absent" } });
    await prisma.classMeeting.create({ data: { sectionId: t.sec.id, startsAt: at("18:00", "2026-11-25"), endsAt: at("20:00", "2026-11-25"), status: "held", closedAt: at("20:05", "2026-11-25") } }); // chưa điểm danh
    await prisma.classMeeting.create({ data: { sectionId: t.sec.id, startsAt: at("18:00", "2026-12-05"), endsAt: at("20:00", "2026-12-05") } }); // còn buổi tới: lớp đang chạy
    let o = await getOrgOverview(t.orgAdmin, t.org.id, TODAY, NOW);
    expect(o.classes.find((c) => c.sectionId === t.sec.id)!.unmarked).toBe(1);
    expect(o.atRisk.map((s) => s.userId)).toEqual([a]);
    await prisma.enrollment.updateMany({ where: { userId: a, sectionId: t.sec.id }, data: { status: "dropped" } });
    o = await getOrgOverview(t.orgAdmin, t.org.id, TODAY, NOW);
    expect(o.atRisk).toEqual([]);
  });

  it("hai trường không rò dữ liệu cho nhau", async () => {
    const a = await setup();
    const b = await setup();
    await prisma.classMeeting.create({ data: { sectionId: b.sec.id, startsAt: at("18:00"), endsAt: at("20:00"), plannedTeacherId: b.teacher, seq: 1 } });
    const o = await getOrgOverview(a.orgAdmin, a.org.id, TODAY, NOW);
    expect(o.todayCounts.total).toBe(0);
    expect(o.classes.some((c) => c.sectionId === b.sec.id)).toBe(false);
    expect(o.teachers.some((x) => x.teacherId === b.teacher)).toBe(false);
  });
});

describe("recordRiskListViewed", () => {
  it("tối đa một sự kiện mỗi người mỗi trường mỗi ngày; payload không có tên", async () => {
    const t = await setup();
    await recordRiskListViewed(t.orgAdmin, t.org.id, TODAY, 3);
    await recordRiskListViewed(t.orgAdmin, t.org.id, TODAY, 5);
    const ev = await prisma.learningEvent.findMany({ where: { userId: t.orgAdmin, eventType: LearningEventType.CenterRiskListViewed } });
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toEqual({ organizationId: t.org.id, rowCount: 3 });
  });
});
