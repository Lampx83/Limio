import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@feedbackme/db";
import { PlanError } from "../entitlements";
import {
  assignSubscription,
  cancelSubscription,
  extendSubscription,
  listPlansForAdmin,
  listSubscriptions,
  updatePlan,
  upsertPlanPrice,
} from "../admin";
import { getEffectivePlan } from "../subscriptions";
import { resolveFeature } from "../../auth/permissions";
import { isLearnerActivityType } from "../../learning/activity";
import { makeOrg, makeTeacher, makeUser, seedFlagsAndPlans } from "./planFixtures";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const FAR = new Date("2099-01-01T00:00:00.000Z");
const oldEnv = process.env.PLANS_ENABLED;

beforeEach(async () => {
  process.env.PLANS_ENABLED = "1";
  await seedFlagsAndPlans();
});
afterEach(() => {
  if (oldEnv === undefined) delete process.env.PLANS_ENABLED;
  else process.env.PLANS_ENABLED = oldEnv;
});

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof PlanError) return e.code;
    throw e;
  }
  return null;
}

describe("assignSubscription", () => {
  it("gán org_truong cho tổ chức: có AuditLog, có sự kiện, giảng viên thấy quyền từ startsAt", async () => {
    const admin = await makeUser("ad");
    const org = await makeOrg("truong");
    const teacher = await makeTeacher();
    await prisma.user.update({ where: { id: teacher }, data: { organizationId: org.id } });
    const startsAt = new Date(Date.now() - HOUR);
    const { subscriptionId } = await assignSubscription(admin, {
      planKey: "org_truong",
      organizationId: org.id,
      startsAt,
      endsAt: FAR,
      source: "contract",
      note: "HĐ 01",
    });
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(sub.grantedById).toBe(admin);
    expect((await getEffectivePlan(teacher))?.planKey).toBe("org_truong");
    expect(await resolveFeature(teacher, "storage.mb")).toBeGreaterThan(2048);

    const audit = await prisma.auditLog.findMany({ where: { action: "plan.subscription.assigned" } });
    expect(audit).toHaveLength(1);
    const ev = await prisma.learningEvent.findMany({ where: { eventType: "plan.subscription.started" } });
    expect(ev).toHaveLength(1);
    expect(ev[0]?.userId).toBe(admin);
    expect(ev[0]?.courseId).toBeNull();
    expect(((ev[0]?.payload ?? {}) as { organizationId?: string }).organizationId).toBe(org.id);
  });

  it("gán cá nhân: subject là người nhận, audit có targetUserId", async () => {
    const admin = await makeUser("ad");
    const teacher = await makeTeacher();
    const { subscriptionId } = await assignSubscription(admin, {
      planKey: "pro",
      userId: teacher,
      startsAt: new Date(Date.now() - HOUR),
      endsAt: FAR,
      source: "admin",
    });
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: "plan.subscription.started" } });
    expect(ev.userId).toBe(teacher);
    expect((ev.payload as { subscriptionId: string }).subscriptionId).toBe(subscriptionId);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "plan.subscription.assigned" } });
    expect(audit.targetUserId).toBe(teacher);
    expect(audit.actorUserId).toBe(admin);
  });

  it("gán gói individual cho tổ chức → invalid_subject; endsAt ≤ startsAt → invalid_dates", async () => {
    const admin = await makeUser("ad");
    const org = await makeOrg("x");
    const teacher = await makeTeacher();
    const now = new Date();
    const base = { startsAt: now, endsAt: FAR, source: "admin" as const };
    expect(await codeOf(assignSubscription(admin, { ...base, planKey: "pro", organizationId: org.id }))).toBe("invalid_subject");
    expect(await codeOf(assignSubscription(admin, { ...base, planKey: "org_truong", userId: teacher }))).toBe("invalid_subject");
    expect(await codeOf(assignSubscription(admin, { ...base, planKey: "pro" }))).toBe("invalid_subject");
    expect(await codeOf(assignSubscription(admin, { ...base, planKey: "pro", userId: teacher, organizationId: org.id }))).toBe("invalid_subject");
    expect(await codeOf(assignSubscription(admin, { ...base, planKey: "pro", userId: "no-such-user" }))).toBe("invalid_subject");
    expect(await codeOf(assignSubscription(admin, { ...base, planKey: "nope", userId: teacher }))).toBe("plan_not_found");
    expect(
      await codeOf(assignSubscription(admin, { ...base, planKey: "pro", userId: teacher, endsAt: now })),
    ).toBe("invalid_dates");
    expect(await prisma.subscription.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "plan.subscription.assigned" } })).toBe(0);
  });

  it("gói active=false: gán mới bị plan_inactive, thuê bao cũ vẫn hiệu lực", async () => {
    const admin = await makeUser("ad");
    const teacher = await makeTeacher();
    await assignSubscription(admin, {
      planKey: "pro",
      userId: teacher,
      startsAt: new Date(Date.now() - HOUR),
      endsAt: FAR,
      source: "admin",
    });
    await updatePlan(admin, "pro", { active: false });
    const other = await makeTeacher("gv2");
    expect(
      await codeOf(assignSubscription(admin, { planKey: "pro", userId: other, startsAt: new Date(), endsAt: FAR, source: "admin" })),
    ).toBe("plan_inactive");
    expect((await getEffectivePlan(teacher))?.planKey).toBe("pro");
  });
});

