import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  createCourseSection,
  deleteCourseSection,
  getSectionRoster,
  listCourseSections,
  regenerateInviteCode,
  transferEnrollmentSection,
  updateCourseSection,
} from "../sections";
import { createCourse, CourseError, publishCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createSkill, tagLessonSkill } from "../skills";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { completeLesson } from "../../learning/lessons";

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

describe("createCourseSection / listCourseSections", () => {
  it("creates a section with a unique global invite code, not marked default", async () => {
    const ownerId = await makeUser("sec-o1@e.com");
    const courseId = await publishedCourse(ownerId, "sec1");

    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    expect(section.isDefault).toBe(false);
    expect(section.inviteCode).toBeTruthy();
    expect(section.enrolledCount).toBe(0);

    const list = await listCourseSections(ownerId, courseId);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(section.id);
  });

  it("rejects duplicate section name within the same course", async () => {
    const ownerId = await makeUser("sec-o2@e.com");
    const courseId = await publishedCourse(ownerId, "sec2");
    await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    await expect(
      createCourseSection(ownerId, courseId, { name: "Lớp A" }),
    ).rejects.toMatchObject({ code: "section_name_taken" });
  });

  it("excludes the auto-created default section from the list", async () => {
    const ownerId = await makeUser("sec-o3@e.com");
    const courseId = await publishedCourse(ownerId, "sec3");
    const learnerId = await makeUser("sec-l3@e.com");
    // Direct enroll (no sectionId) lazily creates + assigns the default section.
    await enrollInCourse(learnerId, courseId);

    const list = await listCourseSections(ownerId, courseId);
    expect(list).toHaveLength(0);

    const defaultSection = await prisma.courseSection.findFirst({
      where: { courseId, isDefault: true },
    });
    expect(defaultSection).not.toBeNull();
  });
});

describe("updateCourseSection", () => {
  it("renames a section", async () => {
    const ownerId = await makeUser("sec-o4@e.com");
    const courseId = await publishedCourse(ownerId, "sec4");
    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });

    await updateCourseSection(ownerId, section.id, { name: "Lớp A (đổi tên)" });
    const list = await listCourseSections(ownerId, courseId);
    expect(list[0]!.name).toBe("Lớp A (đổi tên)");
  });
});

describe("deleteCourseSection", () => {
  it("deletes an empty section", async () => {
    const ownerId = await makeUser("sec-o5@e.com");
    const courseId = await publishedCourse(ownerId, "sec5");
    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });

    await deleteCourseSection(ownerId, section.id);
    const list = await listCourseSections(ownerId, courseId);
    expect(list).toHaveLength(0);
  });

  it("rejects deleting a section with active enrollments", async () => {
    const ownerId = await makeUser("sec-o6@e.com");
    const courseId = await publishedCourse(ownerId, "sec6");
    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const learnerId = await makeUser("sec-l6@e.com");
    await enrollInCourse(learnerId, courseId, undefined, { sectionId: section.id });

    await expect(deleteCourseSection(ownerId, section.id)).rejects.toMatchObject({
      code: "section_has_enrollments",
    });
  });
});

describe("regenerateInviteCode", () => {
  it("rotates the invite code — old code stops resolving", async () => {
    const ownerId = await makeUser("sec-o7@e.com");
    const courseId = await publishedCourse(ownerId, "sec7");
    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const oldCode = section.inviteCode!;

    const { inviteCode: newCode } = await regenerateInviteCode(ownerId, section.id);
    expect(newCode).not.toBe(oldCode);

    const byOldCode = await prisma.courseSection.findUnique({ where: { inviteCode: oldCode } });
    expect(byOldCode).toBeNull();
    const byNewCode = await prisma.courseSection.findUnique({ where: { inviteCode: newCode } });
    expect(byNewCode?.id).toBe(section.id);
  });
});

describe("section authz", () => {
  it("non-instructor cannot create a section", async () => {
    const ownerId = await makeUser("sec-o8@e.com");
    const courseId = await publishedCourse(ownerId, "sec8");
    const strangerId = await makeUser("sec-s8@e.com");
    await expect(
      createCourseSection(strangerId, courseId, { name: "Lớp A" }),
    ).rejects.toThrow();
  });

  it("cannot update/delete the auto-created default section", async () => {
    const ownerId = await makeUser("sec-o9@e.com");
    const courseId = await publishedCourse(ownerId, "sec9");
    const learnerId = await makeUser("sec-l9@e.com");
    await enrollInCourse(learnerId, courseId);
    const defaultSection = await prisma.courseSection.findFirstOrThrow({
      where: { courseId, isDefault: true },
    });

    await expect(
      updateCourseSection(ownerId, defaultSection.id, { name: "x" }),
    ).rejects.toMatchObject({ code: "section_not_found" } satisfies Partial<CourseError>);
    await expect(deleteCourseSection(ownerId, defaultSection.id)).rejects.toMatchObject({
      code: "section_not_found",
    });
  });
});

