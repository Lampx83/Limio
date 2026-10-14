import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import {
  CourseAuthzError,
  CourseError,
  createCourse,
  listSampleCourses,
  publishCourse,
  setCourseSample,
  updateCourse,
} from "../courses";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser({ email, password: "password1234", displayName: email }, BASE);
  return r.userId;
}

async function setup(slug: string) {
  const adminId = await makeUser(`adm-${slug}@e.com`);
  await grantRole(adminId, { targetUserId: adminId, roleName: RoleName.Admin });
  const ownerId = await makeUser(`own-${slug}@e.com`);
  const c = await createCourse(ownerId, { title: `Khoá ${slug}`, description: "mô tả", slug });
  return { adminId, ownerId, courseId: c.courseId };
}

/** Khoá published + đọc công khai — điều kiện để làm khoá mẫu. */
async function makePublic(ownerId: string, courseId: string) {
  await publishCourse(ownerId, courseId);
  await updateCourse(ownerId, courseId, { publicAccess: true });
}

describe("khoá mẫu", () => {
  it("chỉ admin nền tảng đánh dấu được — kể cả chủ khoá cũng không", async () => {
    const s = await setup("smp1");
    await makePublic(s.ownerId, s.courseId);
    await expect(setCourseSample(s.ownerId, s.courseId, true)).rejects.toBeInstanceOf(
      CourseAuthzError,
    );
    await setCourseSample(s.adminId, s.courseId, true);
    expect((await listSampleCourses()).map((c) => c.id)).toContain(s.courseId);
  });

  it("khoá riêng tư hoặc chưa publish thì không đánh dấu được", async () => {
    const s = await setup("smp2");
    // Nháp + không công khai.
    await expect(setCourseSample(s.adminId, s.courseId, true)).rejects.toMatchObject({
      code: "sample_requires_public",
    });
    // Published nhưng vẫn không công khai.
    await publishCourse(s.ownerId, s.courseId);
    await expect(setCourseSample(s.adminId, s.courseId, true)).rejects.toBeInstanceOf(
      CourseError,
    );
  });

  it("khoá không tồn tại -> not_found", async () => {
    const s = await setup("smp3");
    await expect(
      setCourseSample(s.adminId, "00000000-0000-4000-8000-000000000000", true),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("khoá từng là mẫu rồi bị chuyển riêng tư thì biến khỏi danh sách (không để link chết)", async () => {
    const s = await setup("smp4");
    await makePublic(s.ownerId, s.courseId);
    await setCourseSample(s.adminId, s.courseId, true);
    expect((await listSampleCourses()).map((c) => c.id)).toContain(s.courseId);

    await updateCourse(s.ownerId, s.courseId, { publicAccess: false });
    expect((await listSampleCourses()).map((c) => c.id)).not.toContain(s.courseId);
    // Cờ vẫn còn — bật công khai lại thì tự hiện lại.
    expect((await prisma.course.findUniqueOrThrow({ where: { id: s.courseId } })).isSample).toBe(true);
  });

  it("gỡ đánh dấu được ngay cả khi khoá đã riêng tư", async () => {
    const s = await setup("smp5");
    await makePublic(s.ownerId, s.courseId);
    await setCourseSample(s.adminId, s.courseId, true);
    await updateCourse(s.ownerId, s.courseId, { publicAccess: false });
    await setCourseSample(s.adminId, s.courseId, false);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: s.courseId } })).isSample).toBe(false);
  });

  it("ghi audit đúng một dòng cho mỗi lần lật thật, không ghi khi lưu lại không đổi", async () => {
    const s = await setup("smp6");
    await makePublic(s.ownerId, s.courseId);
    await setCourseSample(s.adminId, s.courseId, true);
    await setCourseSample(s.adminId, s.courseId, true); // không đổi
    await setCourseSample(s.adminId, s.courseId, false);
    const rows = await prisma.auditLog.findMany({
      where: { action: "course.sample.toggled", actorUserId: s.adminId },
      orderBy: { occurredAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => (r.payload as { to: boolean }).to)).toEqual([true, false]);
  });
});
