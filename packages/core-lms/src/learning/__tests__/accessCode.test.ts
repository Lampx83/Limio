import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  AccessCodeError,
  generateAccessCodes,
  listAccessCodes,
  redeemAccessCode,
  revokeAccessCode,
} from "../accessCode";
import { isUserEnrolled, resolveDefaultSectionId } from "../enroll";
import { createCourse, publishCourse, updateCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createSkill, tagLessonSkill } from "../../courses/skills";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser({ email, password: "password1234", displayName: email }, BASE);
  return r.userId;
}

async function paidCourse(
  ownerId: string,
  slug: string,
  opts: { priceCents?: number; publish?: boolean } = {},
) {
  // createCourse không nhận priceCents lúc tạo (đúng luồng thật: giá đặt sau
  // qua CourseMetaForm/updateCourse) — set riêng, kể cả giá trị mặc định của
  // test, chứ không thì mọi khoá đều rơi về free (priceCents=null).
  const c = await createCourse(ownerId, { title: `t ${slug}`, description: "d", slug });
  await updateCourse(ownerId, c.courseId, {
    priceCents: opts.priceCents ?? 199_000,
    currency: "VND",
  });
  const m = await createModule(ownerId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(ownerId, m.moduleId, { title: "L", orderIndex: 0 });
  const s = await createSkill({ code: `skill.${slug}`, name: "s" });
  await tagLessonSkill(ownerId, l.lessonId, { skillId: s.skillId });
  if (opts.publish !== false) await publishCourse(ownerId, c.courseId);
  return c.courseId;
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof AccessCodeError) return e.code;
    throw e;
  }
}

describe("generateAccessCodes", () => {
  it("sinh N mã duy nhất, chốt giá tại thời điểm sinh", async () => {
    const owner = await makeUser("gen-owner@e.com");
    const courseId = await paidCourse(owner, "gen-1", { priceCents: 250_000 });

    const codes = await generateAccessCodes(courseId, owner, 5);
    expect(codes).toHaveLength(5);
    expect(new Set(codes.map((c) => c.code)).size).toBe(5);
    expect(codes.every((c) => /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(c.code))).toBe(true);

    const rows = await listAccessCodes(courseId);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.priceCentsSnapshot === 250_000)).toBe(true);

    // Đổi giá khoá sau khi đã sinh mã không được làm sai lệch giá đã chốt.
    await prisma.course.update({ where: { id: courseId }, data: { priceCents: 999_000 } });
    const after = await listAccessCodes(courseId);
    expect(after.every((r) => r.priceCentsSnapshot === 250_000)).toBe(true);
  });

  it("từ chối số lượng không hợp lệ và khoá không tồn tại", async () => {
    const owner = await makeUser("gen-bad-owner@e.com");
    const courseId = await paidCourse(owner, "gen-bad");

    expect(await codeOf(generateAccessCodes(courseId, owner, 0))).toBe("validation_failed");
    expect(await codeOf(generateAccessCodes(courseId, owner, 201))).toBe("validation_failed");
    expect(
      await codeOf(generateAccessCodes("00000000-0000-4000-8000-000000000000", owner, 1)),
    ).toBe("course_not_found");
  });
});

