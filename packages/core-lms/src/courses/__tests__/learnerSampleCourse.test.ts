import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import {
  CourseAuthzError,
  createCourse,
  getLearnerSampleCourse,
  publishCourse,
  setCourseLearnerSample,
  updateCourse,
} from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser({ email, password: "password1234", displayName: email }, BASE);
  return r.userId;
}

/** Khoá published, tự ghi danh, miễn phí, có một bài — đủ điều kiện làm mẫu cho học viên. */
async function setup(slug: string) {
  const adminId = await makeUser(`adm-${slug}@e.com`);
  await grantRole(adminId, { targetUserId: adminId, roleName: RoleName.Admin });
  const ownerId = await makeUser(`own-${slug}@e.com`);
  const { courseId } = await createCourse(ownerId, { title: `Khoá ${slug}`, description: "mô tả", slug });
  const { moduleId } = await createModule(ownerId, courseId, { title: "Module 1", orderIndex: 0 });
  const { lessonId } = await createLesson(ownerId, moduleId, { title: "Bài mở đầu", orderIndex: 0, durationSec: 300 });
  await publishCourse(ownerId, courseId);
  return { adminId, ownerId, courseId, lessonId };
}

describe("khoá mẫu cho học viên", () => {
  it("chỉ admin nền tảng bật được", async () => {
    const s = await setup("lsmp1");
    await expect(setCourseLearnerSample(s.ownerId, s.courseId, true)).rejects.toBeInstanceOf(CourseAuthzError);
    await setCourseLearnerSample(s.adminId, s.courseId, true);
    expect((await getLearnerSampleCourse())?.id).toBe(s.courseId);
  });

  it("khoá chỉ-link-mời hoặc có phí thì không bật được", async () => {
    const s = await setup("lsmp2");
    await updateCourse(s.ownerId, s.courseId, { enrollMode: "invite_only" });
    await expect(setCourseLearnerSample(s.adminId, s.courseId, true)).rejects.toMatchObject({
      code: "learner_sample_requires_open_free",
    });
    await updateCourse(s.ownerId, s.courseId, { enrollMode: "open", priceCents: 50_000 });
    await expect(setCourseLearnerSample(s.adminId, s.courseId, true)).rejects.toMatchObject({
      code: "learner_sample_requires_open_free",
    });
  });

  it("trả về bài đầu tiên để mở khi bấm Học thử", async () => {
    const s = await setup("lsmp3");
    await setCourseLearnerSample(s.adminId, s.courseId, true);
    const sample = await getLearnerSampleCourse();
    expect(sample?.firstLesson).toMatchObject({ id: s.lessonId, title: "Bài mở đầu", durationSec: 300 });
  });

  it("khoá bật gần nhất thắng", async () => {
    const a = await setup("lsmp4a");
    const b = await setup("lsmp4b");
    await setCourseLearnerSample(a.adminId, a.courseId, true);
    await setCourseLearnerSample(b.adminId, b.courseId, true);
    expect((await getLearnerSampleCourse())?.id).toBe(b.courseId);
    // Bật lại khoá cũ thì nó lên đầu.
    await setCourseLearnerSample(a.adminId, a.courseId, true);
    expect((await getLearnerSampleCourse())?.id).toBe(a.courseId);
  });

  it("khoá mẫu bị đổi sang có phí thì biến khỏi trang Bắt đầu (không để nút bị chặn)", async () => {
    const s = await setup("lsmp5");
    await setCourseLearnerSample(s.adminId, s.courseId, true);
    await updateCourse(s.ownerId, s.courseId, { priceCents: 50_000 });
    expect((await getLearnerSampleCourse())?.id).not.toBe(s.courseId);
    // Tắt vẫn được dù khoá không còn đủ điều kiện.
    await setCourseLearnerSample(s.adminId, s.courseId, false);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: s.courseId } })).learnerSampleAt).toBeNull();
  });

  it("ghi audit cho mỗi lần bật/tắt thật", async () => {
    const s = await setup("lsmp6");
    await setCourseLearnerSample(s.adminId, s.courseId, true);
    await setCourseLearnerSample(s.adminId, s.courseId, false);
    await setCourseLearnerSample(s.adminId, s.courseId, false); // đang tắt — không ghi
    const rows = await prisma.auditLog.findMany({
      where: { action: "course.learner_sample.toggled", actorUserId: s.adminId },
      orderBy: { occurredAt: "asc" },
    });
    expect(rows.map((r) => (r.payload as { to: boolean }).to)).toEqual([true, false]);
  });
});