describe("updatePlan / upsertPlanPrice", () => {
  it("updatePlan với khoá không sellable → non_sellable_key, gói không đổi", async () => {
    const admin = await makeUser("ad");
    const before = await prisma.plan.findUniqueOrThrow({ where: { key: "pro" } });
    const nonSellable = await prisma.featureFlag.findFirstOrThrow({ where: { sellable: false, valueType: "boolean" } });
    expect(
      await codeOf(updatePlan(admin, "pro", { name: "Đổi tên", entitlements: { [nonSellable.key]: true } })),
    ).toBe("non_sellable_key");
    const after = await prisma.plan.findUniqueOrThrow({ where: { key: "pro" } });
    expect(after.name).toBe(before.name);
    expect(after.entitlements).toEqual(before.entitlements);
    expect(await prisma.auditLog.count({ where: { action: "plan.updated" } })).toBe(0);
  });

  it("updatePlan hợp lệ: đổi tên, ghi audit giá trị cũ/mới; gói lạ → plan_not_found", async () => {
    const admin = await makeUser("ad");
    await updatePlan(admin, "pro", { name: "Pro mới", sortOrder: 9, entitlements: { "storage.mb": 1 } });
    const p = await prisma.plan.findUniqueOrThrow({ where: { key: "pro" } });
    expect(p.name).toBe("Pro mới");
    expect(p.entitlements).toEqual({ "storage.mb": 1 });
    const a = await prisma.auditLog.findFirstOrThrow({ where: { action: "plan.updated" } });
    const payload = a.payload as { planKey: string; entitlements?: { old: unknown; new: unknown } };
    expect(payload.planKey).toBe("pro");
    expect(payload.entitlements?.new).toEqual({ "storage.mb": 1 });
    expect(await codeOf(updatePlan(admin, "nope", { name: "x" }))).toBe("plan_not_found");
  });

  it("upsertPlanPrice: tạo rồi sửa, chỉ audit (không sự kiện), số tiền nguyên dương", async () => {
    const admin = await makeUser("ad");
    await upsertPlanPrice(admin, "pro", "month", 199000, true);
    await upsertPlanPrice(admin, "pro", "month", 249000, false);
    const rows = await prisma.planPrice.findMany({ where: { plan: { key: "pro" } } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountVnd).toBe(249000);
    expect(rows[0]?.active).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "plan.price.updated" } })).toBe(2);
    expect(await prisma.learningEvent.count({ where: { eventType: { startsWith: "plan." } } })).toBe(0);
    expect(await codeOf(upsertPlanPrice(admin, "pro", "year", 0, true))).toBe("invalid_value_type");
    expect(await codeOf(upsertPlanPrice(admin, "pro", "year", 1.5, true))).toBe("invalid_value_type");
    expect(await codeOf(upsertPlanPrice(admin, "nope", "year", 100, true))).toBe("plan_not_found");
  });
});

