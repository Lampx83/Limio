import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  addCoInstructorByEmail,
  ensureTeachRoleForAssignment,
  getInstructorAssignments,
  listCourseInstructors,
  removeCoInstructor,
} from "../instructors";
import { CourseAuthzError, canGradeCourse } from "../authz";
import { createCourse, CourseError } from "../courses";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser(
    { email, password: "password1234", displayName: email },
    BASE,
  );
  return r.userId;
}

async function makeCourse(ownerId: string, slugBase: string) {
  const c = await createCourse(ownerId, {
    title: "Demo course",
    description: "A demo course for testing.",
    slug: slugBase,
  });
  return c.courseId;
}

describe("addCoInstructorByEmail", () => {
  it("AC: existing account is attached immediately, invited=false", async () => {
    const ownerId = await makeUser("owner1@example.com");
    const courseId = await makeCourse(ownerId, "co1");
    const coId = await makeUser("co1@example.com");

    const r = await addCoInstructorByEmail(
      ownerId,
      courseId,
      "co1@example.com",
      "co-instructor",
      BASE,
    );
    expect(r.invited).toBe(false);
    expect(r.userId).toBe(coId);

    const row = await prisma.courseInstructor.findUniqueOrThrow({
      where: { courseId_userId: { courseId, userId: coId } },
    });
    expect(row.role).toBe("co-instructor");

    const events = await prisma.learningEvent.findMany({
      where: { courseId, eventType: LearningEventType.CourseInstructorAdded },
    });
    expect(events).toHaveLength(1);
  });

  it("AC: unregistered email gets a no-password account created, invited=true", async () => {
    const ownerId = await makeUser("owner2@example.com");
    const courseId = await makeCourse(ownerId, "co2");

    const r = await addCoInstructorByEmail(
      ownerId,
      courseId,
      "brandnew@example.com",
      "co-instructor",
      BASE,
    );
    expect(r.invited).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: r.userId } });
    expect(user.email).toBe("brandnew@example.com");
    expect(user.passwordHash).toBeNull();

    const row = await prisma.courseInstructor.findUniqueOrThrow({
      where: { courseId_userId: { courseId, userId: r.userId } },
    });
    expect(row.role).toBe("co-instructor");
  });

  it("AC: adding the same email twice is idempotent — no duplicate row", async () => {
    const ownerId = await makeUser("owner3@example.com");
    const courseId = await makeCourse(ownerId, "co3");
    await makeUser("dup@example.com");

    await addCoInstructorByEmail(ownerId, courseId, "dup@example.com", "co-instructor", BASE);
    await addCoInstructorByEmail(ownerId, courseId, "dup@example.com", "co-instructor", BASE);

    const rows = await prisma.courseInstructor.findMany({ where: { courseId } });
    // owner + the one co-instructor, not two.
    expect(rows).toHaveLength(2);
  });

  it("AC: rejects invalid email format", async () => {
    const ownerId = await makeUser("owner4@example.com");
    const courseId = await makeCourse(ownerId, "co4");

    await expect(
      addCoInstructorByEmail(ownerId, courseId, "not-an-email", "co-instructor", BASE),
    ).rejects.toThrow(CourseError);
  });

  it("AC: rejects an unknown role value", async () => {
    const ownerId = await makeUser("owner4b@example.com");
    const courseId = await makeCourse(ownerId, "co4b");

    await expect(
      addCoInstructorByEmail(ownerId, courseId, "x@example.com", "super-admin", BASE),
    ).rejects.toThrow(CourseError);
  });

  it("AC: a co-instructor (non-owner) cannot add another co-instructor", async () => {
    const ownerId = await makeUser("owner5@example.com");
    const courseId = await makeCourse(ownerId, "co5");
    const coId = await makeUser("co5@example.com");
    await addCoInstructorByEmail(ownerId, courseId, "co5@example.com", "co-instructor", BASE);
    await makeUser("target5@example.com");

    await expect(
      addCoInstructorByEmail(coId, courseId, "target5@example.com", "co-instructor", BASE),
    ).rejects.toThrow(CourseAuthzError);
  });

  it("AC: assigns non-editing-teacher and teaching-assistant roles correctly", async () => {
    const ownerId = await makeUser("owner5c@example.com");
    const courseId = await makeCourse(ownerId, "co5c");
    const netId = await makeUser("net5c@example.com");
    const taId = await makeUser("ta5c@example.com");

    await addCoInstructorByEmail(ownerId, courseId, "net5c@example.com", "non-editing-teacher", BASE);
    await addCoInstructorByEmail(ownerId, courseId, "ta5c@example.com", "teaching-assistant", BASE);

    const netRow = await prisma.courseInstructor.findUniqueOrThrow({
      where: { courseId_userId: { courseId, userId: netId } },
    });
    const taRow = await prisma.courseInstructor.findUniqueOrThrow({
      where: { courseId_userId: { courseId, userId: taId } },
    });
    expect(netRow.role).toBe("non-editing-teacher");
    expect(taRow.role).toBe("teaching-assistant");
  });

  it("AC: cannot change the owner's own role through this path", async () => {
    const ownerId = await makeUser("owner5d@example.com");
    const courseId = await makeCourse(ownerId, "co5d");

    await expect(
      addCoInstructorByEmail(ownerId, courseId, "owner5d@example.com", "teaching-assistant", BASE),
    ).rejects.toThrow(CourseError);

    const row = await prisma.courseInstructor.findUniqueOrThrow({
      where: { courseId_userId: { courseId, userId: ownerId } },
    });
    expect(row.role).toBe("owner");
  });
});

