import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import {
  assertUsageQuota,
  checkUsageQuota,
  getPlanLimit,
  PlanLimitError,
  vnDayKey,
  vnMonthRange,
} from "../quota";
import { setUserFeatureOverride } from "../../auth/permissions";
import { grantRole } from "../../auth/roles";
import { makeOrg, makeTeacher, makeUser, seedFlagsAndPlans } from "./planFixtures";

const HOUR = 3600_000;
const FAR = new Date("2099-01-01T00:00:00.000Z");
const MB = 1048576n;

let seq = 0;

async function subscribe(key: string, who: { userId?: string; organizationId?: string }) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { key } });
  return prisma.subscription.create({
    data: {
      planId: plan.id,
      ...who,
      source: key.includes("trial") ? "trial" : "admin",
      startsAt: new Date(Date.now() - HOUR),
      endsAt: FAR,
    },
  });
}

async function joinOrg(userId: string, organizationId: string) {
  await prisma.user.update({ where: { id: userId }, data: { organizationId } });
}

async function makeCourse(ownerId?: string) {
  seq += 1;
  const course = await prisma.course.create({
    data: { title: "c", slug: `quota-${seq}-${Date.now()}`, description: "x" },
  });
  if (ownerId) {
    await prisma.courseInstructor.create({ data: { courseId: course.id, userId: ownerId, role: "owner" } });
  }
  return course;
}

async function makeExam(opts: { createdById?: string | null; courseId?: string; kind?: "oral" | "written" }) {
  return prisma.exam.create({
    data: {
      title: "vấn đáp",
      durationMin: 10,
      openAt: new Date(Date.now() - 24 * HOUR),
      closeAt: FAR,
      kind: opts.kind ?? "oral",
      createdById: opts.createdById ?? null,
      courseId: opts.courseId ?? null,
    },
  });
}

/** Tạo n lượt cho một đề, lúc `startedAt` (mặc định: 1 giờ sau đầu tháng giờ VN). */
async function addAttempts(examId: string, n: number, startedAt?: Date) {
  const at = startedAt ?? new Date(vnMonthRange(new Date()).start.getTime() + HOUR);
  // Mỗi (đề, học viên) chỉ một lượt ⇒ mỗi lượt một học viên.
  seq += 1;
  const stamp = `${seq}-${Date.now()}`;
  const ids = Array.from({ length: n }, (_, i) => `sv-${stamp}-${i}`);
  await prisma.user.createMany({
    data: ids.map((id) => ({ id, email: `${id}@e.com`, displayName: "sv" })),
  });
  await prisma.examAttempt.createMany({
    data: ids.map((userId) => ({ examId, userId, durationSec: 600, startedAt: at })),
  });
}

/** Giảng viên có n lượt vấn đáp trong tháng trên đề của chính mình. */
async function oralAttemptsFor(userId: string, n: number) {
  const exam = await makeExam({ createdById: userId });
  await addAttempts(exam.id, n);
  return exam;
}

async function limitEvents(userId: string) {
  return prisma.learningEvent.findMany({ where: { userId, eventType: "plan.limit.reached" } });
}

async function addFile(billedUserId: string, kind: string, mb: bigint) {
  seq += 1;
  await prisma.storedFile.create({
    data: { layer: "uploads", key: `k-${seq}-${Date.now()}`, sizeBytes: mb * MB, kind, billedUserId },
  });
}

const oldEnv = process.env.PLANS_ENABLED;
beforeEach(async () => {
  process.env.PLANS_ENABLED = "1";
  await prisma.organization.deleteMany();
  await seedFlagsAndPlans();
});
afterEach(() => {
  if (oldEnv === undefined) delete process.env.PLANS_ENABLED;
  else process.env.PLANS_ENABLED = oldEnv;
});

