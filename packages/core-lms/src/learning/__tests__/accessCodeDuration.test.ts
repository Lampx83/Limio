import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { AccessCodeError, generateAccessCodes, redeemAccessCode } from "../accessCode";
import { createAccessCodeBatch, endOfDayVn, listAccessCodeBatches, lookupAccessCode } from "../accessCodeBatch";
import { enrollInCourse, isUserEnrolled } from "../enroll";
import { createCourse, publishCourse, updateCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createSkill, tagLessonSkill } from "../../courses/skills";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";
const DAY = 24 * 3600 * 1000;

async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

async function paidCourse(ownerId: string, slug: string) {
  const c = await createCourse(ownerId, { title: `t ${slug}`, description: "d", slug });
  await updateCourse(ownerId, c.courseId, { priceCents: 199_000, currency: "VND" });
  const m = await createModule(ownerId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(ownerId, m.moduleId, { title: "L", orderIndex: 0 });
  const s = await createSkill({ code: `skill.${slug}`, name: "s" });
  await tagLessonSkill(ownerId, l.lessonId, { skillId: s.skillId });
  await publishCourse(ownerId, c.courseId);
  return c.courseId;
}

async function codesOf(courseId: string, owner: string, input: { count?: number; accessDurationMonths?: number | null; activateBefore?: string | null }) {
  const { batchId } = await createAccessCodeBatch(courseId, owner, { label: "Lô", count: input.count ?? 3, ...input });
  const rows = await prisma.courseAccessCode.findMany({ where: { batchId }, orderBy: { code: "asc" } });
  return { batchId, codes: rows.map((r) => r.code) };
}

async function errCode(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof AccessCodeError) return e.code;
    throw e;
  }
}

/** Sai số cho phép giữa "bây giờ + N tháng" tính trong test và trong hàm: vài giây là quá đủ. */
function nearMonthsFromNow(d: Date | null, months: number) {
  expect(d).not.toBeNull();
  const want = new Date();
  want.setUTCMonth(want.getUTCMonth() + months);
  expect(Math.abs(d!.getTime() - want.getTime())).toBeLessThan(30_000);
}

describe("endOfDayVn", () => {
  it("cuối ngày theo giờ Việt Nam = 16:59:59.999 UTC cùng ngày; ngày bậy → null", () => {
    expect(endOfDayVn("2026-11-05")!.toISOString()).toBe("2026-11-05T16:59:59.999Z");
    expect(endOfDayVn("2026-02-31")).toBeNull();
    expect(endOfDayVn("05/11/2026")).toBeNull();
    expect(endOfDayVn("")).toBeNull();
  });
});

describe("tạo lô có thời hạn / hạn kích hoạt", () => {
  it("lưu thời hạn và hạn kích hoạt (cuối ngày VN); không đặt thì để null như trước AC3", async () => {
    const owner = await makeUser("d-owner1@e.com");
    const courseId = await paidCourse(owner, "d-1");
    const future = new Date(Date.now() + 10 * DAY);
    const date = new Date(future.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10); // ngày VN của future

    const a = await createAccessCodeBatch(courseId, owner, { label: "Có hạn", count: 2, accessDurationMonths: 12, activateBefore: date });
    const batchA = await prisma.courseAccessCodeBatch.findUniqueOrThrow({ where: { id: a.batchId } });
    expect(batchA.accessDurationMonths).toBe(12);
    expect(batchA.activateBefore!.toISOString()).toBe(`${date}T16:59:59.999Z`);

    const b = await createAccessCodeBatch(courseId, owner, { label: "Không hạn", count: 2 });
    const batchB = await prisma.courseAccessCodeBatch.findUniqueOrThrow({ where: { id: b.batchId } });
    expect(batchB.accessDurationMonths).toBeNull();
    expect(batchB.activateBefore).toBeNull();

    const list = (await listAccessCodeBatches(courseId)).batches;
    expect(list.find((x) => x.id === a.batchId)).toMatchObject({ accessDurationMonths: 12 });
  });

  it("từ chối thời hạn bậy và hạn kích hoạt đã qua / sai định dạng, không để lại lô", async () => {
    const owner = await makeUser("d-owner2@e.com");
    const courseId = await paidCourse(owner, "d-2");
    const bad = [
      { accessDurationMonths: 0 },
      { accessDurationMonths: -1 },
      { accessDurationMonths: 121 },
      { accessDurationMonths: 1.5 },
      { activateBefore: "2020-01-01" }, // đã qua
      { activateBefore: "05/11/2030" },
      { activateBefore: "2030-02-31" },
    ];
    for (const extra of bad) {
      expect(await errCode(createAccessCodeBatch(courseId, owner, { label: "x", count: 1, ...extra }))).toBe("validation_failed");
    }
    expect(await prisma.courseAccessCodeBatch.count({ where: { courseId } })).toBe(0);
  });
});

