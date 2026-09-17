import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { isAdmin } from "../auth/roles";
import { CourseAuthzError } from "../courses/authz";
import { logAudit } from "../auth/audit";
import { emitEvent } from "./events";
import { resolveDefaultSectionId } from "./enroll";
import { sendTemplatedEmail } from "../email/templates";

// =====================================================================
// CourseAccessPlan — gói bán khoá học theo thời hạn (1 năm, 2 năm, vĩnh
// viễn...). Chỉ admin platform được tạo/sửa, xem CLAUDE.md.
// =====================================================================

export const CourseAccessPlanInput = z.object({
  label: z.string().min(1).max(80).trim(),
  // null = vĩnh viễn.
  durationMonths: z.number().int().min(1).max(120).nullable(),
  priceCents: z.number().int().min(0),
  currency: z.enum(["VND", "USD"]).optional(),
});
export type CourseAccessPlanInput = z.infer<typeof CourseAccessPlanInput>;

async function assertAdmin(actorUserId: string, db: PrismaClient): Promise<void> {
  if (!(await isAdmin(actorUserId, db))) throw new CourseAuthzError("forbidden");
}

export async function createCourseAccessPlan(
  actorUserId: string,
  courseId: string,
  input: CourseAccessPlanInput,
  db: PrismaClient = prisma,
) {
  await assertAdmin(actorUserId, db);
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw new CourseAuthzError("not_found");

  const parsed = CourseAccessPlanInput.parse(input);
  const plan = await db.courseAccessPlan.create({
    data: {
      courseId,
      label: parsed.label,
      durationMonths: parsed.durationMonths,
      priceCents: parsed.priceCents,
      currency: parsed.currency ?? "VND",
      createdBy: actorUserId,
    },
  });
  await logAudit(
    {
      action: "course.access_plan.created",
      actorUserId,
      payload: {
        courseId,
        planId: plan.id,
        label: plan.label,
        durationMonths: plan.durationMonths,
        priceCents: plan.priceCents,
      },
    },
    db,
  );
  return plan;
}

export async function listCourseAccessPlans(
  courseId: string,
  opts: { includeInactive?: boolean } = {},
  db: PrismaClient = prisma,
) {
  return db.courseAccessPlan.findMany({
    where: { courseId, ...(opts.includeInactive ? {} : { isActive: true }) },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateCourseAccessPlan(
  actorUserId: string,
  planId: string,
  input: Partial<CourseAccessPlanInput> & { isActive?: boolean },
  db: PrismaClient = prisma,
) {
  await assertAdmin(actorUserId, db);
  const existing = await db.courseAccessPlan.findUnique({ where: { id: planId } });
  if (!existing) throw new CourseAuthzError("not_found");

  const plan = await db.courseAccessPlan.update({
    where: { id: planId },
    data: {
      label: input.label,
      durationMonths:
        "durationMonths" in input ? (input.durationMonths ?? null) : undefined,
      priceCents: input.priceCents,
      currency: input.currency,
      isActive: input.isActive,
    },
  });
  await logAudit(
    {
      action: "course.access_plan.updated",
      actorUserId,
      payload: { planId, changes: input },
    },
    db,
  );
  return plan;
}

// =====================================================================
// Cấp/gia hạn truy cập — dùng bởi webhook thanh toán (Stripe) và bởi các
// kênh cấp quyền thủ công khác trong tương lai.
// =====================================================================

function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export interface ExtendAccessPlan {
  id: string | null;
  durationMonths: number | null;
}

export interface ExtendAccessResult {
  enrollmentId: string;
  accessExpiresAt: Date | null;
  created: boolean;
}

/**
 * Cấp hoặc gia hạn quyền truy cập 1 khoá học theo 1 CourseAccessPlan.
 *
 * - Gói `durationMonths=null` (vĩnh viễn) luôn xoá hẳn hạn, dù trước đó có hạn
 *   hay không.
 * - Gia hạn khi còn hạn: CỘNG DỒN từ hạn hiện có (không phải từ `now()`) —
 *   mua thêm 1 năm lúc còn 2 tháng thì hết hạn sau 1 năm 2 tháng, không để
 *   học viên mất thời gian đã trả.
 * - Nếu đang có truy cập vĩnh viễn (`accessExpiresAt=null`, status active),
 *   mua thêm 1 gói có hạn KHÔNG được rút ngắn quyền — giữ nguyên vĩnh viễn.
 * - Mua lại sau khi đã `expired`: tính hạn mới từ `now()`, không cộng dồn với
 *   hạn đã qua, và status quay lại `active`.
 */
export async function extendEnrollmentAccess(
  userId: string,
  course: { id: string; version: number },
  plan: ExtendAccessPlan,
  db: PrismaClient = prisma,
  opts?: { sectionId?: string },
): Promise<ExtendAccessResult> {
  const now = new Date();
  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
  });

  const alreadyLifetime =
    existing !== null &&
    existing.accessExpiresAt === null &&
    (existing.status === "active" || existing.status === "completed");

  let newExpiresAt: Date | null;
  if (plan.durationMonths === null) {
    newExpiresAt = null;
  } else if (alreadyLifetime) {
    newExpiresAt = null;
  } else {
    const stillValid =
      existing !== null &&
      existing.status === "active" &&
      existing.accessExpiresAt !== null &&
      existing.accessExpiresAt > now;
    const base = stillValid ? (existing!.accessExpiresAt as Date) : now;
    newExpiresAt = addMonthsUtc(base, plan.durationMonths);
  }

  const sectionId = opts?.sectionId ?? (await resolveDefaultSectionId(course.id, db));

  const enrollment = await db.enrollment.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    create: {
      userId,
      courseId: course.id,
      sectionId,
      courseVersion: course.version,
      status: "active",
      accessExpiresAt: newExpiresAt,
    },
    update: {
      status: "active",
      accessExpiresAt: newExpiresAt,
      accessExpiryReminderSentAt: null,
    },
  });

  await emitEvent(
    userId,
    LearningEventType.EnrollmentAccessExtended,
    {
      enrollmentId: enrollment.id,
      courseId: course.id,
      accessPlanId: plan.id,
      durationMonths: plan.durationMonths,
      previousExpiresAt: existing?.accessExpiresAt?.toISOString() ?? null,
      newExpiresAt: newExpiresAt?.toISOString() ?? null,
    },
    { courseId: course.id },
    db,
  );

  return {
    enrollmentId: enrollment.id,
    accessExpiresAt: newExpiresAt,
    created: existing === null,
  };
}

