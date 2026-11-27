import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { getOrgBoard, getOrgClassTimeline } from "../centerBoard";
import { addCoInstructorByEmail } from "../instructors";
import { CourseAuthzError } from "../authz";
import { createCourse } from "../courses";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";
const T = (hhmm: string, day = "2026-11-27") => new Date(`${day}T${hhmm}:00+07:00`);
const RANGE = { from: "2026-11-23", to: "2026-11-29" };

async function user(tag: string) {
  return (await registerUser({ email: `${tag}-${randomUUID().slice(0, 6)}@example.com`, password: "password1234", displayName: tag }, BASE)).userId;
}

async function setup() {
  const org = await prisma.organization.create({ data: { code: `CB-${randomUUID().slice(0, 8)}`, name: "Trung tâm thử", centerEnabled: true } });
  const owner = await user("owner");
  const orgAdmin = await user("orgadmin");
  const teacherA = await user("tA");
  const teacherB = await user("tB");
  await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin } });
  const mkCourse = async (slug: string, ownerId: string) => {
    const c = await createCourse(ownerId, { title: `Khoá ${slug}`, description: "Khoá thử cho bảng điều phối.", slug: `${slug}-${randomUUID().slice(0, 6)}` });
    await prisma.course.update({ where: { id: c.courseId }, data: { organizationId: org.id } });
    return c.courseId;
  };
  const course1 = await mkCourse("c1", owner);
  const owner2 = await user("owner2");
  const course2 = await mkCourse("c2", owner2);
  const sec1 = await prisma.courseSection.create({ data: { courseId: course1, name: "Lớp A", instructorId: teacherA } });
  const sec2 = await prisma.courseSection.create({ data: { courseId: course2, name: "Lớp B" } });
  return { org, owner, owner2, orgAdmin, teacherA, teacherB, course1, course2, sec1, sec2 };
}

const mk = (sectionId: string, s: string, e: string, extra: Partial<{ room: string | null; plannedTeacherId: string | null; status: "planned" | "held" | "cancelled"; seq: number; closedAt: Date | null }> = {}, day = "2026-11-27") =>
  prisma.classMeeting.create({ data: { sectionId, startsAt: T(s, day), endsAt: T(e, day), ...extra } });

