import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  createCourseSection,
  deleteCourseSection,
  listCourseSections,
  regenerateInviteCode,
  updateCourseSection,
} from "../sections";
import { createCourse, CourseError, publishCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createSkill, tagLessonSkill } from "../skills";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";

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