describe("getSectionRoster", () => {
  it("lists enrolled learners with progress %, latest quiz score, and other sections", async () => {
    const ownerId = await makeUser("ros-o1@e.com");
    const courseId = await publishedCourse(ownerId, "ros1");
    const secA = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const secB = await createCourseSection(ownerId, courseId, { name: "Lớp B" });

    const learnerId = await makeUser("ros-l1@e.com");
    await enrollInCourse(learnerId, courseId, undefined, { sectionId: secA.id });

    const lesson = await prisma.lesson.findFirstOrThrow({ where: { module: { courseId } } });
    await completeLesson(learnerId, lesson.id);

    const quiz = await prisma.quiz.create({ data: { courseId, title: "Q" } });
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: learnerId,
        status: "submitted",
        submittedAt: new Date(),
        scorePct: 80,
        passed: true,
      },
    });

    const roster = await getSectionRoster(ownerId, secA.id);
    expect(roster.section.id).toBe(secA.id);
    expect(roster.otherSections).toEqual([{ id: secB.id, name: "Lớp B" }]);
    expect(roster.entries).toHaveLength(1);
    const entry = roster.entries[0]!;
    expect(entry.user.id).toBe(learnerId);
    expect(entry.completedLessons).toBe(1);
    expect(entry.totalLessons).toBe(1);
    expect(entry.courseCompletionPct).toBe(100);
    expect(entry.latestQuizScorePct).toBe(80);
  });

  it("returns empty entries for a section with no learners", async () => {
    const ownerId = await makeUser("ros-o2@e.com");
    const courseId = await publishedCourse(ownerId, "ros2");
    const sec = await createCourseSection(ownerId, courseId, { name: "Lớp A" });

    const roster = await getSectionRoster(ownerId, sec.id);
    expect(roster.entries).toHaveLength(0);
  });

  it("non-instructor cannot view roster", async () => {
    const ownerId = await makeUser("ros-o3@e.com");
    const courseId = await publishedCourse(ownerId, "ros3");
    const sec = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const strangerId = await makeUser("ros-s3@e.com");

    await expect(getSectionRoster(strangerId, sec.id)).rejects.toThrow();
  });
});

describe("transferEnrollmentSection", () => {
  it("moves an enrollment to a different section of the same course", async () => {
    const ownerId = await makeUser("tr-o1@e.com");
    const courseId = await publishedCourse(ownerId, "tr1");
    const secA = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const secB = await createCourseSection(ownerId, courseId, { name: "Lớp B" });
    const learnerId = await makeUser("tr-l1@e.com");
    await enrollInCourse(learnerId, courseId, undefined, { sectionId: secA.id });
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });

    await transferEnrollmentSection(ownerId, enrollment.id, secB.id);

    const updated = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    expect(updated.sectionId).toBe(secB.id);

    const rosterA = await getSectionRoster(ownerId, secA.id);
    const rosterB = await getSectionRoster(ownerId, secB.id);
    expect(rosterA.entries).toHaveLength(0);
    expect(rosterB.entries).toHaveLength(1);
  });

  it("rejects moving to a section from a different course", async () => {
    const ownerId = await makeUser("tr-o2@e.com");
    const courseId = await publishedCourse(ownerId, "tr2");
    const otherCourseId = await publishedCourse(ownerId, "tr2b");
    const secA = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const secOther = await createCourseSection(ownerId, otherCourseId, { name: "Lớp X" });
    const learnerId = await makeUser("tr-l2@e.com");
    await enrollInCourse(learnerId, courseId, undefined, { sectionId: secA.id });
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });

    await expect(
      transferEnrollmentSection(ownerId, enrollment.id, secOther.id),
    ).rejects.toMatchObject({ code: "section_not_found" } satisfies Partial<CourseError>);
  });

  it("non-instructor cannot transfer", async () => {
    const ownerId = await makeUser("tr-o3@e.com");
    const courseId = await publishedCourse(ownerId, "tr3");
    const secA = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const secB = await createCourseSection(ownerId, courseId, { name: "Lớp B" });
    const learnerId = await makeUser("tr-l3@e.com");
    await enrollInCourse(learnerId, courseId, undefined, { sectionId: secA.id });
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });
    const strangerId = await makeUser("tr-s3@e.com");

    await expect(
      transferEnrollmentSection(strangerId, enrollment.id, secB.id),
    ).rejects.toThrow();
  });
});
