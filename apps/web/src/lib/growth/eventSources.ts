/**
 * Nguồn dữ liệu Prisma cho growth events. CHỈ ĐỌC: mọi câu lệnh ở đây là SELECT
 * (`$queryRaw` / `findMany`); không có write nào trong file này.
 *
 * Mọi truy vấn đi theo index (xem migration 20261011000000_acquisition_touch):
 *   user.registered        User(createdAt)
 *   user.email_verified    User(emailVerifiedAt)            [mới]
 *   enrollment.created     Enrollment(enrolledAt)           [mới] + (userId, …)
 *   order.paid / refunded  Order(paidAt) / Order(refundedAt) [mới]
 *   activity.first_recorded  LearningEvent(userId, occurredAt) — tra từng user,
 *                            trên tập ứng viên bị chặn (xem loadActivityRows).
 */
import { Prisma, prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { GrowthEventSource, GrowthEventType, RawRow, TouchSource } from "./events";

/**
 * Tài khoản KHÔNG phải người dùng thật. `User` không có cờ test/disabled/soft-
 * delete (xoá user = xoá dòng, cascade), nên lọc theo email của tài khoản seed /
 * demo / tên miền dành riêng (RFC 2606, 6761).
 */
export const EXCLUDED_EMAIL_PATTERNS = [
  "%@feedbackme.dev", // seed-*.ts, bộ test
  "%@demo-english.limio.vn", // seed-demo-english-center.ts
  "%@example.com",
  "%@example.org",
  "%@example.net",
  "%.test",
  "%.invalid",
  "%.local",
  "%.localhost",
];

/** Loại sự kiện học tập tính là "hoạt động đầu tiên": `lesson.*` và `quiz.*`. */
export const ACTIVITY_EVENT_TYPES: string[] = Object.values(LearningEventType).filter(
  (t) => t.startsWith("lesson.") || t.startsWith("quiz."),
);

/** Chỉ xét user đăng ký / ghi danh trong chừng này ngày gần đây. */
export const ACTIVITY_WINDOW_DAYS = 120;
/** Trần số user ứng viên cho mỗi request (mỗi user = 1 lần tra index). */
export const ACTIVITY_CANDIDATE_CAP = 5000;

const excludeTestUsers = Prisma.sql`NOT (lower(u."email") LIKE ANY (${EXCLUDED_EMAIL_PATTERNS}::text[]))`;

// Prisma gửi chuỗi như text; ép về `timestamp` (cột Prisma là timestamp(3) không
// múi giờ, lưu UTC). Chuỗi ISO có `Z` bị bỏ phần múi giờ khi ép vào `timestamp`,
// còn lại đúng giờ UTC — khớp cách Prisma ghi.
const ts = (d: Date) => Prisma.sql`${d.toISOString()}::timestamp`;

interface DbRow {
  key?: string;
  userId: string;
  occurredAt: Date;
  orderId?: string;
  amountCents?: number;
  currency?: string;
}

function toRaw(r: DbRow): RawRow {
  return {
    key: r.key ?? r.userId,
    userId: r.userId,
    occurredAt: r.occurredAt,
    orderId: r.orderId,
    amountMinor: r.amountCents,
    currency: r.currency,
  };
}

/** Nguồn "một cột timestamp trên một bảng" dùng chung cho 5 loại đơn giản. */
function simpleSource(
  type: GrowthEventType,
  build: (cond: Prisma.Sql, order: Prisma.Sql, limit: Prisma.Sql) => Prisma.Sql,
  tsColumn: Prisma.Sql,
): GrowthEventSource {
  return {
    type,
    async fetchAt(at, cap) {
      const rows = await prisma.$queryRaw<DbRow[]>(
        build(Prisma.sql`${tsColumn} = ${ts(at)}`, Prisma.sql``, Prisma.sql`LIMIT ${cap}`),
      );
      return rows.map(toRaw);
    },
    async fetchAfter(after, n, upTo) {
      const lower = after ? Prisma.sql`${tsColumn} > ${ts(after)} AND ` : Prisma.empty;
      const rows = await prisma.$queryRaw<DbRow[]>(
        build(
          Prisma.sql`${lower}${tsColumn} <= ${ts(upTo)}`,
          Prisma.sql`ORDER BY ${tsColumn} ASC, "key" ASC`,
          Prisma.sql`LIMIT ${n}`,
        ),
      );
      return rows.map(toRaw);
    },
  };
}

const registered = simpleSource(
  "user.registered",
  (cond, order, limit) => Prisma.sql`
    SELECT u."id" AS "key", u."id" AS "userId", u."createdAt" AS "occurredAt"
    FROM "User" u
    WHERE ${cond} AND ${excludeTestUsers}
    ${order} ${limit}`,
  Prisma.sql`u."createdAt"`,
);

const emailVerified = simpleSource(
  "user.email_verified",
  (cond, order, limit) => Prisma.sql`
    SELECT u."id" AS "key", u."id" AS "userId", u."emailVerifiedAt" AS "occurredAt"
    FROM "User" u
    WHERE u."emailVerifiedAt" IS NOT NULL AND ${cond} AND ${excludeTestUsers}
    ${order} ${limit}`,
  Prisma.sql`u."emailVerifiedAt"`,
);

/**
 * Chỉ lần ghi danh ĐẦU TIÊN của mỗi user: không tồn tại ghi danh nào sớm hơn
 * (sớm hơn về thời gian, hoặc cùng thời điểm nhưng id nhỏ hơn).
 */
const firstEnrollment = simpleSource(
  "enrollment.created",
  (cond, order, limit) => Prisma.sql`
    SELECT e."userId" AS "key", e."userId" AS "userId", e."enrolledAt" AS "occurredAt"
    FROM "Enrollment" e
    JOIN "User" u ON u."id" = e."userId"
    WHERE ${cond} AND ${excludeTestUsers}
      AND NOT EXISTS (
        SELECT 1 FROM "Enrollment" p
        WHERE p."userId" = e."userId" AND p."id" <> e."id"
          AND (p."enrolledAt" < e."enrolledAt"
               OR (p."enrolledAt" = e."enrolledAt" AND p."id" < e."id"))
      )
    ${order} ${limit}`,
  Prisma.sql`e."enrolledAt"`,
);

function orderSource(type: "order.paid" | "order.refunded", column: "paidAt" | "refundedAt") {
  const col = Prisma.raw(`o."${column}"`);
  return simpleSource(
    type,
    (cond, order, limit) => Prisma.sql`
      SELECT o."id" AS "key", o."userId" AS "userId", ${col} AS "occurredAt",
             o."id" AS "orderId", o."amountCents" AS "amountCents", o."currency" AS "currency"
      FROM "Order" o
      JOIN "User" u ON u."id" = o."userId"
      WHERE ${col} IS NOT NULL AND ${cond} AND ${excludeTestUsers}
      ${order} ${limit}`,
    col,
  );
}

/**
 * Lần hoạt động học đầu tiên của từng user trong tập ứng viên bị chặn.
 *
 * Không quét `LearningEvent` (bảng lớn, append-only): thay vào đó
 *  1. ứng viên = user đăng ký HOẶC ghi danh trong ACTIVITY_WINDOW_DAYS ngày qua,
 *     lấy tối đa ACTIVITY_CANDIDATE_CAP user mới nhất;
 *  2. với mỗi ứng viên, một lần tra LATERAL … ORDER BY occurredAt LIMIT 1 trên
 *     index (userId, occurredAt) — dừng ngay ở dòng khớp đầu tiên.
 * Chi phí tối đa = ACTIVITY_CANDIDATE_CAP lần tra index/request, không phụ
 * thuộc kích thước LearningEvent. Hệ quả có chủ ý: user có hoạt động đầu tiên
 * muộn hơn 120 ngày sau khi đăng ký/ghi danh (hoặc ngoài trần ứng viên) không
 * được báo.
 */
async function loadActivityRows(upTo: Date): Promise<RawRow[]> {
  const windowStart = new Date(upTo.getTime() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<DbRow[]>(Prisma.sql`
    WITH cand AS (
      SELECT u."id" AS "userId", u."createdAt" AS ts
      FROM "User" u
      WHERE u."createdAt" >= ${ts(windowStart)} AND ${excludeTestUsers}
      UNION ALL
      SELECT e."userId", e."enrolledAt"
      FROM "Enrollment" e
      JOIN "User" u ON u."id" = e."userId"
      WHERE e."enrolledAt" >= ${ts(windowStart)} AND ${excludeTestUsers}
    ), pick AS (
      SELECT "userId", max(ts) AS ts
      FROM cand
      GROUP BY "userId"
      ORDER BY max(ts) DESC
      LIMIT ${ACTIVITY_CANDIDATE_CAP}
    )
    SELECT p."userId" AS "userId", fa."occurredAt" AS "occurredAt"
    FROM pick p
    CROSS JOIN LATERAL (
      SELECT le."occurredAt"
      FROM "LearningEvent" le
      WHERE le."userId" = p."userId" AND le."eventType" = ANY (${ACTIVITY_EVENT_TYPES}::text[])
      ORDER BY le."occurredAt" ASC
      LIMIT 1
    ) fa
    WHERE fa."occurredAt" <= ${ts(upTo)}
  `);
  return rows.map(toRaw);
}

/** Nguồn activity: nạp một lần cho mỗi request rồi lọc/sắp trong bộ nhớ. */
function activitySource(upTo: Date): GrowthEventSource {
  let loaded: Promise<RawRow[]> | null = null;
  const all = () => (loaded ??= loadActivityRows(upTo));
  const byTimeThenKey = (a: RawRow, b: RawRow) =>
    a.occurredAt.getTime() - b.occurredAt.getTime() || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  return {
    type: "activity.first_recorded",
    async fetchAt(at, cap) {
      return (await all()).filter((r) => r.occurredAt.getTime() === at.getTime()).slice(0, cap);
    },
    async fetchAfter(after, n, bound) {
      return (await all())
        .filter(
          (r) =>
            r.occurredAt.getTime() <= bound.getTime() &&
            (after === null || r.occurredAt.getTime() > after.getTime()),
        )
        .sort(byTimeThenKey)
        .slice(0, n);
    },
  };
}

/** Tạo bộ nguồn cho các `types` được yêu cầu. `upTo` = mốc lắng (giờ hiện tại − độ trễ). */
export function createPrismaSources(types: GrowthEventType[], upTo: Date): GrowthEventSource[] {
  const all: Record<GrowthEventType, () => GrowthEventSource> = {
    "user.registered": () => registered,
    "user.email_verified": () => emailVerified,
    "enrollment.created": () => firstEnrollment,
    "activity.first_recorded": () => activitySource(upTo),
    "order.paid": () => orderSource("order.paid", "paidAt"),
    "order.refunded": () => orderSource("order.refunded", "refundedAt"),
  };
  return types.map((t) => all[t]());
}

/** Điểm chạm đầu tiên của các user trong trang (≤ 500 id). */
export async function loadTouches(userIds: string[]): Promise<Map<string, TouchSource>> {
  const rows = await prisma.acquisitionTouch.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmContent: true,
      utmTerm: true,
      clickIdKind: true,
      landingPath: true,
      referrerHost: true,
    },
  });
  return new Map(rows.map((r) => [r.userId, r]));
}
