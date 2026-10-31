import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { AccessCodeError, normalizeAccessCode, randomCode } from "./accessCode";
import { emitEvent } from "./events";

/**
 * AC2 — mã kích hoạt theo lô (docs/tieu-chi/hoc-lieu-nha-xuat-ban-P0.md).
 *
 * Một lô là một đợt in (vd "Tái bản 2026 — đợt 1"): gom, đếm, xuất file cho nhà in và thu hồi cả lô. Mã trong lô
 * vẫn là CourseAccessCode như mọi mã khác nên đường nhập mã (`redeemAccessCode`) không đổi.
 *
 * Quyền (assertCanEditCourse) do route kiểm, như `generateAccessCodes` — các hàm ở đây chỉ nhận courseId đã được
 * phép. Mọi hàm đọc/ghi theo lô đều khoá thêm `courseId`, để lô của khoá này không bao giờ đọc được qua khoá khác.
 */

export const ACCESS_CODE_BATCH_LIMIT = 10_000;
export const ACCESS_CODE_BATCH_LABEL_MAX = 80;
export const ACCESS_CODE_BATCH_NOTE_MAX = 500;
export const ACCESS_CODE_PAGE_SIZE = 50;

/** Mỗi lần createMany một khối vừa phải: 10.000 dòng một câu lệnh thì chậm và dễ chạm giới hạn tham số. */
const INSERT_CHUNK = 1_000;
const MAX_TOP_UP_ROUNDS = 5;

export const ACCESS_DURATION_MONTHS_MAX = 120;

export interface CreateAccessCodeBatchInput {
  label: string;
  count: number;
  note?: string | null;
  /** Tháng truy cập mỗi mã cấp, tính từ lúc kích hoạt. null/bỏ trống = vĩnh viễn (như trước AC3). */
  accessDurationMonths?: number | null;
  /** Hạn kích hoạt, dạng `YYYY-MM-DD` theo giờ Việt Nam; hết hạn vào cuối ngày đó. null/bỏ trống = không hạn. */
  activateBefore?: string | null;
}

