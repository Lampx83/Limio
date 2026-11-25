import { sendCodeActivatedEmail } from "./purchaseEmail";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { isAdmin } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { CourseAuthzError } from "../courses/authz";
import {
  ACCESS_CODE_BATCH_MAX,
  AccessCodeError,
  normalizeAccessCode,
  randomCode,
  redeemAccessCode,
  type RedeemAccessCodeResult,
} from "./accessCode";
import { grantBundleAccess } from "./bundleAccess";

/**
 * Mã kích hoạt COMBO (docs/tieu-chi/combo-khoa-hoc.md, AC8): một mã mở mọi khoá của combo, thời hạn = durationMonths
 * của combo. Dùng khi học viên trả tiền ngoài hệ thống (chuyển khoản) và chưa có cổng thanh toán. Cùng định dạng mã
 * và cùng endpoint đổi mã với mã khoá (`redeemAnyCode`), nên người học chỉ cần biết một ô "Tôi có mã".
 */

export async function generateBundleCodes(
  actorUserId: string,
  bundleId: string,
  count: number,
  opts: { note?: string } = {},
  db: PrismaClient = prisma,
): Promise<Array<{ id: string; code: string }>> {
  if (!(await isAdmin(actorUserId, db))) throw new CourseAuthzError("forbidden");
  if (!Number.isInteger(count) || count < 1 || count > ACCESS_CODE_BATCH_MAX) {
    throw new AccessCodeError("validation_failed", { count });
  }
  const bundle = await db.courseBundle.findUnique({ where: { id: bundleId }, select: { id: true } });
  if (!bundle) throw new AccessCodeError("validation_failed", { bundleId: "not_found" });

  const created: Array<{ id: string; code: string }> = [];
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const row = await db.bundleAccessCode.create({
          data: { bundleId, code: randomCode(), createdBy: actorUserId, note: opts.note ?? null },
          select: { id: true, code: true },
        });
        created.push(row);
        break;
      } catch (e) {
        if (attempt < 4 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
  }
  // Payload chỉ mang id và số lượng — KHÔNG bao giờ mang mã.
  await logAudit({ action: "course.bundle.codes_generated", actorUserId, payload: { bundleId, count } }, db);
  return created;
}

export interface RedeemBundleCodeResult {
  /** Khoá đầu tiên của combo: nơi giao diện đưa người học tới sau khi đổi mã. */
  courseSlug: string;
  /** Tên combo (để hiện trong thông báo). */
  courseTitle: string;
  bundleSlug: string;
  courseCount: number;
  created: boolean;
  codeConsumed: boolean;
  accessExpiresAt: Date | null;
}

/** Thông báo "không phải mã combo" để người gọi rơi về đường mã khoá. */
class NotABundleCode extends Error {}

async function redeemBundleCodeOnly(userId: string, rawCode: string, db: PrismaClient): Promise<RedeemBundleCodeResult> {
  const code = normalizeAccessCode(rawCode);
  return db.$transaction(async (tx) => {
    const record = await tx.bundleAccessCode.findUnique({
      where: { code },
      include: {
        bundle: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            items: { orderBy: { orderIndex: "asc" }, select: { course: { select: { id: true, slug: true, status: true } } } },
          },
        },
      },
    });
    if (!record) throw new NotABundleCode();
    if (record.status === "revoked") throw new AccessCodeError("code_revoked");

    const { bundle } = record;
    const first = bundle.items[0]?.course;
    const firstEnrollment = async () =>
      first
        ? tx.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: first.id } }, select: { accessExpiresAt: true } })
        : null;
    const view = (created: boolean, consumed: boolean, expires: Date | null): RedeemBundleCodeResult => ({
      courseSlug: first?.slug ?? "",
      courseTitle: bundle.title,
      bundleSlug: bundle.slug,
      courseCount: bundle.items.length,
      created,
      codeConsumed: consumed,
      accessExpiresAt: expires,
    });

    // Bấm lại mã của chính mình: không tiêu thêm, trả trạng thái hiện tại.
    if (record.status === "redeemed" && record.redeemedByUserId === userId) {
      return view(false, false, (await firstEnrollment())?.accessExpiresAt ?? null);
    }
    if (record.status === "redeemed") throw new AccessCodeError("code_already_used");

    // Không bán thứ không giao được: combo nháp hoặc còn khoá chưa xuất bản.
    if (bundle.status !== "published" || bundle.items.some((i) => i.course.status !== "published")) {
      throw new AccessCodeError("course_not_enrollable");
    }

    const claimed = await tx.bundleAccessCode.updateMany({
      where: { code, status: "unused" },
      data: { status: "redeemed", redeemedByUserId: userId, redeemedAt: new Date() },
    });
    if (claimed.count === 0) throw new AccessCodeError("code_already_used");

    await grantBundleAccess(userId, bundle.id, tx as typeof prisma, "access_code");
    return view(true, true, (await firstEnrollment())?.accessExpiresAt ?? null);
  });
}

export async function redeemBundleCode(userId: string, rawCode: string, db: PrismaClient = prisma): Promise<RedeemBundleCodeResult> {
  try {
    return await redeemBundleCodeOnly(userId, rawCode, db);
  } catch (e) {
    if (e instanceof NotABundleCode) throw new AccessCodeError("code_not_found");
    throw e;
  }
}

/**
 * Đường đổi mã DUY NHẤT cho người dùng: thử mã khoá trước, không có thì thử mã combo (hai bảng, cùng định dạng,
 * khác không gian mã nên không trùng nhau).
 */
export async function redeemAnyCode(
  userId: string,
  rawCode: string,
  db: PrismaClient = prisma,
  opts?: { baseUrl?: string },
): Promise<RedeemAccessCodeResult | RedeemBundleCodeResult> {
  const code = normalizeAccessCode(rawCode);
  const isCourseCode = await db.courseAccessCode.findUnique({ where: { code }, select: { id: true } });
  // Có baseUrl thì gửi MỘT email "đã kích hoạt" (không in lại mã); không để redeemAccessCode gửi thêm email chào mừng.
  const result = isCourseCode
    ? await redeemAccessCode(userId, rawCode, db, { ...opts, baseUrl: undefined })
    : await redeemBundleCode(userId, rawCode, db);
  if (opts?.baseUrl && result.codeConsumed) {
    const isBundle = "bundleSlug" in result;
    await sendCodeActivatedEmail(
      userId,
      {
        itemTitle: isBundle ? `${result.courseTitle} (${(result as RedeemBundleCodeResult).courseCount} khoá)` : result.courseTitle,
        courseSlug: isBundle ? null : result.courseSlug,
        accessExpiresAt: result.accessExpiresAt ?? null,
      },
      opts.baseUrl,
      db,
    );
  }
  return result;
}
