import {
  PrismaClient,
  TeachingActivityPlan,
  TeachingActivityPlanItem,
  ClassroomToolType,
} from "@feedbackme/db";
import { randomBytes } from "crypto";

export interface CreatePlanInput {
  userId: string;
  title: string;
}

export interface CreateItemInput {
  toolType: ClassroomToolType;
  label: string;
  config?: unknown;
}

export interface UpdateItemInput {
  label?: string;
  config?: unknown;
}

export type PlanWithItems = TeachingActivityPlan & {
  items: TeachingActivityPlanItem[];
};

/**
 * Owner OR collaborator can edit (items, title, reorder). Only the owner can
 * do sensitive things (delete plan, change isPublic/shareCode, manage
 * collaborators) — see the ownerOnly helpers below.
 */
export async function canEditActivityPlan(
  planId: string,
  userId: string,
  db: PrismaClient
): Promise<boolean> {
  const plan = await db.teachingActivityPlan.findUnique({ where: { id: planId } });
  if (!plan) return false;
  if (plan.userId === userId) return true;

  const collab = await db.teachingActivityPlanCollaborator.findUnique({
    where: { planId_userId: { planId, userId } },
  });
  return !!collab;
}

async function assertCanEditPlan(
  planId: string,
  userId: string,
  db: PrismaClient
): Promise<TeachingActivityPlan> {
  const plan = await db.teachingActivityPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Not authorized to edit this plan");
  if (plan.userId === userId) return plan;

  const collab = await db.teachingActivityPlanCollaborator.findUnique({
    where: { planId_userId: { planId, userId } },
  });
  if (!collab) throw new Error("Not authorized to edit this plan");
  return plan;
}

function assertOwner(plan: TeachingActivityPlan, userId: string) {
  if (plan.userId !== userId) throw new Error("Not authorized — chỉ chủ sở hữu mới thực hiện được");
}

/**
 * Create a new (empty) activity plan for an instructor
 */
export async function createActivityPlan(
  input: CreatePlanInput,
  db: PrismaClient
): Promise<TeachingActivityPlan> {
  if (!input.title.trim()) {
    throw new Error("Title is required");
  }

  return db.teachingActivityPlan.create({
    data: { userId: input.userId, title: input.title.trim() },
  });
}

/**
 * List plans the user owns OR co-authors (personal library).
 */
