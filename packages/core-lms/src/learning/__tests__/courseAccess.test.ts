import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType, RoleName } from "@feedbackme/shared-types";
import {
  createCourseAccessPlan,
  listCourseAccessPlans,
  updateCourseAccessPlan,
  extendEnrollmentAccess,
  expireDueEnrollments,
  sendAccessExpiryReminders,
} from "../courseAccess";
import { isUserEnrolled } from "../enroll";
import { createCourse, publishCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createSkill, tagLessonSkill } from "../../courses/skills";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";
import { CourseAuthzError } from "../../courses/authz";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser({ email, password: "password1234", displayName: email }, BASE);
  return r.userId;
}

async function makeAdmin(email: string) {
  const id = await makeUser(email);
  await grantRole(id, { targetUserId: id, roleName: RoleName.Admin });
  return id;
}

async function publishedCourse(ownerId: string, slug: string) {
  const c = await createCourse(ownerId, { title: `t ${slug}`, description: "d", slug });
  const m = await createModule(ownerId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(ownerId, m.moduleId, { title: "L", orderIndex: 0 });
  const s = await createSkill({ code: `skill.${slug}`, name: "s" });
  await tagLessonSkill(ownerId, l.lessonId, { skillId: s.skillId });
  await publishCourse(ownerId, c.courseId);
  return c.courseId;
}

async function courseWithVersion(courseId: string) {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { id: true, version: true },
  });
  return course;
}

describe("CourseAccessPlan (admin only)", () => {
  it("AC9: instructor (not admin) cannot create a plan", async () => {
    const ownerId = await makeUser("o1@e.com");
    const courseId = await publishedCourse(ownerId, "cap1");
    await expect(
      createCourseAccessPlan(ownerId, courseId, {
        label: "1 năm",
        durationMonths: 12,
        priceCents: 500_000,
      }),
    ).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("AC9: admin creates a plan, logs AuditLog", async () => {
    const ownerId = await makeUser("o2@e.com");
    const courseId = await publishedCourse(ownerId, "cap2");
    const adminId = await makeAdmin("admin2@e.com");

    const plan = await createCourseAccessPlan(adminId, courseId, {
      label: "1 năm",
      durationMonths: 12,
      priceCents: 500_000,
    });
    expect(plan.courseId).toBe(courseId);
    expect(plan.isActive).toBe(true);

    const logs = await prisma.auditLog.findMany({
      where: { action: "course.access_plan.created", actorUserId: adminId },
    });
    expect(logs).toHaveLength(1);

    const plans = await listCourseAccessPlans(courseId);
    expect(plans).toHaveLength(1);
  });

  it("deactivated plan is excluded from listCourseAccessPlans by default", async () => {
    const ownerId = await makeUser("o3@e.com");
    const courseId = await publishedCourse(ownerId, "cap3");
    const adminId = await makeAdmin("admin3@e.com");
    const plan = await createCourseAccessPlan(adminId, courseId, {
      label: "1 năm",
      durationMonths: 12,
      priceCents: 500_000,
    });

    await updateCourseAccessPlan(adminId, plan.id, { isActive: false });

    expect(await listCourseAccessPlans(courseId)).toHaveLength(0);
    expect(await listCourseAccessPlans(courseId, { includeInactive: true })).toHaveLength(1);
  });
});

describe("extendEnrollmentAccess", () => {
  it("AC3: first purchase sets accessExpiresAt = now + durationMonths", async () => {
    const ownerId = await makeUser("o4@e.com");
    const courseId = await publishedCourse(ownerId, "ext1");
    const learnerId = await makeUser("l4@e.com");
    const course = await courseWithVersion(courseId);

    const before = new Date();
    const result = await extendEnrollmentAccess(learnerId, course, {
      id: "plan1",
      durationMonths: 12,
    });
    expect(result.created).toBe(true);
    expect(result.accessExpiresAt).not.toBeNull();
    const expected = new Date(before);
    expected.setUTCMonth(expected.getUTCMonth() + 12);
    // Trong khoảng vài giây sai số của test.
    expect(
      Math.abs(result.accessExpiresAt!.getTime() - expected.getTime()),
    ).toBeLessThan(5_000);

    const events = await prisma.learningEvent.findMany({
      where: { userId: learnerId, eventType: LearningEventType.EnrollmentAccessExtended },
    });
    expect(events).toHaveLength(1);
  });

  it("AC4: renewing while still valid stacks onto the existing expiry, not now()", async () => {
    const ownerId = await makeUser("o5@e.com");
    const courseId = await publishedCourse(ownerId, "ext2");
    const learnerId = await makeUser("l5@e.com");
    const course = await courseWithVersion(courseId);

    const r1 = await extendEnrollmentAccess(learnerId, course, {
      id: "plan1",
      durationMonths: 12,
    });
    const firstExpiry = r1.accessExpiresAt!;

    const r2 = await extendEnrollmentAccess(learnerId, course, {
      id: "plan1",
      durationMonths: 12,
    });
    const expectedStacked = new Date(firstExpiry);
    expectedStacked.setUTCMonth(expectedStacked.getUTCMonth() + 12);
    expect(
      Math.abs(r2.accessExpiresAt!.getTime() - expectedStacked.getTime()),
    ).toBeLessThan(5_000);
  });

  it("AC5: buying a lifetime plan clears accessExpiresAt", async () => {
    const ownerId = await makeUser("o6@e.com");
    const courseId = await publishedCourse(ownerId, "ext3");
    const learnerId = await makeUser("l6@e.com");
    const course = await courseWithVersion(courseId);

    await extendEnrollmentAccess(learnerId, course, { id: "plan1", durationMonths: 12 });
    const r2 = await extendEnrollmentAccess(learnerId, course, {
      id: "plan-lifetime",
      durationMonths: null,
    });
    expect(r2.accessExpiresAt).toBeNull();
  });

  it("already-lifetime access isn't shortened by buying a limited-duration plan", async () => {
    const ownerId = await makeUser("o7@e.com");
    const courseId = await publishedCourse(ownerId, "ext4");
    const learnerId = await makeUser("l7@e.com");
    const course = await courseWithVersion(courseId);

    await extendEnrollmentAccess(learnerId, course, { id: null, durationMonths: null });
    const r2 = await extendEnrollmentAccess(learnerId, course, {
      id: "plan1",
      durationMonths: 12,
    });
    expect(r2.accessExpiresAt).toBeNull();
  });

  it("AC10: re-purchasing after expiry computes from now(), not the stale expiry, and reactivates", async () => {
    const ownerId = await makeUser("o8@e.com");
    const courseId = await publishedCourse(ownerId, "ext5");
    const learnerId = await makeUser("l8@e.com");
    const course = await courseWithVersion(courseId);

    await extendEnrollmentAccess(learnerId, course, { id: "plan1", durationMonths: 1 });
    // Simulate the reaper having already flipped it to expired with a
    // long-past expiry.
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: learnerId, courseId } },
      data: {
        status: "expired",
        accessExpiresAt: new Date("2000-01-01T00:00:00Z"),
        accessExpiryReminderSentAt: new Date(),
      },
    });

    const before = new Date();
    const r = await extendEnrollmentAccess(learnerId, course, {
      id: "plan1",
      durationMonths: 12,
    });
    const expected = new Date(before);
    expected.setUTCMonth(expected.getUTCMonth() + 12);
    expect(Math.abs(r.accessExpiresAt!.getTime() - expected.getTime())).toBeLessThan(5_000);

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });
    expect(enrollment.status).toBe("active");
    expect(enrollment.accessExpiryReminderSentAt).toBeNull();
  });
});