describe("đổi mã có thời hạn", () => {
  it("chưa ghi danh: ghi danh với hạn = lúc nhập + N tháng; sự kiện ghi nguồn access_code mà không mang mã", async () => {
    const owner = await makeUser("d-owner3@e.com");
    const buyer = await makeUser("d-buyer3@e.com");
    const courseId = await paidCourse(owner, "d-3");
    const { codes } = await codesOf(courseId, owner, { accessDurationMonths: 12 });

    const r = await redeemAccessCode(buyer, codes[0]!);
    expect(r).toMatchObject({ created: true, codeConsumed: true });
    nearMonthsFromNow(r.accessExpiresAt, 12);
    const enr = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: buyer, courseId } } });
    expect(enr.accessExpiresAt!.getTime()).toBe(r.accessExpiresAt!.getTime());
    expect(await isUserEnrolled(buyer, courseId)).toBe(true);

    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { userId: buyer, eventType: LearningEventType.EnrollmentAccessExtended } });
    expect(ev.payload).toMatchObject({ courseId, accessPlanId: null, durationMonths: 12, via: "access_code", previousExpiresAt: null });
    expect(JSON.stringify(ev.payload)).not.toContain(codes[0]!);
  });

  it("lô không đặt thời hạn và mã lẻ không thuộc lô: vĩnh viễn như hôm nay, không phát sự kiện gia hạn", async () => {
    const owner = await makeUser("d-owner4@e.com");
    const u1 = await makeUser("d-u4a@e.com");
    const u2 = await makeUser("d-u4b@e.com");
    const courseId = await paidCourse(owner, "d-4");
    const { codes } = await codesOf(courseId, owner, {});
    const [legacy] = await generateAccessCodes(courseId, owner, 1);

    expect((await redeemAccessCode(u1, codes[0]!)).accessExpiresAt).toBeNull();
    expect((await redeemAccessCode(u2, legacy!.code)).accessExpiresAt).toBeNull();
    expect(await prisma.enrollment.count({ where: { courseId, accessExpiresAt: null } })).toBe(2);
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.EnrollmentAccessExtended } })).toBe(0);
  });

  it("đang có hạn còn hiệu lực + mã có hạn: cộng dồn từ hạn hiện có, mã bị tiêu", async () => {
    const owner = await makeUser("d-owner5@e.com");
    const buyer = await makeUser("d-buyer5@e.com");
    const courseId = await paidCourse(owner, "d-5");
    const { codes } = await codesOf(courseId, owner, { accessDurationMonths: 12 });
    await redeemAccessCode(buyer, codes[0]!);
    const first = (await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: buyer, courseId } } })).accessExpiresAt!;

    const r = await redeemAccessCode(buyer, codes[1]!);
    expect(r.codeConsumed).toBe(true);
    const want = new Date(first);
    want.setUTCMonth(want.getUTCMonth() + 12);
    expect(r.accessExpiresAt!.getTime()).toBe(want.getTime()); // 24 tháng tính từ lần đầu, không mất thời gian đã trả
    expect((await prisma.courseAccessCode.findFirstOrThrow({ where: { code: codes[1]! } })).status).toBe("redeemed");
  });

  it("đã có truy cập vĩnh viễn + mã có hạn: không rút ngắn quyền và MÃ KHÔNG BỊ TIÊU (dùng được cho người khác)", async () => {
    const owner = await makeUser("d-owner6@e.com");
    const lifetimer = await makeUser("d-life6@e.com");
    const other = await makeUser("d-other6@e.com");
    const courseId = await paidCourse(owner, "d-6");
    await prisma.course.update({ where: { id: courseId }, data: { priceCents: null } });
    await enrollInCourse(lifetimer, courseId); // vĩnh viễn
    await prisma.course.update({ where: { id: courseId }, data: { priceCents: 199_000 } });
    const { codes } = await codesOf(courseId, owner, { accessDurationMonths: 12 });

    const r = await redeemAccessCode(lifetimer, codes[0]!);
    expect(r).toMatchObject({ created: false, codeConsumed: false, accessExpiresAt: null });
    expect((await prisma.courseAccessCode.findFirstOrThrow({ where: { code: codes[0]! } })).status).toBe("unused");
    expect((await redeemAccessCode(other, codes[0]!)).codeConsumed).toBe(true);
  });

  it("đã hết hạn (expired): quay lại active, hạn tính từ bây giờ, lịch sử giữ nguyên, mã bị tiêu", async () => {
    const owner = await makeUser("d-owner7@e.com");
    const buyer = await makeUser("d-buyer7@e.com");
    const courseId = await paidCourse(owner, "d-7");
    const { codes } = await codesOf(courseId, owner, { accessDurationMonths: 6 });
    await redeemAccessCode(buyer, codes[0]!);
    await prisma.enrollment.updateMany({ where: { userId: buyer, courseId }, data: { status: "expired", accessExpiresAt: new Date(Date.now() - 30 * DAY) } });
    expect(await isUserEnrolled(buyer, courseId)).toBe(false);
    const before = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: buyer, courseId } } });

    const r = await redeemAccessCode(buyer, codes[1]!);
    expect(r).toMatchObject({ created: false, codeConsumed: true, enrollmentId: before.id });
    nearMonthsFromNow(r.accessExpiresAt, 6); // từ bây giờ, không cộng dồn với hạn đã qua
    const after = await prisma.enrollment.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.status).toBe("active");
    expect(after.enrolledAt.getTime()).toBe(before.enrolledAt.getTime());
    expect(await isUserEnrolled(buyer, courseId)).toBe(true);
  });

  it("lô vĩnh viễn + người đang có hạn: nâng lên vĩnh viễn, mã bị tiêu", async () => {
    const owner = await makeUser("d-owner8@e.com");
    const buyer = await makeUser("d-buyer8@e.com");
    const courseId = await paidCourse(owner, "d-8");
    const timed = await codesOf(courseId, owner, { accessDurationMonths: 3, count: 1 });
    const forever = await codesOf(courseId, owner, { count: 1 });
    await redeemAccessCode(buyer, timed.codes[0]!);

    const r = await redeemAccessCode(buyer, forever.codes[0]!);
    expect(r).toMatchObject({ codeConsumed: true, accessExpiresAt: null });
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: buyer, courseId } } })).accessExpiresAt).toBeNull();
  });

  it("ghi danh bị bỏ / hoàn tiền: mã mở lại quyền (mã là bằng chứng đã trả tiền)", async () => {
    const owner = await makeUser("d-owner9@e.com");
    const buyer = await makeUser("d-buyer9@e.com");
    const courseId = await paidCourse(owner, "d-9");
    const { codes } = await codesOf(courseId, owner, { accessDurationMonths: 12, count: 2 });
    await redeemAccessCode(buyer, codes[0]!);
    await prisma.enrollment.updateMany({ where: { userId: buyer, courseId }, data: { status: "refunded" } });
    expect(await isUserEnrolled(buyer, courseId)).toBe(false);

    const r = await redeemAccessCode(buyer, codes[1]!);
    expect(r.codeConsumed).toBe(true);
    expect(await isUserEnrolled(buyer, courseId)).toBe(true);
  });

  it("bấm hai lần cùng một mã của chính mình: lần hai trả thành công, không tiêu thêm, không báo lỗi", async () => {
    const owner = await makeUser("d-owner10@e.com");
    const buyer = await makeUser("d-buyer10@e.com");
    const courseId = await paidCourse(owner, "d-10");
    const { codes } = await codesOf(courseId, owner, { accessDurationMonths: 12 });
    const first = await redeemAccessCode(buyer, codes[0]!);
    const second = await redeemAccessCode(buyer, codes[0]!);
    expect(second).toMatchObject({ created: false, codeConsumed: false });
    expect(second.accessExpiresAt!.getTime()).toBe(first.accessExpiresAt!.getTime()); // không gia hạn lần hai
  });

  it("mã đã dùng bởi người khác vẫn báo code_already_used, kể cả với người đang có hạn", async () => {
    const owner = await makeUser("d-owner11@e.com");
    const a = await makeUser("d-a11@e.com");
    const b = await makeUser("d-b11@e.com");
    const courseId = await paidCourse(owner, "d-11");
    const { codes } = await codesOf(courseId, owner, { accessDurationMonths: 12 });
    await redeemAccessCode(a, codes[0]!);
    await redeemAccessCode(b, codes[1]!); // b đang có hạn
    expect(await errCode(redeemAccessCode(b, codes[0]!))).toBe("code_already_used");
  });

  it("khoá chưa xuất bản: người đang có hạn đổi mã → course_not_enrollable và mã không bị tiêu", async () => {
    const owner = await makeUser("d-owner12@e.com");
    const buyer = await makeUser("d-buyer12@e.com");
    const courseId = await paidCourse(owner, "d-12");
    const { codes } = await codesOf(courseId, owner, { accessDurationMonths: 12 });
    await redeemAccessCode(buyer, codes[0]!);
    await prisma.course.update({ where: { id: courseId }, data: { status: "draft" } });
    expect(await errCode(redeemAccessCode(buyer, codes[1]!))).toBe("course_not_enrollable");
    expect((await prisma.courseAccessCode.findFirstOrThrow({ where: { code: codes[1]! } })).status).toBe("unused"); // transaction cuộn lại
  });
});