// =====================================================================
// Cron jobs — reaper (chuyển active -> expired) + nhắc hạn qua email.
// =====================================================================

export interface ExpireDueEnrollmentsResult {
  expiredCount: number;
}

/**
 * Chuyển Enrollment đã quá `accessExpiresAt` từ `active` sang `expired`.
 * Idempotent: chạy lại chỉ nhặt những dòng còn `status=active` (đã expired
 * thì không match where nữa), và update có điều kiện `status: "active"` để
 * tránh race nếu 2 lần chạy chồng nhau.
 */
export async function expireDueEnrollments(
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<ExpireDueEnrollmentsResult> {
  const due = await db.enrollment.findMany({
    where: { status: "active", accessExpiresAt: { lt: now } },
    select: { id: true, userId: true, courseId: true },
  });

  let expiredCount = 0;
  for (const e of due) {
    const updated = await db.enrollment.updateMany({
      where: { id: e.id, status: "active" },
      data: { status: "expired" },
    });
    if (updated.count === 0) continue; // đã bị request khác xử lý trước
    await emitEvent(
      e.userId,
      LearningEventType.EnrollmentAccessExpired,
      { enrollmentId: e.id, courseId: e.courseId, expiredAt: now.toISOString() },
      { courseId: e.courseId, eventKey: `enrollment.access.expired:${e.id}` },
      db,
    );
    expiredCount++;
  }
  return { expiredCount };
}

const REMINDER_WINDOW_DAYS = 7;

export interface SendAccessExpiryRemindersResult {
  remindersSent: number;
}

/**
 * Gửi email nhắc học viên có `accessExpiresAt` trong vòng
 * REMINDER_WINDOW_DAYS ngày tới và chưa từng được nhắc
 * (`accessExpiryReminderSentAt=null`). Best-effort: 1 email lỗi không chặn
 * các dòng khác, và chỉ đánh dấu đã gửi SAU KHI gửi thành công — gửi lỗi thì
 * để nguyên, cron ngày mai thử lại.
 */
export async function sendAccessExpiryReminders(
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<SendAccessExpiryRemindersResult> {
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const due = await db.enrollment.findMany({
    where: {
      status: "active",
      accessExpiresAt: { gt: now, lte: windowEnd },
      accessExpiryReminderSentAt: null,
    },
    include: {
      user: { select: { email: true, displayName: true } },
      course: { select: { title: true, organizationId: true } },
    },
  });

  let remindersSent = 0;
  for (const e of due) {
    if (!e.accessExpiresAt) continue;
    try {
      await sendTemplatedEmail({
        key: "course.access_expiring",
        to: e.user.email,
        organizationId: e.course.organizationId,
        variables: {
          learnerName: e.user.displayName,
          courseTitle: e.course.title,
          expiresAtDate: e.accessExpiresAt.toLocaleDateString("vi-VN"),
        },
      });
    } catch {
      continue;
    }
    await db.enrollment.update({
      where: { id: e.id },
      data: { accessExpiryReminderSentAt: now },
    });
    await emitEvent(
      e.userId,
      LearningEventType.EnrollmentAccessReminderSent,
      {
        enrollmentId: e.id,
        courseId: e.courseId,
        accessExpiresAt: e.accessExpiresAt.toISOString(),
      },
      { courseId: e.courseId, eventKey: `enrollment.access.reminder_sent:${e.id}` },
      db,
    );
    remindersSent++;
  }
  return { remindersSent };
}