describe("vnMonthRange / vnDayKey", () => {
  it("23:30 ngày 30/11 giờ VN thuộc tháng 11; 00:10 ngày 1/12 giờ VN thuộc tháng 12", () => {
    const nov = vnMonthRange(new Date("2026-11-30T16:30:00Z"));
    expect(nov.start.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(nov.end.toISOString()).toBe("2026-11-30T17:00:00.000Z");
    const dec = vnMonthRange(new Date("2026-11-30T17:10:00Z"));
    expect(dec.start.toISOString()).toBe("2026-11-30T17:00:00.000Z");
    expect(dec.end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("vnDayKey theo giờ VN", () => {
    expect(vnDayKey(new Date("2026-11-30T16:30:00Z"))).toBe("2026-11-30");
    expect(vnDayKey(new Date("2026-11-30T17:10:00Z"))).toBe("2026-12-01");
  });
});

describe("checkUsageQuota — ai_oral.monthly_attempts", () => {
  it("giảng viên không gói, 2 lượt ⇒ hết hạn mức gói free", async () => {
    const teacher = await makeTeacher();
    await oralAttemptsFor(teacher, 2);
    const r = await checkUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    expect(r).toEqual({ allowed: false, limit: 2, used: 2, source: "individual", planKey: "free" });
  });

  it("gói cá nhân hết nhưng quỹ tổ chức còn ⇒ được, nguồn tổ chức", async () => {
    const org = await makeOrg("khoa");
    const teacher = await makeTeacher();
    const other = await makeTeacher("gv2");
    await joinOrg(teacher, org.id);
    await joinOrg(other, org.id);
    await subscribe("org_khoa", { organizationId: org.id });
    await oralAttemptsFor(teacher, 2);
    await oralAttemptsFor(other, 8);
    const r = await checkUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    expect(r.allowed).toBe(true);
    expect(r.source).toBe("organization");
    expect(r.limit).toBe(125);
    expect(r.used).toBe(10);
    expect(r.planKey).toBe("org_khoa");
    expect(r.organizationName).toBe("khoa");
  });

  it("quỹ tổ chức hết nhưng Pro cá nhân còn ⇒ được, nguồn cá nhân", async () => {
    const org = await makeOrg("khoa");
    const teacher = await makeTeacher();
    const other = await makeTeacher("gv2");
    await joinOrg(teacher, org.id);
    await joinOrg(other, org.id);
    await subscribe("org_khoa", { organizationId: org.id });
    await subscribe("pro", { userId: teacher });
    await oralAttemptsFor(teacher, 5);
    await oralAttemptsFor(other, 120);
    const r = await checkUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    expect(r).toMatchObject({ allowed: true, source: "individual", limit: 30, used: 5, planKey: "pro" });
  });

  it("cả hai nguồn hết ⇒ từ chối, trả nguồn có hạn mức lớn hơn", async () => {
    const org = await makeOrg("khoa");
    const teacher = await makeTeacher();
    await joinOrg(teacher, org.id);
    await subscribe("org_khoa", { organizationId: org.id });
    await oralAttemptsFor(teacher, 125);
    const r = await checkUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    expect(r).toMatchObject({
      allowed: false,
      source: "organization",
      limit: 125,
      used: 125,
      planKey: "org_khoa",
      organizationName: "khoa",
    });
  });

  it("lượt tháng trước, đề viết không tính; đề không createdById tính cho chủ khoá", async () => {
    const teacher = await makeTeacher();
    const lastMonth = new Date(vnMonthRange(new Date()).start.getTime() - HOUR);
    const own = await makeExam({ createdById: teacher });
    await addAttempts(own.id, 3, lastMonth);
    const written = await makeExam({ createdById: teacher, kind: "written" });
    await addAttempts(written.id, 3);
    const course = await makeCourse(teacher);
    const orphan = await makeExam({ createdById: null, courseId: course.id });
    await addAttempts(orphan.id, 1);
    // Đề của người khác (có createdById) trong khoá của giảng viên: không tính cho chủ khoá.
    const someone = await makeTeacher("khac");
    const foreign = await makeExam({ createdById: someone, courseId: course.id });
    await addAttempts(foreign.id, 4);

    const r = await checkUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts", { increment: 0 });
    expect(r.used).toBe(1);
    const r1 = await checkUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    expect(r1.allowed).toBe(true);
  });

  it("PLANS_ENABLED tắt ⇒ không giới hạn", async () => {
    process.env.PLANS_ENABLED = "";
    const teacher = await makeTeacher();
    await oralAttemptsFor(teacher, 5);
    const r = await checkUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    expect(r).toEqual({ allowed: true, limit: null, used: 0, source: null, planKey: null });
    expect(await limitEvents(teacher)).toHaveLength(0);
  });

  it("học viên và admin ⇒ không giới hạn theo gói", async () => {
    const learner = await makeUser("hv");
    const admin = await makeTeacher("ad");
    await grantRole(admin, { targetUserId: admin, roleName: RoleName.Admin });
    await oralAttemptsFor(admin, 5);
    for (const userId of [learner, admin]) {
      const r = await checkUsageQuota({ userId }, "ai_oral.monthly_attempts");
      expect(r.limit).toBeNull();
      expect(r.allowed).toBe(true);
    }
  });

  it("người dùng thử vượt mức gói tham chiếu ⇒ được, ghi một sự kiện enforced=false mỗi ngày", async () => {
    const teacher = await makeTeacher();
    await subscribe("trial_individual", { userId: teacher });
    await oralAttemptsFor(teacher, 31);
    const r = await checkUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    expect(r).toMatchObject({ allowed: true, source: "individual", planKey: "trial_individual" });
    let ev = await limitEvents(teacher);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({
      metric: "ai_oral.monthly_attempts",
      enforced: false,
      limit: 30,
      used: 31,
      planKey: "trial_individual",
      source: "individual",
    });
    expect(ev[0]!.eventKey).toBe(`plan.limit.reached:${teacher}:ai_oral.monthly_attempts:${vnDayKey(new Date())}`);
    await checkUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    ev = await limitEvents(teacher);
    expect(ev).toHaveLength(1);
  });

  it("người dùng thử chưa vượt mức gói tham chiếu ⇒ không sự kiện", async () => {
    const teacher = await makeTeacher();
    await subscribe("trial_individual", { userId: teacher });
    await oralAttemptsFor(teacher, 10);
    const r = await checkUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    expect(r.allowed).toBe(true);
    expect(await limitEvents(teacher)).toHaveLength(0);
  });

  it("assertUsageQuota khi hết ⇒ ném PlanLimitError, sự kiện enforced=true không lộ email", async () => {
    const teacher = await makeTeacher();
    await oralAttemptsFor(teacher, 2);
    let err: unknown;
    try {
      await assertUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PlanLimitError);
    const pe = err as PlanLimitError;
    expect(pe.code).toBe("plan_limit_reached");
    expect(pe.details).toMatchObject({
      key: "ai_oral.monthly_attempts",
      limit: 2,
      used: 2,
      source: "individual",
      planKey: "free",
    });
    const ev = await limitEvents(teacher);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({ enforced: true, limit: 2, used: 2 });
    expect(JSON.stringify(ev[0]!.payload)).not.toContain("@");
  });

  it("assertUsageQuota còn chỗ ⇒ trả kết quả", async () => {
    const teacher = await makeTeacher();
    await oralAttemptsFor(teacher, 1);
    const r = await assertUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    expect(r).toMatchObject({ allowed: true, limit: 2, used: 1 });
  });

  it("UserFeatureOverride còn hạn là hạn mức cá nhân", async () => {
    const teacher = await makeTeacher();
    await setUserFeatureOverride(teacher, teacher, "ai_oral.monthly_attempts", 10, "tặng");
    await oralAttemptsFor(teacher, 5);
    const r = await checkUsageQuota({ userId: teacher }, "ai_oral.monthly_attempts");
    expect(r).toMatchObject({ allowed: true, limit: 10, used: 5, source: "individual" });
  });
});

describe("checkUsageQuota — storage.mb", () => {
  it("tệp học viên không tính; tệp nội dung đầy hạn mức ⇒ từ chối thêm 1 MB", async () => {
    const teacher = await makeTeacher();
    await addFile(teacher, "submission", 3072n);
    const r0 = await checkUsageQuota({ userId: teacher }, "storage.mb", { increment: 0 });
    expect(r0).toMatchObject({ allowed: true, used: 0, limit: 2048 });
    await addFile(teacher, "lesson_video", 2048n);
    const r1 = await checkUsageQuota({ userId: teacher }, "storage.mb", { increment: 1 });
    expect(r1).toMatchObject({ allowed: false, used: 2048, limit: 2048, source: "individual", planKey: "free" });
  });

  it("làm tròn lên MB; tệp đã xoá không tính; quỹ tổ chức cộng mọi thành viên", async () => {
    const org = await makeOrg("khoa");
    const teacher = await makeTeacher();
    const other = await makeTeacher("gv2");
    await joinOrg(teacher, org.id);
    await joinOrg(other, org.id);
    await subscribe("org_khoa", { organizationId: org.id });
    await prisma.storedFile.create({
      data: { layer: "uploads", key: `half-${Date.now()}`, sizeBytes: MB / 2n, kind: "image", billedUserId: teacher },
    });
    await prisma.storedFile.create({
      data: {
        layer: "uploads",
        key: `gone-${Date.now()}`,
        sizeBytes: 5000n * MB,
        kind: "image",
        billedUserId: teacher,
        deletedAt: new Date(),
      },
    });
    const r = await checkUsageQuota({ userId: teacher }, "storage.mb", { increment: 0 });
    expect(r).toMatchObject({ allowed: true, used: 1, source: "individual" });
    await addFile(other, "lesson_video", 3000n);
    const r2 = await checkUsageQuota({ userId: teacher }, "storage.mb", { increment: 2048 });
    // Cá nhân: 1 + 2048 > 2048 ⇒ không; tổ chức: tổng 3001 + 2048 <= 204800 ⇒ được.
    expect(r2).toMatchObject({ allowed: true, source: "organization", used: 3001, limit: 204800 });
  });
});

describe("checkUsageQuota — org.max_instructors", () => {
  it("org_khoa (30) đã có 30 giảng viên ⇒ từ chối thêm", async () => {
    const org = await makeOrg("khoa");
    await subscribe("org_khoa", { organizationId: org.id });
    const role = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.Instructor } });
    const stamp = Date.now();
    for (let i = 0; i < 30; i++) {
      await prisma.user.create({
        data: {
          email: `inst-${i}-${stamp}@e.com`,
          displayName: `gv${i}`,
          organizationId: org.id,
          userRoles: { create: { roleId: role.id } },
        },
      });
    }
    // Học viên của tổ chức không tính.
    await prisma.user.create({ data: { email: `hv-${stamp}@e.com`, displayName: "hv", organizationId: org.id } });
    const actor = await makeUser("oa");
    const r = await checkUsageQuota({ organizationId: org.id, userId: actor }, "org.max_instructors");
    expect(r).toMatchObject({
      allowed: false,
      limit: 30,
      used: 30,
      source: "organization",
      planKey: "org_khoa",
      organizationName: "khoa",
    });
    const ev = await limitEvents(actor);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({ metric: "org.max_instructors", enforced: true });
  });

  it("tổ chức không gói ⇒ không giới hạn", async () => {
    const org = await makeOrg("tudo");
    const r = await checkUsageQuota({ organizationId: org.id }, "org.max_instructors");
    expect(r.limit).toBeNull();
    expect(r.allowed).toBe(true);
  });
});

describe("getPlanLimit", () => {
  it("Free ⇒ 100; override ⇒ thắng gói; dùng thử ⇒ trần kỹ thuật; tắt tầng gói ⇒ null", async () => {
    const free = await makeTeacher();
    expect(await getPlanLimit(free, "activity.max_responses")).toBe(100);

    const gifted = await makeTeacher();
    await setUserFeatureOverride(gifted, gifted, "activity.max_responses", 250, "tặng");
    expect(await getPlanLimit(gifted, "activity.max_responses")).toBe(250);

    const trial = await makeTeacher();
    await subscribe("trial_individual", { userId: trial });
    expect(await getPlanLimit(trial, "activity.max_responses")).toBe(500);

    const learner = await makeUser("hv");
    expect(await getPlanLimit(learner, "activity.max_responses")).toBeNull();

    process.env.PLANS_ENABLED = "";
    expect(await getPlanLimit(free, "activity.max_responses")).toBeNull();
  });

  it("override vượt trần kỹ thuật ⇒ cắt về trần", async () => {
    const teacher = await makeTeacher();
    await setUserFeatureOverride(teacher, teacher, "gameshow.max_participants", 9999, "tặng");
    expect(await getPlanLimit(teacher, "gameshow.max_participants")).toBe(300);
  });
});
