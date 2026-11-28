/**
 * Hạn mức theo gói (docs/tieu-chi/goi-tai-khoan.md §5.3, mốc 2).
 *
 * Hai loại hạn mức:
 * - **Theo quy mô** (`SnapshotMetric`: phản hồi mỗi hoạt động, người mỗi phòng
 *   Gameshow, thí sinh mỗi ca thi): `getPlanLimit` trả trần để nơi tạo chụp vào
 *   hoạt động; không đếm gì ở đây.
 * - **Theo lượng dùng** (`UsageMetric`): `checkUsageQuota` đếm số đã dùng từ
 *   bảng thật (không có bộ đếm riêng) và so với hạn mức. Vấn đáp và dung lượng
 *   là **quỹ chung**: nguồn cá nhân so số của riêng người đó với gói cá nhân,
 *   nguồn tổ chức so tổng mọi thành viên (`User.organizationId`) với gói tổ
 *   chức; được phép khi một trong hai còn chỗ, ưu tiên cá nhân.
 *
 * Tầng gói tắt (`PLANS_ENABLED` trống) hoặc người không phải người giảng dạy
 * ⇒ không giới hạn theo gói, không đếm, không phát sự kiện. Tháng tính theo
 * giờ Việt Nam (UTC+7, không có giờ mùa hè).
 *
 * Sự kiện `plan.limit.reached` (tối đa một lần mỗi người, mỗi khoá, mỗi ngày
 * giờ VN): `enforced = true` khi bị từ chối; `enforced = false` khi người dùng
 * thử được phép nhưng đã vượt mức của gói tham chiếu (để admin chào gói). Ghi
 * sự kiện lỗi thì nuốt và log, không làm hỏng lời gọi.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import {
  LearningEventType,
  RoleName,
  TECH_CEILINGS,
  type PlanLimitReachedPayload,
} from "@feedbackme/shared-types";
import { resolveFeature } from "../auth/permissions";
import { emitEvent } from "../learning/events";
import { vnDayKey } from "../courses/classScheduleCalc";
import { plansEnabled } from "./config";
import { activeFor, asEntitlements, getPlanSubjectKind, type ActiveSubscription } from "./subscriptions";

export type UsageMetric = "ai_oral.monthly_attempts" | "storage.mb" | "org.max_instructors";
export type SnapshotMetric =
  | "activity.max_responses"
  | "gameshow.max_participants"
  | "exam.session.max_candidates";
export type QuotaSource = "individual" | "organization";

export interface QuotaResult {
  allowed: boolean;
  /** null = không giới hạn theo gói. */
  limit: number | null;
  /** Đơn vị của khoá: lượt, MB (làm tròn lên), người. Số của nguồn trả về. */
  used: number;
  source: QuotaSource | null;
  planKey: string | null;
  organizationName?: string;
}

export type PlanLimitDetails = QuotaResult & { key: string };

export class PlanLimitError extends Error {
  public readonly code = "plan_limit_reached" as const;
  constructor(public readonly details: PlanLimitDetails) {
    super("plan_limit_reached");
    this.name = "PlanLimitError";
  }
}

export interface QuotaSubject {
  userId?: string;
  organizationId?: string;
}

export interface QuotaOptions {
  /** Lượng sắp dùng thêm (mặc định 1). Chỉ để hiển thị thì truyền 0. */
  increment?: number;
  now?: Date;
  db?: PrismaClient;
}

const VN_OFFSET_MS = 7 * 3600_000;
const BYTES_PER_MB = 1048576n;

/** Tệp do học viên tải lên: không làm giảng viên bị chặn dung lượng. */
const LEARNER_FILE_KINDS = ["submission", "practice_answer", "proctor_snapshot", "avatar"];

/** Vai trò được tính vào số giảng viên của tổ chức. */
const ORG_INSTRUCTOR_ROLES: string[] = [RoleName.Instructor, RoleName.CenterTeacher];

const UNLIMITED: QuotaResult = { allowed: true, limit: null, used: 0, source: null, planKey: null };