/** Cuối ngày `YYYY-MM-DD` theo giờ Việt Nam (UTC+7, không có giờ mùa hè); null nếu không phải ngày hợp lệ. */
export function endOfDayVn(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T23:59:59.999+07:00`);
  if (Number.isNaN(d.getTime())) return null;
  // Date tự "cuộn" ngày không có thật (2026-02-31 → 03/03): chỉ nhận khi ngày VN của kết quả đúng bằng đầu vào.
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10) === date ? d : null;
}

export interface AccessCodeBatchRow {
  id: string;
  label: string;
  note: string | null;
  count: number;
  accessDurationMonths: number | null;
  activateBefore: Date | null;
  createdAt: Date;
  stats: { unused: number; redeemed: number; revoked: number };
}

export async function createAccessCodeBatch(
  courseId: string,
  createdBy: string,
  input: CreateAccessCodeBatchInput,
  db: PrismaClient = prisma,
): Promise<{ batchId: string; count: number }> {
  const label = (input.label ?? "").trim();
  const note = input.note?.trim() ? input.note.trim() : null;
  const accessDurationMonths = input.accessDurationMonths ?? null;
  const activateBefore = input.activateBefore ? endOfDayVn(input.activateBefore) : null;
  if (
    (accessDurationMonths !== null &&
      (!Number.isInteger(accessDurationMonths) ||
        accessDurationMonths < 1 ||
        accessDurationMonths > ACCESS_DURATION_MONTHS_MAX)) ||
    // Hạn kích hoạt đã qua thì lô sinh ra là mã chết ngay: từ chối thay vì để giảng viên in nhầm.
    (input.activateBefore && (activateBefore === null || activateBefore.getTime() <= Date.now())) ||
    label.length < 1 ||
    label.length > ACCESS_CODE_BATCH_LABEL_MAX ||
    (note !== null && note.length > ACCESS_CODE_BATCH_NOTE_MAX) ||
    !Number.isInteger(input.count) ||
    input.count < 1 ||
    input.count > ACCESS_CODE_BATCH_LIMIT
  ) {
    throw new AccessCodeError("validation_failed", {
      maxCount: ACCESS_CODE_BATCH_LIMIT,
      maxLabel: ACCESS_CODE_BATCH_LABEL_MAX,
    });
  }
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { priceCents: true, currency: true, enrollMode: true },
  });
  if (!course) throw new AccessCodeError("course_not_found");
  // Cùng bất biến với generateAccessCodes: khoá chỉ-link-mời không có ô nhập mã nên sinh mã là vô ích.
  if (course.enrollMode === "invite_only") throw new AccessCodeError("course_invite_only");

  return db.$transaction(
    async (tx) => {
      const batch = await tx.courseAccessCodeBatch.create({
        data: { courseId, label, note, count: input.count, accessDurationMonths, activateBefore, createdBy },
        select: { id: true },
      });

      let inserted = 0;
      for (let round = 0; inserted < input.count; round++) {
        if (round >= MAX_TOP_UP_ROUNDS) throw new Error("access_code_collision_storm");
        // Bốc dư một chút ở các vòng bù và bỏ trùng trong chính lô; trùng với mã đã có thì skipDuplicates bỏ,
        // vòng sau bù đủ. Với 32^12 khả năng thì thực tế chỉ chạy một vòng.
        const want = input.count - inserted;
        for (let from = 0; from < want; from += INSERT_CHUNK) {
          const size = Math.min(INSERT_CHUNK, want - from);
          const fresh = new Set<string>();
          while (fresh.size < size) fresh.add(randomCode());
          const r = await tx.courseAccessCode.createMany({
            data: [...fresh].map((code) => ({
              courseId,
              code,
              createdBy,
              batchId: batch.id,
              // Chốt giá lúc sinh, như generateAccessCodes: đổi giá khoá sau này không làm lệch báo cáo.
              priceCentsSnapshot: course.priceCents,
              currency: course.currency,
            })),
            skipDuplicates: true,
          });
          inserted += r.count;
        }
      }

      await emitEvent(
        createdBy,
        LearningEventType.CourseAccessBatchCreated,
        { batchId: batch.id, courseId, count: input.count },
        { courseId },
        tx as typeof prisma,
      );
      return { batchId: batch.id, count: input.count };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

/** Các lô của khoá (mới nhất trước) kèm số mã theo trạng thái, và số mã lẻ không thuộc lô nào. */
export async function listAccessCodeBatches(
  courseId: string,
  db: PrismaClient = prisma,
): Promise<{ batches: AccessCodeBatchRow[]; ungrouped: number }> {
  const [batches, grouped, ungrouped] = await Promise.all([
    db.courseAccessCodeBatch.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        note: true,
        count: true,
        accessDurationMonths: true,
        activateBefore: true,
        createdAt: true,
      },
    }),
    db.courseAccessCode.groupBy({
      by: ["batchId", "status"],
      where: { courseId, batchId: { not: null } },
      _count: { _all: true },
    }),
    db.courseAccessCode.count({ where: { courseId, batchId: null } }),
  ]);
  const stats = new Map<string, { unused: number; redeemed: number; revoked: number }>();
  for (const g of grouped) {
    const s = stats.get(g.batchId!) ?? { unused: 0, redeemed: 0, revoked: 0 };
    s[g.status] = g._count._all;
    stats.set(g.batchId!, s);
  }
  return {
    batches: batches.map((b) => ({ ...b, stats: stats.get(b.id) ?? { unused: 0, redeemed: 0, revoked: 0 } })),
    ungrouped,
  };
}

async function requireBatch(courseId: string, batchId: string, db: PrismaClient) {
  const batch = await db.courseAccessCodeBatch.findFirst({
    where: { id: batchId, courseId },
    select: { id: true, label: true },
  });
  if (!batch) throw new AccessCodeError("batch_not_found");
  return batch;
}

export type AccessCodeStatusFilter = "unused" | "redeemed" | "revoked";

/** Mã của một lô, phân trang (50/trang), lọc được theo trạng thái. */
export async function listBatchCodes(
  courseId: string,
  batchId: string,
  opts: { status?: AccessCodeStatusFilter; page?: number } = {},
  db: PrismaClient = prisma,
) {
  await requireBatch(courseId, batchId, db);
  const page = Number.isInteger(opts.page) && (opts.page as number) >= 1 ? (opts.page as number) : 1;
  const where: Prisma.CourseAccessCodeWhereInput = { courseId, batchId, ...(opts.status ? { status: opts.status } : {}) };
  const [total, rows] = await Promise.all([
    db.courseAccessCode.count({ where }),
    db.courseAccessCode.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * ACCESS_CODE_PAGE_SIZE,
      take: ACCESS_CODE_PAGE_SIZE,
      include: { redeemedBy: { select: { email: true, displayName: true } } },
    }),
  ]);
  return { rows, total, page, pageSize: ACCESS_CODE_PAGE_SIZE };
}

/**
 * Tra một mã trong phạm vi MỘT khoá (khách báo lỗi): trạng thái, lô, ai dùng và lúc nào.
 * Mã của khoá khác trả như không tìm thấy — người sửa khoá này không được dò mã khoá khác.
 */
export async function lookupAccessCode(courseId: string, rawCode: string, db: PrismaClient = prisma) {
  const code = normalizeAccessCode(rawCode ?? "");
  if (code.length === 0) throw new AccessCodeError("validation_failed");
  const row = await db.courseAccessCode.findFirst({
    where: { code, courseId },
    include: {
      batch: { select: { id: true, label: true, accessDurationMonths: true, activateBefore: true } },
      redeemedBy: { select: { email: true, displayName: true } },
    },
  });
  if (!row) throw new AccessCodeError("code_not_found");
  return row;
}

/** Bỏ dấu, chỉ còn chữ-số và gạch nối, để dùng trong tên file tải về. */
function fileSafe(label: string): string {
  const s = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "lo-ma";
}

/**
 * CSV cho nhà in: UTF-8 có BOM (Excel tiếng Việt mở đúng), cột `STT`, `Mã`. Mặc định chỉ mã CHƯA dùng — mã đã
 * kích hoạt hoặc đã thu hồi không có lý do ra khỏi hệ thống. Mã là bí mật tự cấp quyền nên mỗi lần xuất ghi một sự
 * kiện (id + số dòng, không mang mã). Không đổi trạng thái mã.
 */
export async function exportBatchCodesCsv(
  courseId: string,
  batchId: string,
  actorUserId: string,
  opts: { scope?: "unused" | "all" } = {},
  db: PrismaClient = prisma,
): Promise<{ csv: string; filename: string; count: number }> {
  const batch = await requireBatch(courseId, batchId, db);
  const rows = await db.courseAccessCode.findMany({
    where: { courseId, batchId, ...(opts.scope === "all" ? {} : { status: "unused" }) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { code: true },
  });
  const csv = "﻿" + ["STT,Mã", ...rows.map((r, i) => `${i + 1},${r.code}`)].join("\r\n") + "\r\n";
  await emitEvent(
    actorUserId,
    LearningEventType.CourseAccessBatchExported,
    { batchId, courseId, count: rows.length },
    { courseId },
    db,
  );
  return { csv, filename: `ma-kich-hoat-${fileSafe(batch.label)}.csv`, count: rows.length };
}

/**
 * Thu hồi mọi mã CHƯA dùng của lô trong một thao tác. Mã đã kích hoạt không đổi và học viên không mất quyền.
 * Điều kiện `status: "unused"` nằm ngay trong updateMany nên một mã vừa được kích hoạt giữa chừng không bị thu hồi.
 */
export async function revokeBatch(
  courseId: string,
  batchId: string,
  actorUserId: string,
  db: PrismaClient = prisma,
): Promise<{ revoked: number }> {
  await requireBatch(courseId, batchId, db);
  const r = await db.courseAccessCode.updateMany({
    where: { courseId, batchId, status: "unused" },
    data: { status: "revoked" },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.CourseAccessBatchRevoked,
    { batchId, courseId, count: r.count },
    { courseId },
    db,
  );
  return { revoked: r.count };
}