describe("removeCoInstructor", () => {
  it("AC: owner removes a co-instructor", async () => {
    const ownerId = await makeUser("owner6@example.com");
    const courseId = await makeCourse(ownerId, "co6");
    const coId = await makeUser("co6@example.com");
    await addCoInstructorByEmail(ownerId, courseId, "co6@example.com", "co-instructor", BASE);

    await removeCoInstructor(ownerId, courseId, coId);

    const row = await prisma.courseInstructor.findUnique({
      where: { courseId_userId: { courseId, userId: coId } },
    });
    expect(row).toBeNull();

    const events = await prisma.learningEvent.findMany({
      where: { courseId, eventType: LearningEventType.CourseInstructorRemoved },
    });
    expect(events).toHaveLength(1);
  });

  it("AC: cannot remove the owner row through this path", async () => {
    const ownerId = await makeUser("owner7@example.com");
    const courseId = await makeCourse(ownerId, "co7");

    await expect(removeCoInstructor(ownerId, courseId, ownerId)).rejects.toThrow(
      CourseError,
    );
  });

  it("AC: a non-owner cannot remove anyone", async () => {
    const ownerId = await makeUser("owner8@example.com");
    const courseId = await makeCourse(ownerId, "co8");
    const coId = await makeUser("co8@example.com");
    await addCoInstructorByEmail(ownerId, courseId, "co8@example.com", "co-instructor", BASE);

    await expect(removeCoInstructor(coId, courseId, coId)).rejects.toThrow(
      CourseAuthzError,
    );
  });

  it("AC: removing an unattached userId throws instructor_not_found", async () => {
    const ownerId = await makeUser("owner9@example.com");
    const courseId = await makeCourse(ownerId, "co9");
    const strangerId = await makeUser("stranger9@example.com");

    await expect(
      removeCoInstructor(ownerId, courseId, strangerId),
    ).rejects.toThrow(CourseError);
  });
});

describe("listCourseInstructors", () => {
  it("AC: returns owner first, then co-instructors", async () => {
    const ownerId = await makeUser("owner10@example.com");
    const courseId = await makeCourse(ownerId, "co10");
    await makeUser("co10@example.com");
    await addCoInstructorByEmail(ownerId, courseId, "co10@example.com", "co-instructor", BASE);

    const rows = await listCourseInstructors(courseId);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.role).toBe("owner");
    expect(rows[1]?.role).toBe("co-instructor");
  });
});

