/**
 * Cấp dùng thử hàng loạt (docs/tieu-chi/goi-tai-khoan.md): giảng viên và tổ chức hiện có
 * được dùng không giới hạn đến TRIAL_ENDS_AT. Chạy lại được (bỏ qua ai đã có thuê bao
 * `trial`); mỗi lần cấp là một giao dịch nhỏ (thuê bao + AuditLog + sự kiện) nên lỗi giữa
 * chừng không làm mất phần đã cấp.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType, RoleName } from "@feedbackme/shared-types";
import { logAudit } from "../auth/audit";
import { emitEvent } from "../learning/events";
import { plansEnabled, TRIAL_ENDS_AT } from "./config";
import { PlanError, type FeatureValue } from "./entitlements";
import { subjectOf, subscriptionPayload } from "./admin";
import { TEACHING_ROLES } from "./subscriptions";

export type TrialGrantResult = {
  usersGranted: number;
  orgsGranted: number;
  skipped: number;
  sellableRoleOverrides: { roleName: string; featureKey: string; value: FeatureValue }[];
};

export async function grantTrialSubscriptions(
  opts: { dryRun: boolean; actorUserId: string; now?: Date },
  db: PrismaClient = prisma,
): Promise<TrialGrantResult> {
  if (!plansEnabled()) throw new Error("plans_disabled");
  const now = opts.now ?? new Date();

  // Người giảng dạy: vai trò giảng dạy hoặc CourseInstructor, trừ platform admin. Mỗi loại một truy vấn.
  const [byRole, byCourse, admins, trialUsers, orgs, trialOrgs, overrides] = await Promise.all([
    db.userRole.findMany({
      where: { role: { name: { in: [...TEACHING_ROLES] } } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.courseInstructor.findMany({ select: { userId: true }, distinct: ["userId"] }),
    db.userRole.findMany({ where: { role: { name: RoleName.Admin } }, select: { userId: true }, distinct: ["userId"] }),
    db.subscription.findMany({ where: { source: "trial", userId: { not: null } }, select: { userId: true } }),
    db.organization.findMany({ select: { id: true } }),
    db.subscription.findMany({ where: { source: "trial", organizationId: { not: null } }, select: { organizationId: true } }),
    db.roleFeatureOverride.findMany({
      where: { feature: { sellable: true } },
      select: { featureKey: true, value: true, role: { select: { name: true } } },
      orderBy: [{ featureKey: "asc" }],
    }),
  ]);

  const adminIds = new Set(admins.map((a) => a.userId));
  const hasTrialUser = new Set(trialUsers.map((s) => s.userId));
  const hasTrialOrg = new Set(trialOrgs.map((s) => s.organizationId));
  const teaching = new Set([...byRole, ...byCourse].map((r) => r.userId).filter((id) => !adminIds.has(id)));

  const userIds = [...teaching].filter((id) => !hasTrialUser.has(id));
  const orgIds = orgs.map((o) => o.id).filter((id) => !hasTrialOrg.has(id));
  const skipped = teaching.size - userIds.length + orgs.length - orgIds.length;

  const result: TrialGrantResult = {
    usersGranted: userIds.length,
    orgsGranted: orgIds.length,
    skipped,
    sellableRoleOverrides: overrides.map((o) => ({
      roleName: o.role.name,
      featureKey: o.featureKey,
      value: o.value as FeatureValue,
    })),
  };
  if (opts.dryRun) return result;

  const [userPlan, orgPlan] = await Promise.all([
    db.plan.findUnique({ where: { key: "trial_individual" } }),
    db.plan.findUnique({ where: { key: "org_trial" } }),
  ]);
  if (!userPlan) throw new PlanError("plan_not_found", { planKey: "trial_individual" });
  if (!orgPlan) throw new PlanError("plan_not_found", { planKey: "org_trial" });

  // Đếm theo số thật sự cấp được (chạy song song hai lần thì phía sau thấy đã có và bỏ qua).
  let usersGranted = 0;
  let orgsGranted = 0;
  const grant = (target: { userId: string } | { organizationId: string }, plan: { id: string; key: string }) =>
    db.$transaction(async (tx) => {
      const where = "userId" in target ? { userId: target.userId } : { organizationId: target.organizationId };
      if (await tx.subscription.findFirst({ where: { ...where, source: "trial" }, select: { id: true } })) return false;
      const sub = await tx.subscription.create({
        data: {
          planId: plan.id,
          userId: "userId" in target ? target.userId : null,
          organizationId: "organizationId" in target ? target.organizationId : null,
          source: "trial",
          startsAt: now,
          endsAt: TRIAL_ENDS_AT,
          grantedById: opts.actorUserId,
        },
      });
      await logAudit(
        {
          action: "plan.subscription.assigned",
          actorUserId: opts.actorUserId,
          targetUserId: sub.userId,
          payload: { subscriptionId: sub.id, planKey: plan.key, organizationId: sub.organizationId, source: "trial" },
        },
        tx,
      );
      await emitEvent(
        subjectOf(sub, opts.actorUserId),
        LearningEventType.PlanSubscriptionStarted,
        { ...subscriptionPayload(sub, plan.key) },
        { eventKey: sub.userId ? `plan.trial:user:${sub.userId}` : `plan.trial:org:${sub.organizationId}` },
        tx,
      );
      return true;
    });

  for (const userId of userIds) if (await grant({ userId }, userPlan)) usersGranted++;
  for (const organizationId of orgIds) if (await grant({ organizationId }, orgPlan)) orgsGranted++;
  return { ...result, usersGranted, orgsGranted, skipped: result.skipped + (userIds.length - usersGranted) + (orgIds.length - orgsGranted) };
}
