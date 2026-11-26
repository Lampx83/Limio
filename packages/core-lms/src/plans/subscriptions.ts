/**
 * Tra gói tài khoản của một người (docs/tieu-chi/goi-tai-khoan.md §5.2).
 *
 * Chỉ người giảng dạy đi qua tầng gói: có vai trò instructor / center_teacher /
 * org_admin ở bất kỳ phạm vi nào, hoặc là CourseInstructor của ít nhất một
 * khoá. Platform admin coi như không giới hạn nên không đi qua tầng gói; học
 * viên không bao giờ đi qua, nên gói không làm đổi gì phía học viên.
 *
 * Thuê bao hiệu lực khi chưa huỷ và `startsAt <= now < endsAt`; hết hạn không
 * cần job vì hàm tra so ngày mỗi lần. Thuê bao trên gói đã ngừng bán
 * (`Plan.active = false`) vẫn tính: cờ đó chỉ chặn gán mới.
 */
import { prisma, type PrismaClient, type Prisma, type SubscriptionSource } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { plansEnabled } from "./config";
import { mergeEntitlements, type FeatureValue } from "./entitlements";

export type PlanSubjectKind = "admin" | "teaching" | "other";

export type ActiveSubscription = {
  id: string;
  planKey: string;
  planName: string;
  scope: "individual" | "organization";
  source: SubscriptionSource;
  sortOrder: number;
  startsAt: Date;
  endsAt: Date;
  entitlements: Record<string, FeatureValue>;
  referencePlanKey: string | null;
};

const TEACHING_ROLES: readonly string[] = [RoleName.Instructor, RoleName.CenterTeacher, RoleName.OrgAdmin];

/** Một truy vấn: tổ chức + tên các vai trò của người dùng. */
async function loadSubject(userId: string, db: PrismaClient) {
  return db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, userRoles: { select: { role: { select: { name: true } } } } },
  });
}

async function kindOf(
  userId: string,
  roleNames: string[],
  db: PrismaClient,
): Promise<PlanSubjectKind> {
  if (roleNames.includes(RoleName.Admin)) return "admin";
  if (roleNames.some((n) => TEACHING_ROLES.includes(n))) return "teaching";
  const ci = await db.courseInstructor.findFirst({ where: { userId }, select: { id: true } });
  return ci ? "teaching" : "other";
}

export async function getPlanSubjectKind(
  userId: string,
  db: PrismaClient = prisma,
): Promise<PlanSubjectKind> {
  const subject = await loadSubject(userId, db);
  if (!subject) return "other";
  return kindOf(userId, subject.userRoles.map((r) => r.role.name), db);
}

function asEntitlements(json: Prisma.JsonValue): Record<string, FeatureValue> {
  return json && typeof json === "object" && !Array.isArray(json)
    ? (json as Record<string, FeatureValue>)
    : {};
}

async function activeFor(
  userId: string,
  organizationId: string | null,
  now: Date,
  db: PrismaClient,
): Promise<ActiveSubscription[]> {
  const rows = await db.subscription.findMany({
    where: {
      cancelledAt: null,
      startsAt: { lte: now },
      endsAt: { gt: now },
      OR: organizationId ? [{ userId }, { organizationId }] : [{ userId }],
    },
    include: { plan: true },
  });
  return rows.map((s) => ({
    id: s.id,
    planKey: s.plan.key,
    planName: s.plan.name,
    scope: s.organizationId ? "organization" : "individual",
    source: s.source,
    sortOrder: s.plan.sortOrder,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    entitlements: asEntitlements(s.plan.entitlements),
    referencePlanKey: s.plan.referencePlanKey,
  }));
}

/** Thuê bao hiệu lực của chính người đó và của `User.organizationId`. */
export async function getActiveSubscriptions(
  userId: string,
  now: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<ActiveSubscription[]> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (!user) return [];
  return activeFor(userId, user.organizationId, now, db);
}

/**
 * Bản nội bộ cho `resolveFeatures`: nhận sẵn danh sách cờ (đã nạp) để khỏi
 * truy vấn lại; kết quả chỉ chứa khoá có trong `flags`.
 */
export async function planEntitlementsWithFlags(
  userId: string,
  now: Date,
  db: PrismaClient,
  flags?: { key: string; valueType: string }[],
): Promise<Record<string, FeatureValue> | null> {
  if (!plansEnabled()) return null;
  const subject = await loadSubject(userId, db);
  if (!subject) return null;
  const kind = await kindOf(userId, subject.userRoles.map((r) => r.role.name), db);
  if (kind !== "teaching") return null;

  const subs = await activeFor(userId, subject.organizationId, now, db);
  let list: Record<string, FeatureValue>[];
  if (subs.length > 0) {
    list = subs.map((s) => s.entitlements);
  } else {
    // Giảng viên không có gói hiệu lực nào thì dùng gói free.
    const free = await db.plan.findUnique({ where: { key: "free" }, select: { entitlements: true } });
    if (!free) return null;
    list = [asEntitlements(free.entitlements)];
  }

  const flagDefs =
    flags ??
    (await db.featureFlag.findMany({
      where: { key: { in: Array.from(new Set(list.flatMap((e) => Object.keys(e)))) } },
      select: { key: true, valueType: true },
    }));
  return mergeEntitlements(flagDefs, list);
}

/**
 * Quyền gộp từ mọi gói hiệu lực (boolean OR, int MAX, mảng UNION). `null` khi
 * tầng gói tắt hoặc người này không phải người giảng dạy; không có thuê bao
 * nào thì dùng gói `free` (không có dòng `free` ⇒ `null`).
 */
export async function getPlanEntitlementsForUser(
  userId: string,
  now: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<Record<string, FeatureValue> | null> {
  return planEntitlementsWithFlags(userId, now, db);
}

/**
 * Gói "đứng tên" để hiện trên giao diện: `sortOrder` cao nhất trong các gói
 * hiệu lực, hoà thì `endsAt` xa hơn. Quyền thật luôn tính bằng phép gộp.
 */
export async function getEffectivePlan(
  userId: string,
  now: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<ActiveSubscription | null> {
  const subs = await getActiveSubscriptions(userId, now, db);
  if (subs.length === 0) return null;
  return subs.reduce((best, s) =>
    s.sortOrder > best.sortOrder ||
    (s.sortOrder === best.sortOrder && s.endsAt.getTime() > best.endsAt.getTime())
      ? s
      : best,
  );
}