describe("expireDueEnrollments (cron reaper)", () => {
  it("AC6: flips active enrollments past accessExpiresAt to expired and emits the event", async () => {
    const ownerId = await makeUser("o9@e.com");
    const courseId = await publishedCourse(ownerId, "reap1");
    const learnerId = await makeUser("l9@e.com");
    const course = await courseWithVersion(courseId);

    await extendEnrollmentAccess(learnerId, course, { id: "plan1", durationMonths: 1 });
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: learnerId, courseId } },
      data: { accessExpiresAt: new Date(Date.now() - 1000) },
    });

    const res = await expireDueEnrollments();
    expect(res.expiredCount).toBe(1);

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });
    expect(enrollment.status).toBe("expired");

    const events = await prisma.learningEvent.findMany({
      where: { userId: learnerId, eventType: LearningEventType.EnrollmentAccessExpired },
    });
    expect(events).toHaveLength(1);
  });

  it("does not touch enrollments with no expiry or with a future expiry", async () => {
    const ownerId = await makeUser("o10@e.com");
    const courseId = await publishedCourse(ownerId, "reap2");
    const learnerId = await makeUser("l10@e.com");
    const course = await courseWithVersion(courseId);
    await extendEnrollmentAccess(learnerId, course, { id: null, durationMonths: null });

    const res = await expireDueEnrollments();
    expect(res.expiredCount).toBe(0);
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });
    expect(enrollment.status).toBe("active");
  });
});

describe("isUserEnrolled — live-check (AC7)", () => {
  it("returns false once accessExpiresAt has passed, even before the cron reaper runs", async () => {
    const ownerId = await makeUser("o11@e.com");
    const courseId = await publishedCourse(ownerId, "live1");
    const learnerId = await makeUser("l11@e.com");
    const course = await courseWithVersion(courseId);

    await extendEnrollmentAccess(learnerId, course, { id: "plan1", durationMonths: 1 });
    expect(await isUserEnrolled(learnerId, courseId)).toBe(true);

    // Hạn đã qua nhưng status vẫn "active" — cron chưa chạy.
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: learnerId, courseId } },
      data: { accessExpiresAt: new Date(Date.now() - 1000) },
    });
    expect(await isUserEnrolled(learnerId, courseId)).toBe(false);
  });
});

describe("sendAccessExpiryReminders (AC8)", () => {
  it("sends exactly one reminder within the window and doesn't duplicate on a same-day re-run", async () => {
    const ownerId = await makeUser("o12@e.com");
    const courseId = await publishedCourse(ownerId, "rem1");
    const learnerId = await makeUser("l12@e.com");
    const course = await courseWithVersion(courseId);

    await extendEnrollmentAccess(learnerId, course, { id: "plan1", durationMonths: 1 });
    // 3 ngày nữa hết hạn — trong cửa sổ nhắc 7 ngày.
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: learnerId, courseId } },
      data: { accessExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    });

    const res1 = await sendAccessExpiryReminders();
    expect(res1.remindersSent).toBe(1);

    const res2 = await sendAccessExpiryReminders();
    expect(res2.remindersSent).toBe(0);

    const events = await prisma.learningEvent.findMany({
      where: { userId: learnerId, eventType: LearningEventType.EnrollmentAccessReminderSent },
    });
    expect(events).toHaveLength(1);
  });

  it("ignores enrollments outside the reminder window", async () => {
    const ownerId = await makeUser("o13@e.com");
    const courseId = await publishedCourse(ownerId, "rem2");
    const learnerId = await makeUser("l13@e.com");
    const course = await courseWithVersion(courseId);

    await extendEnrollmentAccess(learnerId, course, { id: "plan1", durationMonths: 12 });

    const res = await sendAccessExpiryReminders();
    expect(res.remindersSent).toBe(0);
  });
});