describe("removeCoInstructor: bàn giao việc đang giao", () => {
  async function setup(tag: string) {
    const ownerId = await makeUser(`own-${tag}@example.com`);
    const courseId = await makeCourse(ownerId, `rm-${tag}`);
    const teacherId = await makeUser(`tea-${tag}@example.com`);
    const otherId = await makeUser(`oth-${tag}@example.com`);
    await addCoInstructorByEmail(ownerId, courseId, `tea-${tag}@example.com`, "non-editing-teacher", BASE);
    await addCoInstructorByEmail(ownerId, courseId, `oth-${tag}@example.com`, "non-editing-teacher", BASE);
    const section = await prisma.courseSection.create({ data: { courseId, name: `Lớp ${tag}`, instructorId: teacherId } });
    const schedule = await prisma.classSchedule.create({ data: { sectionId: section.id, startDate: new Date("2026-01-05"), totalMeetings: 4 } });
    await prisma.classScheduleSlot.create({ data: { scheduleId: schedule.id, weekday: 2, startTime: "18:30", durationMin: 120, plannedTeacherId: teacherId } });
    const now = new Date("2026-06-10T00:00:00Z");
    const mk = (days: number, status: "planned" | "held", teacher: string | null) =>
      prisma.classMeeting.create({
        data: {
          sectionId: section.id,
          startsAt: new Date(now.getTime() + days * 86400000),
          endsAt: new Date(now.getTime() + days * 86400000 + 7200000),
          status,
          plannedTeacherId: teacher,
        },
      });
    const past = await mk(-7, "held", teacherId);
    const future1 = await mk(3, "planned", teacherId);
    const future2 = await mk(10, "planned", teacherId);
    const futureOther = await mk(17, "planned", otherId);
    return { ownerId, courseId, teacherId, otherId, section, past, future1, future2, futureOther, now };
  }

  it("getInstructorAssignments đếm lớp, buổi sắp tới (không tính buổi đã dạy) và khung giờ", async () => {
    const t = await setup("a");
    const a = await getInstructorAssignments(t.courseId, t.teacherId, prisma, t.now);
    expect(a.sections.map((s) => s.id)).toEqual([t.section.id]);
    expect(a.upcomingMeetings).toBe(2);
    expect(a.slots).toBe(1);
  });

  it("gỡ không bàn giao: xoá quyền, để trống lớp/buổi sắp tới/khung giờ; buổi đã dạy và buổi của người khác giữ nguyên; ghi audit + event", async () => {
    const t = await setup("b");
    const r = await removeCoInstructor(t.ownerId, t.courseId, t.teacherId, {}, prisma, t.now);
    expect(r).toMatchObject({ handedOverTo: null, sections: 1, meetings: 2, slots: 1 });
    expect(await prisma.courseInstructor.findUnique({ where: { courseId_userId: { courseId: t.courseId, userId: t.teacherId } } })).toBeNull();
    expect((await prisma.courseSection.findUniqueOrThrow({ where: { id: t.section.id } })).instructorId).toBeNull();
    const get = (id: string) => prisma.classMeeting.findUniqueOrThrow({ where: { id } });
    expect((await get(t.future1.id)).plannedTeacherId).toBeNull();
    expect((await get(t.future2.id)).plannedTeacherId).toBeNull();
    expect((await get(t.past.id)).plannedTeacherId).toBe(t.teacherId); // lịch sử
    expect((await get(t.futureOther.id)).plannedTeacherId).toBe(t.otherId);
    expect(await prisma.classScheduleSlot.count({ where: { plannedTeacherId: t.teacherId } })).toBe(0);
    const audit = await prisma.auditLog.findMany({ where: { action: "course.instructor_removed", targetUserId: t.teacherId } });
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0]!.payload)).not.toContain("example.com");
    // người đã gỡ không còn quyền dạy
    expect(await canGradeCourse(t.teacherId, t.courseId)).toBe(false);
  });

  it("gỡ kèm bàn giao: lớp, buổi sắp tới và khung giờ chuyển cho người nhận", async () => {
    const t = await setup("c");
    const r = await removeCoInstructor(t.ownerId, t.courseId, t.teacherId, { handoverToUserId: t.otherId }, prisma, t.now);
    expect(r.handedOverTo).toBe(t.otherId);
    expect((await prisma.courseSection.findUniqueOrThrow({ where: { id: t.section.id } })).instructorId).toBe(t.otherId);
    expect((await prisma.classMeeting.findUniqueOrThrow({ where: { id: t.future1.id } })).plannedTeacherId).toBe(t.otherId);
    expect(await prisma.classScheduleSlot.count({ where: { plannedTeacherId: t.otherId } })).toBe(1);
  });

  it("người nhận bàn giao không có tên trong khoá (hoặc chính người bị gỡ) thì từ chối và không đổi gì", async () => {
    const t = await setup("d");
    const stranger = await makeUser("stranger-d@example.com");
    await expect(removeCoInstructor(t.ownerId, t.courseId, t.teacherId, { handoverToUserId: stranger }, prisma, t.now)).rejects.toThrow(CourseError);
    await expect(removeCoInstructor(t.ownerId, t.courseId, t.teacherId, { handoverToUserId: t.teacherId }, prisma, t.now)).rejects.toThrow(CourseError);
    expect(await prisma.courseInstructor.findUnique({ where: { courseId_userId: { courseId: t.courseId, userId: t.teacherId } } })).not.toBeNull();
    expect((await prisma.courseSection.findUniqueOrThrow({ where: { id: t.section.id } })).instructorId).toBe(t.teacherId);
  });

  it("OrgAdmin của tổ chức sở hữu khoá gỡ được; đồng giảng viên và OrgAdmin của tổ chức khác thì không", async () => {
    const t = await setup("e");
    const org = await prisma.organization.create({ data: { code: `ORG-E-${randomUUID().slice(0, 8)}`, name: "Trung tâm E" } });
    const otherOrg = await prisma.organization.create({ data: { code: `ORG-E2-${randomUUID().slice(0, 8)}`, name: "Trung tâm khác" } });
    await prisma.course.update({ where: { id: t.courseId }, data: { organizationId: org.id } });
    const orgAdmin = await makeUser("orgadmin-e@example.com");
    const foreignAdmin = await makeUser("foreign-e@example.com");
    const coId = await makeUser("co-e@example.com");
    await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin } });
    await prisma.organizationAdmin.create({ data: { organizationId: otherOrg.id, userId: foreignAdmin } });
    await addCoInstructorByEmail(t.ownerId, t.courseId, "co-e@example.com", "co-instructor", BASE);

    await expect(removeCoInstructor(coId, t.courseId, t.teacherId, {}, prisma, t.now)).rejects.toThrow(CourseAuthzError);
    await expect(removeCoInstructor(foreignAdmin, t.courseId, t.teacherId, {}, prisma, t.now)).rejects.toThrow(CourseAuthzError);
    await removeCoInstructor(orgAdmin, t.courseId, t.teacherId, {}, prisma, t.now);
    expect(await canGradeCourse(t.teacherId, t.courseId)).toBe(false);
  });
});