export async function getUserActivityPlans(
  userId: string,
  db: PrismaClient
): Promise<Array<TeachingActivityPlan & { _count: { items: number }; isOwner: boolean }>> {
  const plans = await db.teachingActivityPlan.findMany({
    where: { OR: [{ userId }, { collaborators: { some: { userId } } }] },
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return plans.map((p) => ({ ...p, isOwner: p.userId === userId }));
}

/**
 * Get a single plan with its items — owner or collaborator only.
 */
export async function getActivityPlan(
  planId: string,
  userId: string,
  db: PrismaClient
): Promise<(PlanWithItems & { isOwner: boolean }) | null> {
  const plan = await db.teachingActivityPlan.findUnique({
    where: { id: planId },
    include: { items: { orderBy: { orderIndex: "asc" } } },
  });
  if (!plan) return null;
  if (plan.userId === userId) return { ...plan, isOwner: true };

  const collab = await db.teachingActivityPlanCollaborator.findUnique({
    where: { planId_userId: { planId, userId } },
  });
  if (!collab) return null;
  return { ...plan, isOwner: false };
}

export async function updateActivityPlan(
  planId: string,
  userId: string,
  updates: { title: string },
  db: PrismaClient
): Promise<TeachingActivityPlan> {
  await assertCanEditPlan(planId, userId, db);
  if (!updates.title.trim()) {
    throw new Error("Title is required");
  }

  return db.teachingActivityPlan.update({
    where: { id: planId },
    data: { title: updates.title.trim() },
  });
}

export async function deleteActivityPlan(
  planId: string,
  userId: string,
  db: PrismaClient
): Promise<void> {
  const plan = await db.teachingActivityPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Not authorized to delete this plan");
  assertOwner(plan, userId);

  await db.teachingActivityPlan.delete({ where: { id: planId } });
}

/**
 * Add an event/item to a plan. orderIndex is appended at the end.
 */
export async function addActivityPlanItem(
  planId: string,
  userId: string,
  input: CreateItemInput,
  db: PrismaClient
): Promise<TeachingActivityPlanItem> {
  await assertCanEditPlan(planId, userId, db);
  if (!input.label.trim()) {
    throw new Error("Label is required");
  }

  const last = await db.teachingActivityPlanItem.findFirst({
    where: { planId },
    orderBy: { orderIndex: "desc" },
  });

  return db.teachingActivityPlanItem.create({
    data: {
      planId,
      toolType: input.toolType,
      label: input.label.trim(),
      config: input.config as any,
      orderIndex: (last?.orderIndex ?? -1) + 1,
    },
  });
}

async function getItemWithEditCheck(
  itemId: string,
  userId: string,
  db: PrismaClient
): Promise<TeachingActivityPlanItem> {
  const item = await db.teachingActivityPlanItem.findUnique({
    where: { id: itemId },
    include: { plan: { include: { collaborators: true } } },
  });
  if (!item) throw new Error("Not authorized to edit this item");
  const canEdit =
    item.plan.userId === userId || item.plan.collaborators.some((c) => c.userId === userId);
  if (!canEdit) throw new Error("Not authorized to edit this item");
  return item;
}

export async function updateActivityPlanItem(
  itemId: string,
  userId: string,
  updates: UpdateItemInput,
  db: PrismaClient
): Promise<TeachingActivityPlanItem> {
  await getItemWithEditCheck(itemId, userId, db);

  return db.teachingActivityPlanItem.update({
    where: { id: itemId },
    data: {
      ...(updates.label !== undefined ? { label: updates.label.trim() } : {}),
      ...(updates.config !== undefined ? { config: updates.config as any } : {}),
    },
  });
}

export async function deleteActivityPlanItem(
  itemId: string,
  userId: string,
  db: PrismaClient
): Promise<void> {
  await getItemWithEditCheck(itemId, userId, db);
  await db.teachingActivityPlanItem.delete({ where: { id: itemId } });
}

/**
 * Reorder items — display order only, not enforced at run time. Requires the
 * full ordered id set (partial reorder rejected), matching the convention
 * used by reorderContentItems/reorderLessonActivities.
 */
export async function reorderActivityPlanItems(
  planId: string,
  userId: string,
  orderedItemIds: string[],
  db: PrismaClient
): Promise<void> {
  await assertCanEditPlan(planId, userId, db);
  const items = await db.teachingActivityPlanItem.findMany({ where: { planId } });

  const existingIds = new Set(items.map((i) => i.id));
  if (
    orderedItemIds.length !== existingIds.size ||
    !orderedItemIds.every((id) => existingIds.has(id))
  ) {
    throw new Error("orderedItemIds must match the plan's full item set");
  }

  await db.$transaction(
    orderedItemIds.map((id, index) =>
      db.teachingActivityPlanItem.update({
        where: { id },
        data: { orderIndex: index },
      })
    )
  );
}

// ── Sharing (P1) ────────────────────────────────────────────────────────────

export async function setPlanVisibility(
  planId: string,
  userId: string,
  isPublic: boolean,
  db: PrismaClient
): Promise<TeachingActivityPlan> {
  const plan = await db.teachingActivityPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Not authorized — chỉ chủ sở hữu mới thực hiện được");
  assertOwner(plan, userId);

  return db.teachingActivityPlan.update({ where: { id: planId }, data: { isPublic } });
}

export async function generateShareCode(
  planId: string,
  userId: string,
  db: PrismaClient
): Promise<TeachingActivityPlan> {
  const plan = await db.teachingActivityPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Not authorized — chỉ chủ sở hữu mới thực hiện được");
  assertOwner(plan, userId);
  if (plan.shareCode) return plan;

  const code = randomBytes(6).toString("base64url");
  return db.teachingActivityPlan.update({ where: { id: planId }, data: { shareCode: code } });
}

export async function revokeShareCode(
  planId: string,
  userId: string,
  db: PrismaClient
): Promise<TeachingActivityPlan> {
  const plan = await db.teachingActivityPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Not authorized — chỉ chủ sở hữu mới thực hiện được");
  assertOwner(plan, userId);

  return db.teachingActivityPlan.update({ where: { id: planId }, data: { shareCode: null } });
}

/**
 * View a plan via its share link — any authenticated instructor, regardless
 * of ownership. Used by the /shared/[shareCode] page.
 */
export async function getPlanByShareCode(
  shareCode: string,
  db: PrismaClient
): Promise<(PlanWithItems & { ownerName: string }) | null> {
  const plan = await db.teachingActivityPlan.findUnique({
    where: { shareCode },
    include: { items: { orderBy: { orderIndex: "asc" } }, user: { select: { displayName: true } } },
  });
  if (!plan) return null;
  const { user, ...rest } = plan;
  return { ...rest, ownerName: user.displayName };
}

/**
 * Copy a plan into the requester's own library — always an independent
 * duplicate (fresh ids), never synced back to the source. Allowed when the
 * source is public, or the requester supplies the correct shareCode, or the
 * requester already owns/co-authors the source.
 */
export async function copyActivityPlan(
  sourcePlanId: string,
  userId: string,
  opts: { shareCode?: string },
  db: PrismaClient
): Promise<PlanWithItems> {
  const source = await db.teachingActivityPlan.findUnique({
    where: { id: sourcePlanId },
    include: { items: true, collaborators: true },
  });
  if (!source) throw new Error("Not authorized to copy this plan");

  const allowed =
    source.isPublic ||
    source.userId === userId ||
    source.collaborators.some((c) => c.userId === userId) ||
    (!!source.shareCode && !!opts.shareCode && source.shareCode === opts.shareCode);
  if (!allowed) throw new Error("Not authorized to copy this plan");

  return db.teachingActivityPlan.create({
    data: {
      userId,
      title: source.title,
      items: {
        create: source.items.map((item) => ({
          toolType: item.toolType,
          label: item.label,
          config: item.config as any,
          orderIndex: item.orderIndex,
        })),
      },
    },
    include: { items: { orderBy: { orderIndex: "asc" } } },
  });
}

/**
 * Join a plan as a collaborator via its share link — requires the exact
 * shareCode (public alone is NOT enough; the marketplace only offers copy).
 */
export async function joinActivityPlanAsCollaborator(
  planId: string,
  userId: string,
  shareCode: string,
  db: PrismaClient
): Promise<void> {
  const plan = await db.teachingActivityPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.shareCode || plan.shareCode !== shareCode) {
    throw new Error("Not authorized to join this plan");
  }
  if (plan.userId === userId) return;

  await db.teachingActivityPlanCollaborator.upsert({
    where: { planId_userId: { planId, userId } },
    create: { planId, userId },
    update: {},
  });
}

export async function leaveActivityPlanCollaboration(
  planId: string,
  userId: string,
  db: PrismaClient
): Promise<void> {
  await db.teachingActivityPlanCollaborator.deleteMany({ where: { planId, userId } });
}

export async function listActivityPlanCollaborators(
  planId: string,
  userId: string,
  db: PrismaClient
): Promise<Array<{ userId: string; displayName: string }>> {
  const canView = await canEditActivityPlan(planId, userId, db);
  if (!canView) throw new Error("Not authorized to view this plan");

  const rows = await db.teachingActivityPlanCollaborator.findMany({
    where: { planId },
    include: { user: { select: { displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ userId: r.userId, displayName: r.user.displayName }));
}

export async function removeActivityPlanCollaborator(
  planId: string,
  ownerUserId: string,
  targetUserId: string,
  db: PrismaClient
): Promise<void> {
  const plan = await db.teachingActivityPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Not authorized — chỉ chủ sở hữu mới thực hiện được");
  assertOwner(plan, ownerUserId);

  await db.teachingActivityPlanCollaborator.deleteMany({ where: { planId, userId: targetUserId } });
}

// ── Like / Save (chợ kịch bản — chỉ áp dụng cho plan public) ────────────────

async function assertPublic(planId: string, db: PrismaClient): Promise<void> {
  const plan = await db.teachingActivityPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isPublic) throw new Error("Plan is not public");
}

export async function toggleActivityPlanLike(
  planId: string,
  userId: string,
  db: PrismaClient
): Promise<{ liked: boolean }> {
  await assertPublic(planId, db);
  const existing = await db.teachingActivityPlanLike.findUnique({
    where: { planId_userId: { planId, userId } },
  });
  if (existing) {
    await db.teachingActivityPlanLike.delete({ where: { id: existing.id } });
    return { liked: false };
  }
  await db.teachingActivityPlanLike.create({ data: { planId, userId } });
  return { liked: true };
}

export async function toggleActivityPlanSave(
  planId: string,
  userId: string,
  db: PrismaClient
): Promise<{ saved: boolean }> {
  await assertPublic(planId, db);
  const existing = await db.teachingActivityPlanSave.findUnique({
    where: { planId_userId: { planId, userId } },
  });
  if (existing) {
    await db.teachingActivityPlanSave.delete({ where: { id: existing.id } });
    return { saved: false };
  }
  await db.teachingActivityPlanSave.create({ data: { planId, userId } });
  return { saved: true };
}

export interface MarketPlan {
  id: string;
  title: string;
  ownerName: string;
  itemCount: number;
  likeCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  updatedAt: Date;
}

/**
 * Browse the community marketplace (public plans from any instructor).
 * onlySaved restricts to plans the caller has bookmarked.
 */
export async function listMarketActivityPlans(
  userId: string,
  opts: { onlySaved?: boolean } = {},
  db: PrismaClient
): Promise<MarketPlan[]> {
  const plans = await db.teachingActivityPlan.findMany({
    where: {
      isPublic: true,
      ...(opts.onlySaved ? { saves: { some: { userId } } } : {}),
    },
    include: {
      user: { select: { displayName: true } },
      _count: { select: { items: true, likes: true } },
      likes: { where: { userId }, select: { id: true } },
      saves: { where: { userId }, select: { id: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return plans.map((p) => ({
    id: p.id,
    title: p.title,
    ownerName: p.user.displayName,
    itemCount: p._count.items,
    likeCount: p._count.likes,
    likedByMe: p.likes.length > 0,
    savedByMe: p.saves.length > 0,
    updatedAt: p.updatedAt,
  }));
}
