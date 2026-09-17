import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { authorizeGroupingOwner } from "../grouping";
import { createCourse } from "../courses/courses";
import { createModule } from "../courses/modules";
import { createLesson } from "../courses/lessons";
import { registerUser } from "../auth/register";
import { grantRole } from "../auth/roles";

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

/** Dựng đúng chain Course -> Module -> Lesson -> ClassroomSession -> GroupingSession
 * mà grouping/create/route.ts tạo ra khi 1 GV thật sự dùng tính năng chia nhóm. */
async function makeGroupingSession(ownerId: string, slug: string) {
  const course = await createCourse(ownerId, { title: `t ${slug}`, description: "d", slug });
  const mod = await createModule(ownerId, course.courseId, { title: "M", orderIndex: 0 });
  const lesson = await createLesson(ownerId, mod.moduleId, { title: "L", orderIndex: 0 });

  const session = await prisma.classroomSession.create({
    data: { lessonId: lesson.lessonId },
  });
  const grouping = await prisma.groupingSession.create({
    data: { sessionId: session.id, numGroups: 2 },
  });
  return { courseId: course.courseId, groupingId: grouping.id };
}

describe("authorizeGroupingOwner", () => {
  it("AC: the instructor who owns the course can access their own grouping", async () => {
    const instructorA = await makeUser("instrA@e.com");
    const { groupingId } = await makeGroupingSession(instructorA, "grp1");

    const result = await authorizeGroupingOwner(groupingId, instructorA);
    expect(result).toMatchObject({ ok: true });
  });

  it("AC: a different instructor (not on this course) is forbidden — the IDOR case", async () => {
    const instructorA = await makeUser("instrA2@e.com");
    const instructorB = await makeUser("instrB2@e.com");
    const { groupingId } = await makeGroupingSession(instructorA, "grp2");

    const result = await authorizeGroupingOwner(groupingId, instructorB);
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("a learner with no relationship to the course is forbidden", async () => {
    const instructorA = await makeUser("instrA3@e.com");
    const learner = await makeUser("learner3@e.com");
    const { groupingId } = await makeGroupingSession(instructorA, "grp3");

    const result = await authorizeGroupingOwner(groupingId, learner);
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("admin bypasses course ownership, same as canEditCourse elsewhere", async () => {
    const instructorA = await makeUser("instrA4@e.com");
    const adminId = await makeAdmin("admin4@e.com");
    const { groupingId } = await makeGroupingSession(instructorA, "grp4");

    const result = await authorizeGroupingOwner(groupingId, adminId);
    expect(result).toMatchObject({ ok: true });
  });

  it("returns not_found for an unknown groupingId", async () => {
    const someone = await makeUser("someone5@e.com");
    const result = await authorizeGroupingOwner("00000000-0000-0000-0000-000000000000", someone);
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("fails closed (not_found) for a GroupingSession whose ClassroomSession has no lesson", async () => {
    // Ngoài phạm vi tạo được qua grouping/create/route.ts (lessonId bắt buộc),
    // nhưng schema không cấm — nếu lỡ tồn tại dữ liệu kiểu này, đừng đoán quyền.
    const someone = await makeUser("someone6@e.com");
    const orphanSession = await prisma.classroomSession.create({ data: {} });
    const grouping = await prisma.groupingSession.create({
      data: { sessionId: orphanSession.id, numGroups: 2 },
    });

    const result = await authorizeGroupingOwner(grouping.id, someone);
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});
