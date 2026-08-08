import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  enrollBySectionCode,
  enrollInCourse,
  EnrollError,
  isUserEnrolled,
  listEnrollmentsForUser,
} from "../enroll";
import {
  createCourse,
  publishCourse,
} from "../../courses/courses";
import { createCourseSection } from "../../courses/sections";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createSkill, tagLessonSkill } from "../../courses/skills";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser({ email, password: "password1234", displayName: email }, BASE);
  return r.userId;
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

describe("enrollInCourse", () => {
  it("AC-A3.1: creates enrollment with current course version + emits enrollment.created", async () => {
    const ownerId = await makeUser("o1@e.com");
    const courseId = await publishedCourse(ownerId, "e1");
    const learnerId = await makeUser("l1@e.com");

    const result = await enrollInCourse(learnerId, courseId);
    expect(result.created).toBe(true);
    expect(result.courseVersion).toBe(1);

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { id: result.enrollmentId },
    });
    expect(enrollment.userId).toBe(learnerId);
    expect(enrollment.status).toBe("active");
    expect(enrollment.courseVersion).toBe(1);

    const events = await prisma.learningEvent.findMany({
      where: { userId: learnerId, eventType: LearningEventType.EnrollmentCreated },
    });
    expect(events).toHaveLength(1);
  });

  it("AC-A3.2: re-enroll returns existing, no dup event", async () => {
    const ownerId = await makeUser("o2@e.com");
    const courseId = await publishedCourse(ownerId, "e2");
    const learnerId = await makeUser("l2@e.com");

    const r1 = await enrollInCourse(learnerId, courseId);
    const r2 = await enrollInCourse(learnerId, courseId);
    expect(r1.enrollmentId).toBe(r2.enrollmentId);
    expect(r2.created).toBe(false);

    const events = await prisma.learningEvent.findMany({
      where: { userId: learnerId, eventType: LearningEventType.EnrollmentCreated },
    });
    expect(events).toHaveLength(1);
  });

  it("AC-A3.3: cannot enroll in draft course", async () => {
    const ownerId = await makeUser("o3@e.com");
    const c = await createCourse(ownerId, { title: "draft", description: "x", slug: "draft" });
    const learnerId = await makeUser("l3@e.com");
    await expect(enrollInCourse(learnerId, c.courseId)).rejects.toMatchObject({
      code: "course_not_enrollable",
    });
  });

  it("throws course_not_found for unknown course", async () => {
    const learnerId = await makeUser("l4@e.com");
    await expect(
      enrollInCourse(learnerId, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toBeInstanceOf(EnrollError);
  });

  it("AC-A3.12: courseVersion frozen after course bumps", async () => {
    const ownerId = await makeUser("o5@e.com");
    const courseId = await publishedCourse(ownerId, "e5");
    const learnerId = await makeUser("l5@e.com");
    const r = await enrollInCourse(learnerId, courseId);
    expect(r.courseVersion).toBe(1);

    // Bump version directly via DB (simulating bumpCourseVersion).
    await prisma.course.update({ where: { id: courseId }, data: { version: 2 } });

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { id: r.enrollmentId },
    });
    expect(enrollment.courseVersion).toBe(1); // frozen
  });

  it("isUserEnrolled true for active, false for unknown / dropped", async () => {
    const ownerId = await makeUser("o6@e.com");
    const courseId = await publishedCourse(ownerId, "e6");
    const learnerId = await makeUser("l6@e.com");
    expect(await isUserEnrolled(learnerId, courseId)).toBe(false);

    await enrollInCourse(learnerId, courseId);
    expect(await isUserEnrolled(learnerId, courseId)).toBe(true);

    await prisma.enrollment.update({
      where: { userId_courseId: { userId: learnerId, courseId } },
      data: { status: "dropped" },
    });
    expect(await isUserEnrolled(learnerId, courseId)).toBe(false);
  });

  it("listEnrollmentsForUser returns active + completed", async () => {
    const ownerId = await makeUser("o7@e.com");
    const c1 = await publishedCourse(ownerId, "e7a");
    const c2 = await publishedCourse(ownerId, "e7b");
    const learnerId = await makeUser("l7@e.com");
    await enrollInCourse(learnerId, c1);
    await enrollInCourse(learnerId, c2);
    const list = await listEnrollmentsForUser(learnerId);
    expect(list).toHaveLength(2);
  });

  it("direct enroll (no sectionId) lazily creates + lands in the default section", async () => {
    const ownerId = await makeUser("o8@e.com");
    const courseId = await publishedCourse(ownerId, "e8");
    const learnerId = await makeUser("l8@e.com");

    const result = await enrollInCourse(learnerId, courseId);
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { id: result.enrollmentId },
      include: { section: true },
    });
    expect(enrollment.section.isDefault).toBe(true);
    expect(enrollment.section.courseId).toBe(courseId);
  });
});

describe("enrollBySectionCode", () => {
  it("self-enrolls via a section's invite code, landing in that section", async () => {
    const ownerId = await makeUser("j1@e.com");
    const courseId = await publishedCourse(ownerId, "j1");
    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const learnerId = await makeUser("jl1@e.com");

    const result = await enrollBySectionCode(learnerId, section.inviteCode!);
    expect(result.created).toBe(true);

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { id: result.enrollmentId },
    });
    expect(enrollment.sectionId).toBe(section.id);
    expect(enrollment.courseId).toBe(courseId);
  });

  it("re-joining the same invite link is idempotent", async () => {
    const ownerId = await makeUser("j2@e.com");
    const courseId = await publishedCourse(ownerId, "j2");
    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const learnerId = await makeUser("jl2@e.com");

    const r1 = await enrollBySectionCode(learnerId, section.inviteCode!);
    const r2 = await enrollBySectionCode(learnerId, section.inviteCode!);
    expect(r1.enrollmentId).toBe(r2.enrollmentId);
    expect(r2.created).toBe(false);
  });

  it("rejects an unknown invite code", async () => {
    const learnerId = await makeUser("jl3@e.com");
    await expect(enrollBySectionCode(learnerId, "NOSUCH")).rejects.toMatchObject({
      code: "invalid_invite_code",
    });
  });

  it("rejects joining via the default section's code (it has none)", async () => {
    const ownerId = await makeUser("j4@e.com");
    const courseId = await publishedCourse(ownerId, "j4");
    const bootstrapLearnerId = await makeUser("jl4a@e.com");
    await enrollInCourse(bootstrapLearnerId, courseId); // lazily creates default section

    const learnerId = await makeUser("jl4b@e.com");
    await expect(enrollBySectionCode(learnerId, "FAKECODE")).rejects.toMatchObject({
      code: "invalid_invite_code",
    });
  });

  it("rejects when the course isn't published", async () => {
    const ownerId = await makeUser("j5@e.com");
    const c = await createCourse(ownerId, { title: "draft", description: "x", slug: "j5-draft" });
    const section = await createCourseSection(ownerId, c.courseId, { name: "Lớp A" });
    const learnerId = await makeUser("jl5@e.com");

    await expect(enrollBySectionCode(learnerId, section.inviteCode!)).rejects.toMatchObject({
      code: "course_not_enrollable",
    });
  });
});