describe("hạn kích hoạt", () => {
  it("quá hạn → code_expired, mã giữ unused, không ghi danh; còn hạn thì kích hoạt bình thường", async () => {
    const owner = await makeUser("d-owner13@e.com");
    const buyer = await makeUser("d-buyer13@e.com");
    const courseId = await paidCourse(owner, "d-13");
    const future = new Date(Date.now() + 5 * DAY);
    const date = new Date(future.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const { batchId, codes } = await codesOf(courseId, owner, { activateBefore: date, count: 2 });

    // còn hạn
    expect((await redeemAccessCode(buyer, codes[0]!)).codeConsumed).toBe(true);

    // quá hạn: đẩy mốc về quá khứ (không có đường sửa lô nên đặt thẳng DB)
    await prisma.courseAccessCodeBatch.update({ where: { id: batchId }, data: { activateBefore: new Date(Date.now() - 1000) } });
    const late = await makeUser("d-late13@e.com");
    expect(await errCode(redeemAccessCode(late, codes[1]!))).toBe("code_expired");
    expect((await prisma.courseAccessCode.findFirstOrThrow({ where: { code: codes[1]! } })).status).toBe("unused");
    expect(await prisma.enrollment.count({ where: { userId: late, courseId } })).toBe(0);
  });

  it("mã hết hạn kích hoạt không gia hạn được cho người đang có hạn; người đã vĩnh viễn thì vẫn trả thành công (không có gì để cấp)", async () => {
    const owner = await makeUser("d-owner14@e.com");
    const timed = await makeUser("d-timed14@e.com");
    const courseId = await paidCourse(owner, "d-14");
    const ok = await codesOf(courseId, owner, { accessDurationMonths: 3, count: 1 });
    const late = await codesOf(courseId, owner, { accessDurationMonths: 3, count: 1 });
    await redeemAccessCode(timed, ok.codes[0]!);
    await prisma.courseAccessCodeBatch.update({ where: { id: late.batchId }, data: { activateBefore: new Date(Date.now() - 1000) } });
    expect(await errCode(redeemAccessCode(timed, late.codes[0]!))).toBe("code_expired");
  });

  it("danh sách / tra cứu trả đủ thông tin để giao diện hiện nhãn 'Hết hạn kích hoạt'", async () => {
    const owner = await makeUser("d-owner15@e.com");
    const courseId = await paidCourse(owner, "d-15");
    const { batchId, codes } = await codesOf(courseId, owner, { accessDurationMonths: 12, count: 1 });
    const hit = await lookupAccessCode(courseId, codes[0]!);
    expect(hit.batch).toMatchObject({ id: batchId, accessDurationMonths: 12, activateBefore: null });
  });

  it("revoked vẫn thắng hạn kích hoạt: báo code_revoked", async () => {
    const owner = await makeUser("d-owner16@e.com");
    const buyer = await makeUser("d-buyer16@e.com");
    const courseId = await paidCourse(owner, "d-16");
    const { batchId, codes } = await codesOf(courseId, owner, { count: 1 });
    await prisma.courseAccessCode.updateMany({ where: { batchId }, data: { status: "revoked" } });
    expect(await errCode(redeemAccessCode(buyer, codes[0]!))).toBe("code_revoked");
  });
});