describe("extend / cancel / list", () => {
  async function pro(admin: string, teacher: string) {
    return (
      await assignSubscription(admin, {
        planKey: "pro",
        userId: teacher,
        startsAt: new Date(Date.now() - DAY),
        endsAt: new Date(Date.now() + DAY),
        source: "admin",
      })
    ).subscriptionId;
  }

  it("gia hạn: đổi endsAt, phát sự kiện extended; newEndsAt ≤ startsAt → invalid_dates", async () => {
    const admin = await makeUser("ad");
    const teacher = await makeTeacher();
    const id = await pro(admin, teacher);
    await extendSubscription(admin, id, FAR);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id } })).endsAt).toEqual(FAR);
    expect(await prisma.learningEvent.count({ where: { eventType: "plan.subscription.extended" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "plan.subscription.extended" } })).toBe(1);
    expect(await codeOf(extendSubscription(admin, id, new Date(Date.now() - 2 * DAY)))).toBe("invalid_dates");
    expect(await codeOf(extendSubscription(admin, "nope", FAR))).toBe("subscription_not_found");
  });

  it("huỷ thuê bao → về gói còn lại hoặc free ở lần tra kế tiếp; huỷ lần hai là no-op; gia hạn thuê bao đã huỷ bị chặn", async () => {
    const admin = await makeUser("ad");
    const teacher = await makeTeacher();
    const id = await pro(admin, teacher);
    expect((await getEffectivePlan(teacher))?.planKey).toBe("pro");
    await cancelSubscription(admin, id, "khách yêu cầu");
    expect(await getEffectivePlan(teacher)).toBeNull();
    expect(await resolveFeature(teacher, "storage.mb")).toBe(2048);
    await cancelSubscription(admin, id);
    expect(await prisma.learningEvent.count({ where: { eventType: "plan.subscription.cancelled" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "plan.subscription.cancelled" } })).toBe(1);
    expect(await codeOf(extendSubscription(admin, id, FAR))).toBe("subscription_cancelled");
    expect(await codeOf(cancelSubscription(admin, "nope"))).toBe("subscription_not_found");
  });

  it("hai lệnh huỷ đồng thời: chỉ một sự kiện, một audit", async () => {
    const admin = await makeUser("ad");
    const teacher = await makeTeacher();
    const id = await pro(admin, teacher);
    await Promise.all([cancelSubscription(admin, id, "a"), cancelSubscription(admin, id, "b")]);
    expect(await prisma.learningEvent.count({ where: { eventType: "plan.subscription.cancelled" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "plan.subscription.cancelled" } })).toBe(1);
  });

  it("huỷ rồi gia hạn: bị chặn, endsAt không đổi, không sự kiện extended", async () => {
    const admin = await makeUser("ad");
    const teacher = await makeTeacher();
    const id = await pro(admin, teacher);
    const before = (await prisma.subscription.findUniqueOrThrow({ where: { id } })).endsAt;
    await cancelSubscription(admin, id);
    expect(await codeOf(extendSubscription(admin, id, FAR))).toBe("subscription_cancelled");
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id } })).endsAt).toEqual(before);
    expect(await prisma.learningEvent.count({ where: { eventType: "plan.subscription.extended" } })).toBe(0);
  });

  it("listSubscriptions trả cả thuê bao đã hết/huỷ, mới nhất trước, kèm khoá và tên gói; listPlansForAdmin kèm giá", async () => {
    const admin = await makeUser("ad");
    const teacher = await makeTeacher();
    const old = await prisma.subscription.create({
      data: {
        planId: (await prisma.plan.findUniqueOrThrow({ where: { key: "pro" } })).id,
        userId: teacher,
        source: "admin",
        startsAt: new Date(Date.now() - 10 * DAY),
        endsAt: new Date(Date.now() - 5 * DAY),
      },
    });
    const id = await pro(admin, teacher);
    await cancelSubscription(admin, id);
    const rows = await listSubscriptions({ userId: teacher });
    expect(rows.map((r) => r.id)).toEqual([id, old.id]);
    expect(rows[0]?.planKey).toBe("pro");
    expect(rows[0]?.planName).toBeTruthy();
    await upsertPlanPrice(admin, "pro", "year", 1000, true);
    const plans = await listPlansForAdmin();
    expect(plans.find((p) => p.key === "pro")?.prices).toHaveLength(1);
  });
});

describe("sự kiện plan.*", () => {
  it("payload không chứa amount, email, displayName; plan.* không tính là hoạt động học", async () => {
    const admin = await makeUser("ad");
    const teacher = await makeTeacher();
    const org = await makeOrg("o");
    const { subscriptionId } = await assignSubscription(admin, {
      planKey: "pro",
      userId: teacher,
      startsAt: new Date(Date.now() - HOUR),
      endsAt: new Date(Date.now() + DAY),
      source: "admin",
      note: "ghi chú",
    });
    await assignSubscription(admin, { planKey: "org_truong", organizationId: org.id, startsAt: new Date(), endsAt: FAR, source: "contract" });
    await upsertPlanPrice(admin, "pro", "month", 199000, true);
    await extendSubscription(admin, subscriptionId, FAR);
    await cancelSubscription(admin, subscriptionId);
    const ev = await prisma.learningEvent.findMany({ where: { eventType: { startsWith: "plan." } } });
    expect(ev.length).toBe(4);
    for (const e of ev) {
      expect(JSON.stringify(e.payload)).not.toMatch(/amount|email|displayName|@/i);
      expect(isLearnerActivityType(e.eventType)).toBe(false);
    }
    expect(isLearnerActivityType("plan.subscription.started")).toBe(false);
  });
});