describe("getOrgBoard", () => {
  it("OrgAdmin thấy mọi buổi của tổ chức; trạng thái, cờ và trùng phòng đúng", async () => {
    const t = await setup();
    const now = T("19:00");
    const live = await mk(t.sec1.id, "18:00", "20:00", { room: "B2", plannedTeacherId: t.teacherA, seq: 1 }); // đang diễn ra, chưa check-in sau 15'
    const clash = await mk(t.sec2.id, "19:00", "21:00", { room: " b2 ", plannedTeacherId: t.teacherB, seq: 1 }); // trùng phòng
    const noTeacher = await mk(t.sec2.id, "21:30", "22:30", { room: "C1", seq: 2 }, "2026-11-27"); // sắp tới, chưa ai dạy
    const cancelled = await mk(t.sec1.id, "18:00", "20:00", { room: "B2", plannedTeacherId: t.teacherA, status: "cancelled" }, "2026-11-28");
    const board = await getOrgBoard(t.orgAdmin, t.org.id, RANGE, now);
    expect(board.scope).toBe("org");
    const byId = new Map(board.meetings.map((m) => [m.id, m]));
    expect(byId.get(live.id)).toMatchObject({ state: "live", sectionName: "Lớp A" });
    expect(byId.get(live.id)!.flags).toEqual(expect.arrayContaining(["no_checkin", "room_clash"]));
    expect(byId.get(clash.id)!.flags).toContain("room_clash");
    expect(byId.get(noTeacher.id)!.flags).toEqual(["no_teacher"]);
    expect(byId.get(cancelled.id)).toMatchObject({ state: "cancelled", flags: [] });
    // OrgAdmin không có tên trong khoá: xem được bảng nhưng KHÔNG mở được trang buổi/lớp (các trang đó kiểm quyền theo khoá)
    expect(board.meetings.every((m) => m.canManage === false)).toBe(true);
    // chủ khoá mở được buổi của khoá mình; Platform Admin mở được mọi buổi
    const asOwner = await getOrgBoard(t.owner, t.org.id, RANGE, now);
    expect(asOwner.meetings.every((m) => m.canManage)).toBe(true);
    const platform = await user("platform");
    const role = await prisma.role.findFirst({ where: { name: "admin" } });
    if (role) {
      await prisma.userRole.create({ data: { userId: platform, roleId: role.id } });
      expect((await getOrgBoard(platform, t.org.id, RANGE, now)).meetings.every((m) => m.canManage)).toBe(true);
    }
  });

  it("buổi chưa gán lấy giáo viên phụ trách lớp; chưa check-in thì không có người dạy thực tế", async () => {
    const t = await setup();
    const m = await mk(t.sec1.id, "18:00", "20:00", { room: "A1" });
    const board = await getOrgBoard(t.orgAdmin, t.org.id, RANGE, T("10:00"));
    const row = board.meetings.find((x) => x.id === m.id)!;
    expect(row.teacher?.id).toBe(t.teacherA);
    expect(row.actualTeacher).toBeNull();
    expect(row.flags).toEqual([]);
  });

  it("buổi đã kết thúc mà chưa điểm danh có cờ no_attendance", async () => {
    const t = await setup();
    const m = await mk(t.sec1.id, "08:00", "10:00", { status: "held", plannedTeacherId: t.teacherA, closedAt: T("10:05") });
    await prisma.teacherCheckIn.create({ data: { meetingId: m.id, teacherId: t.teacherA, checkedInAt: T("08:02") } });
    const board = await getOrgBoard(t.orgAdmin, t.org.id, RANGE, T("12:00"));
    expect(board.meetings.find((x) => x.id === m.id)).toMatchObject({ state: "held", flags: ["no_attendance"] });
  });

  it("chủ khoá chỉ thấy các khoá của mình (scope mine) và canManage đúng; đồng giảng viên cũng vậy", async () => {
    const t = await setup();
    await mk(t.sec1.id, "18:00", "20:00", { room: "A1" });
    await mk(t.sec2.id, "18:00", "20:00", { room: "A2" });
    const board = await getOrgBoard(t.owner, t.org.id, RANGE, T("10:00"));
    expect(board.scope).toBe("mine");
    expect(board.meetings.map((m) => m.sectionName)).toEqual(["Lớp A"]);
    expect(board.meetings[0]!.canManage).toBe(true);
  });

  it("từ chối: người chỉ dạy (không sửa), người ngoài, OrgAdmin của tổ chức khác", async () => {
    const t = await setup();
    const teacherOnly = await user("tonly");
    await prisma.courseInstructor.create({ data: { courseId: t.course1, userId: teacherOnly, role: "non-editing-teacher" } });
    const stranger = await user("stranger");
    const otherOrg = await prisma.organization.create({ data: { code: `CB2-${randomUUID().slice(0, 8)}`, name: "Trung tâm khác" } });
    const foreign = await user("foreign");
    await prisma.organizationAdmin.create({ data: { organizationId: otherOrg.id, userId: foreign } });
    for (const who of [teacherOnly, stranger, foreign]) {
      await expect(getOrgBoard(who, t.org.id, RANGE)).rejects.toThrow(CourseAuthzError);
      await expect(getOrgClassTimeline(who, t.org.id, RANGE)).rejects.toThrow(CourseAuthzError);
    }
  });

  it("không rò dữ liệu giữa hai tổ chức", async () => {
    const a = await setup();
    const b = await setup();
    await mk(a.sec1.id, "18:00", "20:00");
    await mk(b.sec1.id, "18:00", "20:00");
    const board = await getOrgBoard(a.orgAdmin, a.org.id, RANGE, T("10:00"));
    expect(board.meetings.every((m) => [a.course1, a.course2].includes(m.courseId))).toBe(true);
  });

  it("mỗi buổi và mỗi lớp mang trình độ của khoá: giáo trình gốc › HSK trong tên › CEFR", async () => {
    const t = await setup();
    await prisma.course.update({ where: { id: t.course1 }, data: { title: "Tiếng Trung HSK 3.0 — Cấp 4 — Quyển 1" } });
    await prisma.course.update({ where: { id: t.course2 }, data: { title: "English for work", levelBand: "B1-B2" } });
    await mk(t.sec1.id, "18:00", "20:00");
    await mk(t.sec2.id, "18:00", "20:00");
    const board = await getOrgBoard(t.orgAdmin, t.org.id, RANGE, T("10:00"));
    expect(board.meetings.map((m) => [m.sectionName, m.level]).sort()).toEqual([["Lớp A", "HSK 4"], ["Lớp B", "B1-B2"]]);
    const tl = await getOrgClassTimeline(t.orgAdmin, t.org.id, { from: "2026-11-01", to: "2027-01-31" }, T("12:00"));
    expect(tl.classes.find((c) => c.name === "Lớp A")!.level).toBe("HSK 4");
  });

  it("khoá chưa rõ trình độ thì level = null", async () => {
    const t = await setup();
    await mk(t.sec1.id, "18:00", "20:00");
    const board = await getOrgBoard(t.orgAdmin, t.org.id, RANGE, T("10:00"));
    expect(board.meetings[0]!.level).toBeNull();
  });

  it("khoảng quá dài bị từ chối", async () => {
    const t = await setup();
    await expect(getOrgBoard(t.orgAdmin, t.org.id, { from: "2025-01-01", to: "2026-12-31" })).rejects.toThrow();
  });
});

describe("getOrgClassTimeline", () => {
  it("mỗi lớp một vòng đời: tiến độ bỏ buổi huỷ, lớp chưa đặt lịch ở nhóm riêng, lớp mặc định bị bỏ qua", async () => {
    const t = await setup();
    await mk(t.sec1.id, "18:00", "20:00", { status: "held" }, "2026-11-10");
    await mk(t.sec1.id, "18:00", "20:00", { status: "cancelled" }, "2026-11-17");
    await mk(t.sec1.id, "18:00", "20:00", {}, "2026-12-01");
    await prisma.courseSection.create({ data: { courseId: t.course1, name: "Mặc định", isDefault: true } });
    const tl = await getOrgClassTimeline(t.orgAdmin, t.org.id, { from: "2026-11-01", to: "2027-01-31" }, T("12:00"));
    const a = tl.classes.find((c) => c.name === "Lớp A")!;
    expect(a.lifecycle).toMatchObject({ status: "running", held: 1, total: 2 });
    expect(a.teacher?.id).toBe(t.teacherA);
    expect(a.nextMeetingAt).toBe(T("18:00", "2026-12-01").toISOString());
    expect(tl.classes.find((c) => c.name === "Lớp B")!.lifecycle.status).toBe("no_schedule");
    expect(tl.classes.some((c) => c.name === "Mặc định")).toBe(false);
  });

  it("lớp đã kết thúc trước khoảng xem thì không hiện", async () => {
    const t = await setup();
    await mk(t.sec1.id, "18:00", "20:00", { status: "held" }, "2026-01-10");
    const tl = await getOrgClassTimeline(t.orgAdmin, t.org.id, { from: "2026-11-01", to: "2027-01-31" }, T("12:00"));
    expect(tl.classes.some((c) => c.name === "Lớp A")).toBe(false);
  });
});
