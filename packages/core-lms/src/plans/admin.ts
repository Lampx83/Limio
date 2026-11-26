/**
 * Thao tác quản trị gói (docs/tieu-chi/goi-tai-khoan.md): sửa gói, đặt giá, gán/gia hạn/huỷ thuê bao.
 *
 * Mỗi hàm chạy trong một `$transaction`: đổi dữ liệu, `logAudit` và `emitEvent` cùng một giao dịch.
 * Sự kiện `plan.*` chỉ mang id, khoá gói, nguồn, ngày (không số tiền, tên, email) và không gắn khoá học.
 * Giá chỉ ghi AuditLog, không phát sự kiện.
 */
import { prisma, type PrismaClient, type Prisma, type PlanPeriod, type SubscriptionSource } from "@feedbackme/db";
import {
  LearningEventType,
  type PlanSubscriptionPayload,
} from "@feedbackme/shared-types";
import { logAudit } from "../auth/audit";
import { emitEvent } from "../learning/events";
import { PlanError, validateEntitlements } from "./entitlements";

type Tx = Prisma.TransactionClient;

export type PlanPatch = {
  name?: string;
  entitlements?: unknown;
  isPublic?: boolean;
  active?: boolean;
  sortOrder?: number;
};

export type AssignSubscriptionInput = {
  planKey: string;
  userId?: string;
  organizationId?: string;
  startsAt: Date;
  endsAt: Date;
  source: "contract" | "admin";
  note?: string;
};

async function findPlan(tx: Tx, planKey: string) {
  const plan = await tx.plan.findUnique({ where: { key: planKey } });
  if (!plan) throw new PlanError("plan_not_found", { planKey });
  return plan;
}

export async function updatePlan(
  actorUserId: string,
  planKey: string,
  patch: PlanPatch,
  db: PrismaClient = prisma,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const plan = await findPlan(tx, planKey);
    const data: Prisma.PlanUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.isPublic !== undefined) data.isPublic = patch.isPublic;
    if (patch.active !== undefined) data.active = patch.active;
    if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
    let entitlementsChange: { old: unknown; new: unknown } | undefined;
    if (patch.entitlements !== undefined) {
      const flags = await tx.featureFlag.findMany({ select: { key: true, valueType: true, sellable: true } });
      const clean = validateEntitlements(patch.entitlements, flags);
      data.entitlements = clean as Prisma.InputJsonValue;
      entitlementsChange = { old: plan.entitlements, new: clean };
    }
    await tx.plan.update({ where: { id: plan.id }, data });
    await logAudit(
      {
        action: "plan.updated",
        actorUserId,
        payload: {
          planKey,
          fields: Object.keys(patch),
          ...(entitlementsChange ? { entitlements: entitlementsChange } : {}),
        },
      },
      tx,
    );
  });
}

/** Đặt giá một chu kỳ của gói. Chỉ ghi AuditLog: giá không bao giờ vào LearningEvent. */
export async function upsertPlanPrice(
  actorUserId: string,
  planKey: string,
  period: PlanPeriod,
  amountVnd: number,
  active: boolean,
  db: PrismaClient = prisma,
): Promise<void> {
  if (!Number.isInteger(amountVnd) || amountVnd <= 0) {
    throw new PlanError("invalid_value_type", { amountVnd });
  }
  await db.$transaction(async (tx) => {
    const plan = await findPlan(tx, planKey);
    const old = await tx.planPrice.findUnique({ where: { planId_period: { planId: plan.id, period } } });
    await tx.planPrice.upsert({
      where: { planId_period: { planId: plan.id, period } },
      update: { amountVnd, active },
      create: { planId: plan.id, period, amountVnd, active },
    });
    await logAudit(
      {
        action: "plan.price.updated",
        actorUserId,
        payload: {
          planKey,
          period,
          old: old ? { amountVnd: old.amountVnd, active: old.active } : null,
          new: { amountVnd, active },
        },
      },
      tx,
    );
  });
}

function subscriptionPayload(
  sub: { id: string; source: string; startsAt: Date; endsAt: Date; organizationId: string | null },
  planKey: string,
): PlanSubscriptionPayload {
  return {
    subscriptionId: sub.id,
    planKey,
    scope: sub.organizationId ? "organization" : "individual",
    ...(sub.organizationId ? { organizationId: sub.organizationId } : {}),
    source: sub.source,
    startsAt: sub.startsAt.toISOString(),
    endsAt: sub.endsAt.toISOString(),
  };
}

/** Chủ thể của sự kiện: người nhận gói (cá nhân) hoặc người thao tác (tổ chức). */
function subjectOf(sub: { userId: string | null }, actorUserId: string): string {
  return sub.userId ?? actorUserId;
}

