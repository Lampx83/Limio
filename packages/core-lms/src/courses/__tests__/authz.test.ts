import { describe, expect, it } from "vitest";
import {
  assertCanEditCourse,
  assertCanGradeCourse,
  assertCanModerateLiveExam,
  assertIsOwner,
  CourseAuthzError,
} from "../authz";
import { addCoInstructorByEmail } from "../instructors";
import { createCourse } from "../courses";
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

/** Sets up a course with owner + one instructor of each non-owner role. */
async function makeCourseWithAllRoles(slugBase: string) {
  const ownerId = await makeUser(`owner-${slugBase}@example.com`);
  const courseId = await makeCourse(ownerId, slugBase);
  const coId = await makeUser(`co-${slugBase}@example.com`);
  const netId = await makeUser(`net-${slugBase}@example.com`);
  const taId = await makeUser(`ta-${slugBase}@example.com`);
  await addCoInstructorByEmail(ownerId, courseId, `co-${slugBase}@example.com`, "co-instructor", BASE);
  await addCoInstructorByEmail(ownerId, courseId, `net-${slugBase}@example.com`, "non-editing-teacher", BASE);
  await addCoInstructorByEmail(ownerId, courseId, `ta-${slugBase}@example.com`, "teaching-assistant", BASE);
  return { ownerId, courseId, coId, netId, taId };
}

describe("assertCanEditCourse — nhóm A/B (sửa nội dung/cấu trúc đề thi)", () => {
  it("owner + co-instructor pass; non-editing-teacher + teaching-assistant rejected", async () => {
    const { ownerId, courseId, coId, netId, taId } = await makeCourseWithAllRoles("edit");

    await expect(assertCanEditCourse(ownerId, courseId)).resolves.toBeUndefined();
    await expect(assertCanEditCourse(coId, courseId)).resolves.toBeUndefined();
    await expect(assertCanEditCourse(netId, courseId)).rejects.toThrow(CourseAuthzError);
    await expect(assertCanEditCourse(taId, courseId)).rejects.toThrow(CourseAuthzError);
  });
});

describe("assertCanGradeCourse — nhóm C (chấm bài, final ngay cho cả 4 role)", () => {
  it("all 4 roles pass", async () => {
    const { ownerId, courseId, coId, netId, taId } = await makeCourseWithAllRoles("grade");

    await expect(assertCanGradeCourse(ownerId, courseId)).resolves.toBeUndefined();
    await expect(assertCanGradeCourse(coId, courseId)).resolves.toBeUndefined();
    await expect(assertCanGradeCourse(netId, courseId)).resolves.toBeUndefined();
    await expect(assertCanGradeCourse(taId, courseId)).resolves.toBeUndefined();
  });

  it("a user with no CourseInstructor row is rejected", async () => {
    const { courseId } = await makeCourseWithAllRoles("grade2");
    const strangerId = await makeUser("stranger-grade2@example.com");
    await expect(assertCanGradeCourse(strangerId, courseId)).rejects.toThrow(
      CourseAuthzError,
    );
  });
});

describe("assertCanModerateLiveExam — nhóm D (can thiệp lúc thi + nhắn tin, xem báo cáo)", () => {
  it("owner, co-instructor, non-editing-teacher pass; teaching-assistant rejected", async () => {
    const { ownerId, courseId, coId, netId, taId } = await makeCourseWithAllRoles("live");

    await expect(assertCanModerateLiveExam(ownerId, courseId)).resolves.toBeUndefined();
    await expect(assertCanModerateLiveExam(coId, courseId)).resolves.toBeUndefined();
    await expect(assertCanModerateLiveExam(netId, courseId)).resolves.toBeUndefined();
    await expect(assertCanModerateLiveExam(taId, courseId)).rejects.toThrow(
      CourseAuthzError,
    );
  });
});

describe("assertIsOwner — nhóm F/G (quản lý giảng viên, xóa khóa)", () => {
  it("only owner passes; co-instructor/non-editing-teacher/teaching-assistant rejected", async () => {
    const { ownerId, courseId, coId, netId, taId } = await makeCourseWithAllRoles("owner");

    await expect(assertIsOwner(ownerId, courseId)).resolves.toBeUndefined();
    await expect(assertIsOwner(coId, courseId)).rejects.toThrow(CourseAuthzError);
    await expect(assertIsOwner(netId, courseId)).rejects.toThrow(CourseAuthzError);
    await expect(assertIsOwner(taId, courseId)).rejects.toThrow(CourseAuthzError);
  });
});