describe("ensureTeachRoleForAssignment", () => {
  it("khoá ngoại ngữ: xếp giáo viên chưa có tên trong khoá thì thêm làm GV không chỉnh sửa; đã có tên thì không đổi vai", async () => {
    const ownerId = await makeUser("own-f@example.com");
    const courseId = await makeCourse(ownerId, "ens-f");
    await prisma.course.update({ where: { id: courseId }, data: { languageMode: true } });
    const teacherId = await makeUser("tea-f@example.com");
    expect(await ensureTeachRoleForAssignment(ownerId, courseId, teacherId)).toBe(true);
    expect((await prisma.courseInstructor.findUniqueOrThrow({ where: { courseId_userId: { courseId, userId: teacherId } } })).role).toBe("non-editing-teacher");
    expect(await ensureTeachRoleForAssignment(ownerId, courseId, teacherId)).toBe(false);
    // chủ khoá giữ vai owner
    expect(await ensureTeachRoleForAssignment(ownerId, courseId, ownerId)).toBe(false);
    expect((await prisma.courseInstructor.findUniqueOrThrow({ where: { courseId_userId: { courseId, userId: ownerId } } })).role).toBe("owner");
  });

  it("khoá thường của tổ chức không bật trung tâm: giữ hành vi cũ (xếp lớp không cấp quyền); tổ chức bật trung tâm thì cấp", async () => {
    const ownerId = await makeUser("own-g@example.com");
    const courseId = await makeCourse(ownerId, "ens-g");
    const teacherId = await makeUser("tea-g@example.com");
    expect(await ensureTeachRoleForAssignment(ownerId, courseId, teacherId)).toBe(false);
    const org = await prisma.organization.create({ data: { code: `ORG-G-${randomUUID().slice(0, 8)}`, name: "TT G", centerEnabled: true } });
    await prisma.course.update({ where: { id: courseId }, data: { organizationId: org.id } });
    expect(await ensureTeachRoleForAssignment(ownerId, courseId, teacherId)).toBe(true);
  });
});
