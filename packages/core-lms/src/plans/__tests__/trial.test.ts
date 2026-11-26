import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { grantTrialSubscriptions } from "../trial";
import { TRIAL_ENDS_AT } from "../config";
import { isFeatureEnabled, resolveFeature } from "../../auth/permissions";
import { isCenterEnabledForUser } from "../../org/centerAccess";
import { grantRole } from "../../auth/roles";
import { makeOrg, makeTeacher, makeUser, seedFlagsAndPlans } from "./planFixtures";

const oldEnv = process.env.PLANS_ENABLED;
beforeEach(async () => {
  process.env.PLANS_ENABLED = "1";
  // setup.ts không dọn Organization: dọn ở đây để chạy hết mọi tổ chức không chậm theo số rác tồn đọng.
  await prisma.organization.deleteMany();
  await seedFlagsAndPlans();
});
afterEach(() => {
  if (oldEnv === undefined) delete process.env.PLANS_ENABLED;
  else process.env.PLANS_ENABLED = oldEnv;
});

const trialsOf = (where: object) =>
  prisma.subscription.findMany({ where: { source: "trial", ...where }, include: { plan: true } });

describe("grantTrialSubscriptions", () => {
  it("chạy hai lần: mỗi giảng viên và tổ chức đúng một gói dùng thử", async () => {
    const actor = await makeUser("ad");
    const teacher = await makeTeacher();
    const org = await makeOrg("o");
    const now = new Date();
    const first = await grantTrialSubscriptions({ dryRun: false, actorUserId: actor, now });
    expect(first.usersGranted).toBeGreaterThanOrEqual(1);
    expect(first.orgsGranted).toBeGreaterThanOrEqual(1);
    const second = await grantTrialSubscriptions({ dryRun: false, actorUserId: actor, now });
    expect(second.usersGranted).toBe(0);
    expect(second.orgsGranted).toBe(0);
    const ts = await trialsOf({ userId: teacher });
    expect(ts).toHaveLength(1);
    expect(ts[0]!.plan.key).toBe("trial_individual");
    expect(ts[0]!.endsAt.getTime()).toBe(TRIAL_ENDS_AT.getTime());
    expect(ts[0]!.startsAt.getTime()).toBe(now.getTime());
    expect(ts[0]!.grantedById).toBe(actor);
    const os = await trialsOf({ organizationId: org.id });
    expect(os).toHaveLength(1);
    expect(os[0]!.plan.key).toBe("org_trial");
    const ev = await prisma.learningEvent.findMany({
      where: { eventKey: { in: [`plan.trial:user:${teacher}`, `plan.trial:org:${org.id}`] } },
    });
    expect(ev).toHaveLength(2);
    const audit = await prisma.auditLog.count({
      where: { action: "plan.subscription.assigned", targetUserId: teacher },
    });
    expect(audit).toBe(1);
  });

  it("học viên và admin không nhận gói dùng thử", async () => {
    const actor = await makeUser("ad");
    const learner = await makeUser("hv");
    await grantRole(actor, { targetUserId: actor, roleName: RoleName.Admin });
    await grantTrialSubscriptions({ dryRun: false, actorUserId: actor });
    expect(await trialsOf({ userId: learner })).toHaveLength(0);
    expect(await trialsOf({ userId: actor })).toHaveLength(0);
  });

  it("người có CourseInstructor (không vai trò giảng dạy) cũng nhận", async () => {
    const actor = await makeUser("ad");
    const u = await makeUser("ci");
    const course = await prisma.course.create({
      data: { title: "c", slug: `c-${Date.now()}`, description: "x" },
    });
    await prisma.courseInstructor.create({ data: { courseId: course.id, userId: u } });
    await grantTrialSubscriptions({ dryRun: false, actorUserId: actor });
    expect(await trialsOf({ userId: u })).toHaveLength(1);
  });

  it("dryRun không ghi dòng nào nhưng đếm và liệt kê override khoá sellable", async () => {
    const actor = await makeUser("ad");
    const teacher = await makeTeacher();
    const role = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.Instructor } });
    await prisma.roleFeatureOverride.create({
      data: { roleId: role.id, featureKey: "ai_oral.monthly_attempts", value: 5 },
    });
    const subs = await prisma.subscription.count();
    const events = await prisma.learningEvent.count({ where: { eventType: "plan.subscription.started" } });
    const r = await grantTrialSubscriptions({ dryRun: true, actorUserId: actor });
    expect(r.usersGranted).toBeGreaterThanOrEqual(1);
    expect(await prisma.subscription.count()).toBe(subs);
    expect(await prisma.learningEvent.count({ where: { eventType: "plan.subscription.started" } })).toBe(events);
    expect(await trialsOf({ userId: teacher })).toHaveLength(0);
    expect(r.sellableRoleOverrides).toContainEqual({
      roleName: RoleName.Instructor,
      featureKey: "ai_oral.monthly_attempts",
      value: 5,
    });
  });

  it("dryRun ném plan_not_found khi thiếu gói dùng thử trong danh mục", async () => {
    const actor = await makeUser("ad");
    await prisma.plan.deleteMany({ where: { key: "org_trial" } });
    await expect(grantTrialSubscriptions({ dryRun: true, actorUserId: actor })).rejects.toMatchObject({
      code: "plan_not_found",
      details: { planKey: "org_trial" },
    });
  });

  it("giảng viên dùng thử không bật tính năng trung tâm; limio_live.access từ gói thì bật", async () => {
    const actor = await makeUser("ad");
    const teacher = await makeTeacher();
    const before = await resolveFeature(teacher, "center.access");
    delete process.env.PLANS_ENABLED;
    const off = await resolveFeature(teacher, "center.access");
    process.env.PLANS_ENABLED = "1";
    expect(before).toBe(off);
    await grantTrialSubscriptions({ dryRun: false, actorUserId: actor });
    expect(await resolveFeature(teacher, "center.access")).toBe(off);
    expect(await isFeatureEnabled(teacher, "limio_live.access")).toBe(true);
    // Giảng viên thuộc trường tắt tính năng trung tâm, không vai trò trung tâm, chưa có lớp đặt lịch.
    const org = await prisma.organization.create({
      data: { code: `CT-${Date.now()}`, name: "t", centerEnabled: false },
    });
    await prisma.user.update({ where: { id: teacher }, data: { organizationId: org.id } });
    expect(await isCenterEnabledForUser(teacher)).toBe(false);
  });

  it("PLANS_ENABLED tắt → ném plans_disabled", async () => {
    delete process.env.PLANS_ENABLED;
    const actor = await makeUser("ad");
    await expect(grantTrialSubscriptions({ dryRun: true, actorUserId: actor })).rejects.toThrow("plans_disabled");
  });

  it("giảng viên dùng thử có quyền ≥ Pro ở mọi khoá", async () => {
    const actor = await makeUser("ad");
    const teacher = await makeTeacher();
    await grantTrialSubscriptions({ dryRun: false, actorUserId: actor });
    expect(await resolveFeature(teacher, "ai_oral.monthly_attempts")).toBe(100000);
  });
});