describe("redeemAccessCode", () => {
  it("đổi mã lấy một chỗ trong khoá, đánh dấu mã đã dùng", async () => {
    const owner = await makeUser("redeem-owner@e.com");
    const courseId = await paidCourse(owner, "redeem-1");
    const learner = await makeUser("redeem-learner@e.com");
    const { code } = (await generateAccessCodes(courseId, owner, 1))[0]!;

    const result = await redeemAccessCode(learner, code);
    expect(result.created).toBe(true);
    expect(result.codeConsumed).toBe(true);
    expect(result.courseSlug).toBe("redeem-1");
    expect(await isUserEnrolled(learner, courseId)).toBe(true);

    const row = await prisma.courseAccessCode.findUniqueOrThrow({ where: { code } });
    expect(row.status).toBe("redeemed");
    expect(row.redeemedByUserId).toBe(learner);
  });

  it("chuẩn hoá mã người dùng gõ lệch định dạng (thường/thiếu gạch nối)", async () => {
    const owner = await makeUser("redeem-norm-owner@e.com");
    const courseId = await paidCourse(owner, "redeem-norm");
    const learner = await makeUser("redeem-norm-learner@e.com");
    const { code } = (await generateAccessCodes(courseId, owner, 1))[0]!;
    const sloppy = code.toLowerCase().replace(/-/g, " ");

    const result = await redeemAccessCode(learner, sloppy);
    expect(result.created).toBe(true);
  });

  it("mã dùng rồi thì lượt sau bị chặn — không cộng đôi", async () => {
    const owner = await makeUser("redeem-twice-owner@e.com");
    const courseId = await paidCourse(owner, "redeem-twice");
    const first = await makeUser("redeem-twice-a@e.com");
    const second = await makeUser("redeem-twice-b@e.com");
    const { code } = (await generateAccessCodes(courseId, owner, 1))[0]!;

    await redeemAccessCode(first, code);
    expect(await codeOf(redeemAccessCode(second, code))).toBe("code_already_used");
    expect(await isUserEnrolled(second, courseId)).toBe(false);
  });

  it("mã không tồn tại và mã đã thu hồi đều bị chặn", async () => {
    const owner = await makeUser("redeem-bad-owner@e.com");
    const courseId = await paidCourse(owner, "redeem-bad");
    const learner = await makeUser("redeem-bad-learner@e.com");
    const row = (await generateAccessCodes(courseId, owner, 1))[0]!;
    await revokeAccessCode(courseId, row.id);

    expect(await codeOf(redeemAccessCode(learner, "ZZZZ-ZZZZ-ZZZZ"))).toBe("code_not_found");
    expect(await codeOf(redeemAccessCode(learner, row.code))).toBe("code_revoked");
  });

  it("đã ghi danh khoá từ trước thì không tiêu mã — mã vẫn dùng được cho người khác", async () => {
    const owner = await makeUser("redeem-dup-owner@e.com");
    // Khoá free để learner tự enroll trước, rồi vẫn cầm một mã của khoá đó.
    const courseId = await paidCourse(owner, "redeem-dup", { priceCents: 0 });
    const learner = await makeUser("redeem-dup-learner@e.com");
    // Section mặc định chỉ được tạo lười lúc có ghi danh thật, không tự có
    // ngay sau publish — dùng đúng hàm nội bộ resolveDefaultSectionId để lấy
    // (và tạo nếu chưa có) thay vì tự query rồi vỡ vì "No CourseSection found".
    const sectionId = await resolveDefaultSectionId(courseId, prisma);
    await prisma.enrollment.create({
      data: { userId: learner, courseId, sectionId, courseVersion: 1 },
    });
    const { code } = (await generateAccessCodes(courseId, owner, 1))[0]!;

    const result = await redeemAccessCode(learner, code);
    expect(result.created).toBe(false);
    expect(result.codeConsumed).toBe(false);

    const row = await prisma.courseAccessCode.findUniqueOrThrow({ where: { code } });
    expect(row.status).toBe("unused");
  });

  it("khoá chưa publish thì không đổi được", async () => {
    const owner = await makeUser("redeem-draft-owner@e.com");
    const courseId = await paidCourse(owner, "redeem-draft", { publish: false });
    const learner = await makeUser("redeem-draft-learner@e.com");
    const { code } = (await generateAccessCodes(courseId, owner, 1))[0]!;

    expect(await codeOf(redeemAccessCode(learner, code))).toBe("course_not_enrollable");
  });
});

describe("revokeAccessCode", () => {
  it("thu hồi mã chưa dùng thì đổi trạng thái; mã đã dùng thì từ chối", async () => {
    const owner = await makeUser("revoke-owner@e.com");
    const courseId = await paidCourse(owner, "revoke-1");
    const learner = await makeUser("revoke-learner@e.com");
    const generated = await generateAccessCodes(courseId, owner, 2);
    const unused = generated[0]!;
    const used = generated[1]!;
    await redeemAccessCode(learner, used.code);

    await revokeAccessCode(courseId, unused.id);
    expect(
      (await prisma.courseAccessCode.findUniqueOrThrow({ where: { id: unused.id } })).status,
    ).toBe("revoked");

    expect(await codeOf(revokeAccessCode(courseId, used.id))).toBe("code_already_used");
  });
});
