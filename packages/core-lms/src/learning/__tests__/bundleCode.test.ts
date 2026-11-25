import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { generateBundleCodes, redeemAnyCode, redeemBundleCode } from "../bundleCode";
import { generateAccessCodes, AccessCodeError } from "../accessCode";
import { isUserEnrolled } from "../enroll";
import { CourseAuthzError } from "../../courses/authz";
import { createCourse, publishCourse } from "../../courses/courses";
import { createBundle, publishBundle } from "../../courses/bundles";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";
async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

async function setup(tag: string, durationMonths: number | null = 12) {
  const admin = await makeUser(`${tag}-admin@e.com`);
  await grantRole(admin, { targetUserId: admin, roleName: RoleName.Admin });
  const learner = await makeUser(`${tag}-learner@e.com`);
  const courseIds: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const c = await createCourse(admin, { title: `${tag} ${i}`, description: "d", slug: `${tag}-${i}`, personalizationEnabled: false });
    await publishCourse(admin, c.courseId);
    courseIds.push(c.courseId);
  }
  const bundle = await createBundle(admin, { slug: `combo-${tag}`, title: `Combo ${tag}`, priceCents: 699_000, durationMonths, courseIds });
  await publishBundle(admin, bundle.id);
  return { admin, learner, courseIds, bundle };
}

describe("generateBundleCodes", () => {
  it("chỉ admin sinh mã; mã đúng định dạng; AuditLog không chứa mã", async () => {
    const { admin, learner, bundle } = await setup("bc-1");
    await expect(generateBundleCodes(learner, bundle.id, 2)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(generateBundleCodes(admin, bundle.id, 0)).rejects.toBeInstanceOf(AccessCodeError);

    const codes = await generateBundleCodes(admin, bundle.id, 3, { note: "đợt 1" });
    expect(codes).toHaveLength(3);
    for (const c of codes) expect(c.code).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    const audit = await prisma.auditLog.findFirst({ where: { action: "course.bundle.codes_generated", payload: { path: ["bundleId"], equals: bundle.id } } });
    expect(audit).not.toBeNull();
    for (const c of codes) expect(JSON.stringify(audit!.payload)).not.toContain(c.code);
  });
});

describe("redeemBundleCode / redeemAnyCode", () => {
  it("một mã mở MỌI khoá của combo với thời hạn của combo; mã bị tiêu", async () => {
    const { admin, learner, courseIds, bundle } = await setup("bc-2");
    const code = (await generateBundleCodes(admin, bundle.id, 1))[0]!.code;

    // Người dùng gõ thiếu gạch nối, chữ thường: vẫn khớp.
    const r = await redeemAnyCode(learner, code.replace(/-/g, "").toLowerCase());
    expect(r).toMatchObject({ bundleSlug: "combo-bc-2", courseCount: 3, codeConsumed: true, created: true });
    expect((r as { courseSlug: string }).courseSlug).toBe("bc-2-1");
    for (const courseId of courseIds) {
      expect(await isUserEnrolled(learner, courseId)).toBe(true);
      const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } });
      const months = (e.accessExpiresAt!.getTime() - Date.now()) / (30 * 24 * 3600 * 1000);
      expect(months).toBeGreaterThan(11);
      expect(months).toBeLessThan(12.5);
    }
    expect((await prisma.bundleAccessCode.findUniqueOrThrow({ where: { code } })).status).toBe("redeemed");
  });

  it("mã đã dùng bởi người khác bị từ chối; chính chủ bấm lại không tiêu thêm", async () => {
    const { admin, learner, bundle } = await setup("bc-3");
    const other = await makeUser("bc-3-other@e.com");
    const code = (await generateBundleCodes(admin, bundle.id, 1))[0]!.code;
    await redeemBundleCode(learner, code);

    await expect(redeemBundleCode(other, code)).rejects.toMatchObject({ code: "code_already_used" });
    expect(await redeemBundleCode(learner, code)).toMatchObject({ codeConsumed: false });
  });

  it("mã sai, mã bị thu hồi, combo chưa mở bán", async () => {
    const { admin, learner, courseIds, bundle } = await setup("bc-4");
    await expect(redeemAnyCode(learner, "AAAA-BBBB-CCCC")).rejects.toMatchObject({ code: "code_not_found" });

    const pair = await generateBundleCodes(admin, bundle.id, 2);
    const revoked = pair[0]!.code;
    const ok = pair[1]!.code;
    await prisma.bundleAccessCode.update({ where: { code: revoked }, data: { status: "revoked" } });
    await expect(redeemBundleCode(learner, revoked)).rejects.toMatchObject({ code: "code_revoked" });

    await prisma.course.update({ where: { id: courseIds[1]! }, data: { status: "draft" } });
    await expect(redeemBundleCode(learner, ok)).rejects.toMatchObject({ code: "course_not_enrollable" });
    expect(await prisma.enrollment.count({ where: { userId: learner } })).toBe(0);
    expect((await prisma.bundleAccessCode.findUniqueOrThrow({ where: { code: ok } })).status).toBe("unused");
  });

  it("combo vĩnh viễn → quyền không hết hạn; mã khoá lẻ vẫn đổi qua cùng đường", async () => {
    const { admin, learner, courseIds, bundle } = await setup("bc-5", null);
    const code = (await generateBundleCodes(admin, bundle.id, 1))[0]!.code;
    await redeemAnyCode(learner, code);
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId: courseIds[0]! } } });
    expect(e.accessExpiresAt).toBeNull();

    const other = await makeUser("bc-5-other@e.com");
    const courseCode = (await generateAccessCodes(courseIds[2]!, admin, 1))[0]!.code;
    expect(await redeemAnyCode(other, courseCode)).toMatchObject({ courseSlug: "bc-5-3", codeConsumed: true });
    expect(await isUserEnrolled(other, courseIds[2]!)).toBe(true);
    expect(await isUserEnrolled(other, courseIds[0]!)).toBe(false); // mã khoá lẻ chỉ mở đúng khoá đó
  });
});