/** Tháng giờ VN chứa `now`, dạng nửa mở [start, end). */
export function vnMonthRange(now: Date): { start: Date; end: Date } {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const y = vn.getUTCFullYear();
  const m = vn.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1) - VN_OFFSET_MS),
    end: new Date(Date.UTC(y, m + 1, 1) - VN_OFFSET_MS),
  };
}

/** Ngày giờ VN dạng "YYYY-MM-DD" (dùng chung với lịch lớp). */
export { vnDayKey };

function ceilingOf(key: string): number {
  return TECH_CEILINGS[key] ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Trần theo gói của một hạn mức theo quy mô, để chụp vào hoạt động lúc tạo.
 * `null` khi tầng gói tắt hoặc người này không phải người giảng dạy (nơi gọi
 * giữ trần cứng cũ). Cấp riêng (`UserFeatureOverride`) thắng gói.
 */
export async function getPlanLimit(
  userId: string,
  key: SnapshotMetric,
  db: PrismaClient = prisma,
): Promise<number | null> {
  if (!plansEnabled()) return null;
  if ((await getPlanSubjectKind(userId, db)) !== "teaching") return null;
  const value = await resolveFeature(userId, key, db);
  const ceiling = ceilingOf(key);
  return typeof value === "number" ? Math.min(value, ceiling) : ceiling;
}

// ---------------------------------------------------------------------------
// Đếm số đã dùng (luôn từ bảng thật)
// ---------------------------------------------------------------------------

type Owner = { userId: string } | { organizationId: string };

async function countOralAttempts(owner: Owner, now: Date, db: PrismaClient): Promise<number> {
  const { start, end } = vnMonthRange(now);
  // Chủ chi phí = người tạo đề; đề không có người tạo thì tính cho chủ khoá.
  const ownerOr =
    "userId" in owner
      ? [
          { createdById: owner.userId },
          {
            createdById: null,
            course: { instructors: { some: { role: "owner", userId: owner.userId } } },
          },
        ]
      : [
          { createdBy: { organizationId: owner.organizationId } },
          {
            createdById: null,
            course: {
              instructors: { some: { role: "owner", user: { organizationId: owner.organizationId } } },
            },
          },
        ];
  return db.examAttempt.count({
    where: {
      startedAt: { gte: start, lt: end },
      exam: { kind: "oral", OR: ownerOr },
    },
  });
}

async function sumStorageMb(owner: Owner, db: PrismaClient): Promise<number> {
  let billed: string | { in: string[] };
  if ("userId" in owner) {
    billed = owner.userId;
  } else {
    // StoredFile không có quan hệ tới User nên nạp danh sách thành viên.
    const members = await db.user.findMany({
      where: { organizationId: owner.organizationId },
      select: { id: true },
    });
    if (members.length === 0) return 0;
    billed = { in: members.map((m) => m.id) };
  }
  const agg = await db.storedFile.aggregate({
    where: { billedUserId: billed, deletedAt: null, kind: { notIn: LEARNER_FILE_KINDS } },
    _sum: { sizeBytes: true },
  });
  const bytes = agg._sum.sizeBytes ?? 0n;
  // Làm tròn lên MB.
  return Number((bytes + BYTES_PER_MB - 1n) / BYTES_PER_MB);
}

async function countOrgInstructors(organizationId: string, db: PrismaClient): Promise<number> {
  return db.user.count({
    where: {
      organizationId,
      userRoles: { some: { role: { name: { in: ORG_INSTRUCTOR_ROLES } } } },
    },
  });
}

async function countUsed(key: UsageMetric, owner: Owner, now: Date, db: PrismaClient): Promise<number> {
  switch (key) {
    case "ai_oral.monthly_attempts":
      return countOralAttempts(owner, now, db);
    case "storage.mb":
      return sumStorageMb(owner, db);
    case "org.max_instructors":
      return "organizationId" in owner ? countOrgInstructors(owner.organizationId, db) : 0;
  }
}

// ---------------------------------------------------------------------------
// Hạn mức của từng nguồn
// ---------------------------------------------------------------------------

type SourceLimit = {
  source: QuotaSource;
  limit: number | null;
  planKey: string;
  /** Gói dùng thử cho ra hạn mức này (để so với gói tham chiếu). */
  referencePlanKey: string | null;
  organizationName?: string;
};

/** Thuê bao cho số lớn nhất của khoá; hoà thì `sortOrder` cao hơn. */
function bestSubscription(subs: ActiveSubscription[], key: string): { sub: ActiveSubscription; value: number } | null {
  let best: { sub: ActiveSubscription; value: number } | null = null;
  for (const sub of subs) {
    const v = sub.entitlements[key];
    if (typeof v !== "number") continue;
    if (!best || v > best.value || (v === best.value && sub.sortOrder > best.sub.sortOrder)) {
      best = { sub, value: v };
    }
  }
  return best;
}

async function individualLimit(
  userId: string,
  key: UsageMetric,
  subs: ActiveSubscription[],
  now: Date,
  db: PrismaClient,
): Promise<SourceLimit> {
  const ceiling = ceilingOf(key);
  const best = bestSubscription(subs, key);
  let planKey = best?.sub.planKey ?? "free";
  let limit: number | null = best ? best.value : null;
  if (!best) {
    // Không có thuê bao cá nhân cho khoá này ⇒ giá trị trong gói free.
    const free = await db.plan.findUnique({ where: { key: "free" }, select: { entitlements: true } });
    const v = free ? asEntitlements(free.entitlements)[key] : undefined;
    limit = typeof v === "number" ? v : null;
    planKey = "free";
  }

  // Cấp riêng còn hạn thắng gói (planKey vẫn là gói cá nhân đang áp dụng).
  const override = await db.userFeatureOverride.findUnique({
    where: { userId_featureKey: { userId, featureKey: key } },
    select: { value: true, expiresAt: true },
  });
  if (override && (override.expiresAt === null || override.expiresAt > now) && typeof override.value === "number") {
    return { source: "individual", limit: Math.min(override.value, ceiling), planKey, referencePlanKey: null };
  }

  return {
    source: "individual",
    limit: limit === null ? null : Math.min(limit, ceiling),
    planKey,
    referencePlanKey: best?.sub.referencePlanKey ?? null,
  };
}

async function organizationLimit(
  organizationId: string,
  key: UsageMetric,
  subs: ActiveSubscription[],
  db: PrismaClient,
): Promise<SourceLimit | null> {
  const best = bestSubscription(subs, key);
  if (!best) return null;
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  return {
    source: "organization",
    limit: Math.min(best.value, ceilingOf(key)),
    planKey: best.sub.planKey,
    referencePlanKey: best.sub.referencePlanKey,
    ...(org ? { organizationName: org.name } : {}),
  };
}

function toResult(src: SourceLimit, used: number, allowed: boolean): QuotaResult {
  return {
    allowed,
    limit: src.limit,
    used,
    source: src.source,
    planKey: src.planKey,
    ...(src.organizationName !== undefined ? { organizationName: src.organizationName } : {}),
  };
}

const fits = (limit: number | null, used: number, increment: number) =>
  limit === null || used + increment <= limit;

// ---------------------------------------------------------------------------
// Sự kiện
// ---------------------------------------------------------------------------

async function recordLimitReached(
  actorUserId: string | undefined,
  key: UsageMetric,
  payload: PlanLimitReachedPayload,
  now: Date,
  db: PrismaClient,
): Promise<void> {
  if (!actorUserId) return;
  try {
    await emitEvent(
      actorUserId,
      LearningEventType.PlanLimitReached,
      payload as unknown as Record<string, unknown>,
      { eventKey: `plan.limit.reached:${actorUserId}:${key}:${vnDayKey(now)}` },
      db,
    );
  } catch (e) {
    console.error("[plans/quota] không ghi được plan.limit.reached", e);
  }
}

/** Người dùng thử được phép nhưng đã vượt mức của gói tham chiếu ⇒ ghi lại. */
async function recordTrialOverReference(
  actorUserId: string | undefined,
  key: UsageMetric,
  src: SourceLimit,
  used: number,
  increment: number,
  now: Date,
  db: PrismaClient,
): Promise<void> {
  if (!actorUserId || !src.referencePlanKey) return;
  try {
    const ref = await db.plan.findUnique({
      where: { key: src.referencePlanKey },
      select: { entitlements: true },
    });
    const refLimit = ref ? asEntitlements(ref.entitlements)[key] : undefined;
    if (typeof refLimit !== "number" || used + increment <= refLimit) return;
    await recordLimitReached(
      actorUserId,
      key,
      { metric: key, limit: refLimit, used, planKey: src.planKey, source: src.source, enforced: false },
      now,
      db,
    );
  } catch (e) {
    console.error("[plans/quota] không so được với gói tham chiếu", e);
  }
}

async function decide(
  actorUserId: string | undefined,
  key: UsageMetric,
  sources: { src: SourceLimit; used: number }[],
  increment: number,
  now: Date,
  db: PrismaClient,
): Promise<QuotaResult> {
  // Ưu tiên cá nhân: `sources` đã xếp cá nhân trước.
  const ok = sources.find((s) => fits(s.src.limit, s.used, increment));
  if (ok) {
    await recordTrialOverReference(actorUserId, key, ok.src, ok.used, increment, now, db);
    return toResult(ok.src, ok.used, true);
  }
  // Không nguồn nào cho phép: trả nguồn có hạn mức lớn hơn (hoà thì cá nhân).
  const shown = sources.reduce((a, b) => ((b.src.limit ?? 0) > (a.src.limit ?? 0) ? b : a));
  await recordLimitReached(
    actorUserId,
    key,
    {
      metric: key,
      limit: shown.src.limit ?? 0,
      used: shown.used,
      planKey: shown.src.planKey,
      source: shown.src.source,
      enforced: true,
    },
    now,
    db,
  );
  return toResult(shown.src, shown.used, false);
}

/**
 * Kiểm một hạn mức theo lượng dùng.
 * - `ai_oral.monthly_attempts`, `storage.mb`: chủ thể là `userId` (giảng viên
 *   chủ chi phí); hai nguồn cá nhân và tổ chức.
 * - `org.max_instructors`: chủ thể là `organizationId`, chỉ nguồn tổ chức;
 *   `userId` (nếu có) là người thao tác, dùng làm chủ thể sự kiện.
 */
export async function checkUsageQuota(
  subject: QuotaSubject,
  key: UsageMetric,
  opts: QuotaOptions = {},
): Promise<QuotaResult> {
  const increment = opts.increment ?? 1;
  const now = opts.now ?? new Date();
  const db = opts.db ?? prisma;
  if (!plansEnabled()) return { ...UNLIMITED };

  if (key === "org.max_instructors") {
    const organizationId = subject.organizationId;
    if (!organizationId) return { ...UNLIMITED };
    const subs = (await activeFor(null, organizationId, now, db)).filter((s) => s.scope === "organization");
    const org = await organizationLimit(organizationId, key, subs, db);
    if (!org) return { ...UNLIMITED };
    const used = await countUsed(key, { organizationId }, now, db);
    return decide(subject.userId, key, [{ src: org, used }], increment, now, db);
  }

  const userId = subject.userId;
  if (!userId) return { ...UNLIMITED };
  if ((await getPlanSubjectKind(userId, db)) !== "teaching") return { ...UNLIMITED };
  const user = await db.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (!user) return { ...UNLIMITED };

  const subs = await activeFor(userId, user.organizationId, now, db);
  const individualSubs = subs.filter((s) => s.scope === "individual");
  const orgSubs = subs.filter((s) => s.scope === "organization");

  const sources: { src: SourceLimit; used: number }[] = [];
  const individual = await individualLimit(userId, key, individualSubs, now, db);
  sources.push({ src: individual, used: await countUsed(key, { userId }, now, db) });
  if (user.organizationId) {
    const org = await organizationLimit(user.organizationId, key, orgSubs, db);
    if (org) {
      sources.push({ src: org, used: await countUsed(key, { organizationId: user.organizationId }, now, db) });
    }
  }
  return decide(userId, key, sources, increment, now, db);
}

/** Như `checkUsageQuota`, nhưng ném `PlanLimitError` khi không được phép. */
export async function assertUsageQuota(
  subject: QuotaSubject,
  key: UsageMetric,
  opts: QuotaOptions = {},
): Promise<QuotaResult> {
  const result = await checkUsageQuota(subject, key, opts);
  if (!result.allowed) throw new PlanLimitError({ ...result, key });
  return result;
}