export async function assignSubscription(
  actorUserId: string,
  input: AssignSubscriptionInput,
  db: PrismaClient = prisma,
): Promise<{ subscriptionId: string }> {
  return db.$transaction(async (tx) => {
    const plan = await findPlan(tx, input.planKey);
    if (!plan.active) throw new PlanError("plan_inactive", { planKey: input.planKey });
    const forUser = Boolean(input.userId);
    const forOrg = Boolean(input.organizationId);
    if (forUser === forOrg) throw new PlanError("invalid_subject");
    if ((plan.scope === "individual") !== forUser) {
      throw new PlanError("invalid_subject", { planScope: plan.scope });
    }
    if (input.endsAt.getTime() <= input.startsAt.getTime()) throw new PlanError("invalid_dates");
    if (forUser) {
      const u = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true } });
      if (!u) throw new PlanError("invalid_subject", { reason: "user_not_found" });
    } else {
      const o = await tx.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } });
      if (!o) throw new PlanError("invalid_subject", { reason: "organization_not_found" });
    }

    const sub = await tx.subscription.create({
      data: {
        planId: plan.id,
        userId: input.userId ?? null,
        organizationId: input.organizationId ?? null,
        source: input.source as SubscriptionSource,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        grantedById: actorUserId,
        note: input.note ?? null,
      },
    });
    await logAudit(
      {
        action: "plan.subscription.assigned",
        actorUserId,
        targetUserId: input.userId ?? null,
        payload: { subscriptionId: sub.id, planKey: plan.key, organizationId: input.organizationId ?? null, source: sub.source },
      },
      tx,
    );
    await emitEvent(
      subjectOf(sub, actorUserId),
      LearningEventType.PlanSubscriptionStarted,
      { ...subscriptionPayload(sub, plan.key) },
      {},
      tx,
    );
    return { subscriptionId: sub.id };
  });
}

async function findSubscription(tx: Tx, subscriptionId: string) {
  const sub = await tx.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: { select: { key: true } } } });
  if (!sub) throw new PlanError("subscription_not_found", { subscriptionId });
  return sub;
}

export async function extendSubscription(
  actorUserId: string,
  subscriptionId: string,
  newEndsAt: Date,
  db: PrismaClient = prisma,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const sub = await findSubscription(tx, subscriptionId);
    if (sub.cancelledAt) throw new PlanError("subscription_cancelled", { subscriptionId });
    if (newEndsAt.getTime() <= sub.startsAt.getTime()) throw new PlanError("invalid_dates");
    // Việc ghi chính là chốt chặn: chỉ đổi khi chưa huỷ (tránh đua với huỷ ở READ COMMITTED).
    const { count } = await tx.subscription.updateMany({
      where: { id: sub.id, cancelledAt: null },
      data: { endsAt: newEndsAt },
    });
    if (count === 0) throw new PlanError("subscription_cancelled", { subscriptionId });
    const updated = { ...sub, endsAt: newEndsAt };
    await logAudit(
      {
        action: "plan.subscription.extended",
        actorUserId,
        targetUserId: sub.userId,
        payload: { subscriptionId, planKey: sub.plan.key, oldEndsAt: sub.endsAt.toISOString(), newEndsAt: newEndsAt.toISOString() },
      },
      tx,
    );
    await emitEvent(
      subjectOf(sub, actorUserId),
      LearningEventType.PlanSubscriptionExtended,
      { ...subscriptionPayload(updated, sub.plan.key) },
      {},
      tx,
    );
  });
}

/** Huỷ: đặt `cancelledAt`. Đã huỷ rồi thì không làm gì (không sự kiện, không audit thứ hai). */
export async function cancelSubscription(
  actorUserId: string,
  subscriptionId: string,
  note?: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const sub = await findSubscription(tx, subscriptionId);
    if (sub.cancelledAt) return;
    // Chỉ một lệnh huỷ thắng: lệnh đến sau thấy count = 0 và không phát sự kiện/audit.
    const { count } = await tx.subscription.updateMany({
      where: { id: sub.id, cancelledAt: null },
      data: { cancelledAt: new Date(), ...(note !== undefined ? { note } : {}) },
    });
    if (count === 0) return;
    const updated = (await tx.subscription.findUniqueOrThrow({ where: { id: sub.id } }));
    await logAudit(
      {
        action: "plan.subscription.cancelled",
        actorUserId,
        targetUserId: sub.userId,
        payload: { subscriptionId, planKey: sub.plan.key },
      },
      tx,
    );
    await emitEvent(
      subjectOf(sub, actorUserId),
      LearningEventType.PlanSubscriptionCancelled,
      { ...subscriptionPayload(updated, sub.plan.key) },
      {},
      tx,
    );
  });
}

export async function listPlansForAdmin(db: PrismaClient = prisma) {
  return db.plan.findMany({
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    include: { prices: { orderBy: { period: "asc" } } },
  });
}

/** Mọi thuê bao của người/tổ chức, kể cả đã hết hạn hoặc huỷ; mới bắt đầu nhất trước. */
export async function listSubscriptions(
  filter: { userId?: string; organizationId?: string },
  db: PrismaClient = prisma,
) {
  const rows = await db.subscription.findMany({
    where: { userId: filter.userId, organizationId: filter.organizationId },
    orderBy: { startsAt: "desc" },
    include: { plan: { select: { key: true, name: true } } },
  });
  return rows.map(({ plan, ...s }) => ({ ...s, planKey: plan.key, planName: plan.name }));
}
