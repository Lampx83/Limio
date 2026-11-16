/**
 * Báo cáo cho nhà xuất bản — số liệu (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC2–AC7).
 *
 * Nguyên tắc chung, không được phá:
 *  - KHÔNG trả về danh tính người học (tên, email, userId, mã kích hoạt) ở bất kỳ hàm nào dưới đây.
 *    Kết quả đi thẳng ra JSON của API; test kiểm cả JSON.
 *  - Tỉ lệ của nhóm dưới REPORT_MIN_GROUP người thì không trả về (chỉ `insufficient: true`).
 *  - Ngưỡng nhãn dùng đúng MASTERY_REVIEW_BELOW / MASTERY_SOLID_AT của học viên, không viết lại số.
 *  - Mốc tuần/tháng theo giờ Việt Nam (UTC+7, không có giờ mùa hè).
 *
 * Hàm không tự kiểm quyền: caller (API route) gọi canViewCourseReport trước.
 */
import { prisma } from "@feedbackme/db";
import {
  LearningEventType,
  MASTERY_REVIEW_BELOW,
  MASTERY_SOLID_AT,
  lessonSkillCode,
} from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { emitEvent } from "../learning/events";
import { learnerActivityWhere } from "../learning/activity";
import { ITEM_ANALYTICS_MIN_ATTEMPTS } from "../exam/analytics";

/** k của AC: nhóm nhỏ hơn số này thì không hiện tỉ lệ (Q4 đã chốt). */
export const REPORT_MIN_GROUP = 10;

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

export type ReportRange = 30 | 90 | "all";

export function rangeStart(range: ReportRange, now: Date = new Date()): Date | null {
  return range === "all" ? null : new Date(now.getTime() - range * DAY_MS);
}

/** "YYYY-MM-DD" của thứ Hai đầu tuần (giờ VN) chứa thời điểm d. */
export function vnWeekKey(d: Date): string {
  const vn = new Date(d.getTime() + VN_OFFSET_MS);
  const dow = (vn.getUTCDay() + 6) % 7; // 0 = thứ Hai
  const monday = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() - dow));
  return monday.toISOString().slice(0, 10);
}

/** "YYYY-MM" theo giờ VN. */
export function vnMonthKey(d: Date): string {
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 7);
}

/** Chuỗi tuần liên tục từ tuần chứa `from` tới tuần chứa `to` (tối đa 104 tuần gần nhất), điền 0. */
function weekSeries(counts: Map<string, number>, from: Date, to: Date): { week: string; count: number }[] {
  const out: { week: string; count: number }[] = [];
  const end = vnWeekKey(to);
  let cur = new Date(`${vnWeekKey(from)}T00:00:00Z`);
  const minStart = new Date(new Date(`${end}T00:00:00Z`).getTime() - 103 * 7 * DAY_MS);
  if (cur < minStart) cur = minStart;
  for (;;) {
    const key = cur.toISOString().slice(0, 10);
    out.push({ week: key, count: counts.get(key) ?? 0 });
    if (key >= end) break;
    cur = new Date(cur.getTime() + 7 * DAY_MS);
  }
  return out;
}

function bump<K>(m: Map<K, number>, k: K, by = 1) {
  m.set(k, (m.get(k) ?? 0) + by);
}

async function enrolledUserIds(courseId: string, db: DbClient): Promise<Set<string>> {
  const rows = await db.enrollment.findMany({ where: { courseId }, select: { userId: true } });
  return new Set(rows.map((r) => r.userId));
}

// ---------------------------------------------------------------------------
// AC2 — Phát hành (mã kích hoạt)
// ---------------------------------------------------------------------------

export interface ActivationBatchRow {
  batchId: string | null; // null = dòng "Mã lẻ"
  label: string;
  createdAt: Date | null;
  total: number;
  redeemed: number;
  unused: number;
  revoked: number;
  /** đã kích hoạt / (tổng − đã thu hồi); null khi mẫu số 0. */
  activationRate: number | null;
  accessDurationMonths: number | null;
  activateBefore: Date | null;
  expiringSoon: boolean;
  activationClosed: boolean;
}

export interface ActivationReport {
  batches: ActivationBatchRow[];
  weekly: { week: string; count: number }[];
  totals: { total: number; redeemed: number; unused: number; revoked: number };
}

export async function getActivationReport(
  courseId: string,
  opts: { range: ReportRange; batchId?: string | null; now?: Date },
  db: DbClient = prisma,
): Promise<ActivationReport> {
  const now = opts.now ?? new Date();
  const [batches, grouped] = await Promise.all([
    db.courseAccessCodeBatch.findMany({
      where: { courseId },
      orderBy: { createdAt: "asc" },
      select: { id: true, label: true, createdAt: true, accessDurationMonths: true, activateBefore: true },
    }),
    db.courseAccessCode.groupBy({ by: ["batchId", "status"], where: { courseId }, _count: { _all: true } }),
  ]);

  const counts = new Map<string | null, { unused: number; redeemed: number; revoked: number }>();
  for (const g of grouped) {
    const c = counts.get(g.batchId) ?? { unused: 0, redeemed: 0, revoked: 0 };
    c[g.status] += g._count._all;
    counts.set(g.batchId, c);
  }

  const row = (
    batchId: string | null,
    label: string,
    createdAt: Date | null,
    accessDurationMonths: number | null,
    activateBefore: Date | null,
  ): ActivationBatchRow => {
    const c = counts.get(batchId) ?? { unused: 0, redeemed: 0, revoked: 0 };
    const total = c.unused + c.redeemed + c.revoked;
    const denom = total - c.revoked;
    const closed = !!activateBefore && activateBefore.getTime() < now.getTime();
    return {
      batchId,
      label,
      createdAt,
      total,
      redeemed: c.redeemed,
      unused: c.unused,
      revoked: c.revoked,
      activationRate: denom > 0 ? c.redeemed / denom : null,
      accessDurationMonths,
      activateBefore,
      activationClosed: closed,
      expiringSoon:
        !!activateBefore && !closed && c.unused > 0 && activateBefore.getTime() - now.getTime() <= 30 * DAY_MS,
    };
  };

  const rows = batches.map((b) => row(b.id, b.label, b.createdAt, b.accessDurationMonths, b.activateBefore));
  if (counts.has(null)) rows.push(row(null, "Mã lẻ", null, null, null));

  const since = rangeStart(opts.range, now);
  const redeemed = await db.courseAccessCode.findMany({
    where: {
      courseId,
      redeemedAt: { not: null, ...(since ? { gte: since } : {}) },
      ...(opts.batchId !== undefined ? { batchId: opts.batchId } : {}),
    },
    select: { redeemedAt: true },
  });
  const byWeek = new Map<string, number>();
  let first = since ?? now;
  for (const r of redeemed) {
    const at = r.redeemedAt as Date;
    bump(byWeek, vnWeekKey(at));
    if (!since && at < first) first = at;
  }

  const totals = rows.reduce(
    (a, r) => ({
      total: a.total + r.total,
      redeemed: a.redeemed + r.redeemed,
      unused: a.unused + r.unused,
      revoked: a.revoked + r.revoked,
    }),
    { total: 0, redeemed: 0, unused: 0, revoked: 0 },
  );
  return { batches: rows, weekly: weekSeries(byWeek, first, now), totals };
}

// ---------------------------------------------------------------------------
// AC3 — Doanh thu
// ---------------------------------------------------------------------------

interface MoneyAgg {
  orders: number;
  gross: number;
  refunded: number;
  net: number;
}
const emptyMoney = (): MoneyAgg => ({ orders: 0, gross: 0, refunded: 0, net: 0 });

export interface RevenueCurrencyBlock {
  /** "VND": số tiền là đồng. "USD": số tiền là cent. */
  currency: string;
  totals: MoneyAgg;
  monthly: ({ month: string } & MoneyAgg)[];
  byPlan: ({ plan: string } & MoneyAgg)[];
  byProvider: ({ provider: string } & MoneyAgg)[];
}

export interface RevenueReport {
  currencies: RevenueCurrencyBlock[];
  /** Đơn pending/failed tạo trong khoảng — người bắt đầu thanh toán nhưng chưa xong. */
  incompleteOrders: number;
}

/** Tiền đã hoàn của một đơn: hoàn hết = cả đơn; hoàn một phần = refundedCents. */
function refundedAmount(o: { status: string; amountCents: number; refundedCents: number | null }): number {
  if (o.status === "refunded") return o.refundedCents ?? o.amountCents;
  return o.refundedCents ?? 0;
}

export async function getRevenueReport(
  courseId: string,
  opts: { range: ReportRange; now?: Date },
  db: DbClient = prisma,
): Promise<RevenueReport> {
  const now = opts.now ?? new Date();
  const since = rangeStart(opts.range, now);
  const [orders, incompleteOrders] = await Promise.all([
    db.order.findMany({
      where: { courseId, status: { in: ["paid", "refunded"] } },
      select: {
        amountCents: true,
        currency: true,
        provider: true,
        status: true,
        paidAt: true,
        refundedAt: true,
        refundedCents: true,
        accessPlan: { select: { label: true } },
        accessPlanId: true,
      },
    }),
    db.order.count({
      where: { courseId, status: { in: ["pending", "failed"] }, ...(since ? { createdAt: { gte: since } } : {}) },
    }),
  ]);

  const blocks = new Map<
    string,
    { totals: MoneyAgg; monthly: Map<string, MoneyAgg>; plan: Map<string, MoneyAgg>; provider: Map<string, MoneyAgg> }
  >();
  const block = (cur: string) => {
    let b = blocks.get(cur);
    if (!b) {
      b = { totals: emptyMoney(), monthly: new Map(), plan: new Map(), provider: new Map() };
      blocks.set(cur, b);
    }
    return b;
  };
  const add = (m: Map<string, MoneyAgg>, k: string, f: (a: MoneyAgg) => void) => {
    const a = m.get(k) ?? emptyMoney();
    f(a);
    m.set(k, a);
  };

  for (const o of orders) {
    const cur = o.currency.toUpperCase();
    const b = block(cur);
    const plan = o.accessPlanId ? (o.accessPlan?.label ?? "Gói đã xoá") : "Giá khoá";
    const provider = o.provider === "vnpay" ? "VNPay" : o.provider === "stripe" ? "Thẻ quốc tế" : o.provider;
    if (o.paidAt && (!since || o.paidAt >= since)) {
      const paid = (a: MoneyAgg) => {
        a.orders += 1;
        a.gross += o.amountCents;
      };
      paid(b.totals);
      add(b.monthly, vnMonthKey(o.paidAt), paid);
      add(b.plan, plan, paid);
      add(b.provider, provider, paid);
    }
    const ref = refundedAmount(o);
    const refAt = o.refundedAt ?? (ref > 0 ? o.paidAt : null);
    if (ref > 0 && refAt && (!since || refAt >= since)) {
      const r = (a: MoneyAgg) => {
        a.refunded += ref;
      };
      r(b.totals);
      add(b.monthly, vnMonthKey(refAt), r);
      add(b.plan, plan, r);
      add(b.provider, provider, r);
    }
  }

  const fin = (a: MoneyAgg): MoneyAgg => ({ ...a, net: a.gross - a.refunded });
  const currencies: RevenueCurrencyBlock[] = Array.from(blocks.entries())
    .sort(([a], [b]) => (a === "VND" ? -1 : b === "VND" ? 1 : a.localeCompare(b)))
    .map(([currency, b]) => ({
      currency,
      totals: fin(b.totals),
      monthly: Array.from(b.monthly.entries())
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([month, a]) => ({ month, ...fin(a) })),
      byPlan: Array.from(b.plan.entries()).map(([plan, a]) => ({ plan, ...fin(a) })),
      byProvider: Array.from(b.provider.entries()).map(([provider, a]) => ({ provider, ...fin(a) })),
    }));
  return { currencies, incompleteOrders };
}

function vnDateTime(d: Date | null): string {
  if (!d) return "";
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV đối soát (AC3): mỗi đơn đã thanh toán hoặc đã hoàn một dòng. Không có tên, email hay id người mua.
 * UTF-8 có BOM để Excel đọc đúng tiếng Việt.
 */
export async function exportRevenueCsv(
  courseId: string,
  db: DbClient = prisma,
  now: Date = new Date(),
): Promise<{ csv: string; filename: string }> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { slug: true } });
  const day = new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
  const filename = `doi-soat-${course?.slug ?? "khoa"}-${day}.csv`;
  const orders = await db.order.findMany({
    where: { courseId, status: { in: ["paid", "refunded"] } },
    orderBy: { paidAt: "asc" },
    select: {
      id: true,
      paidAt: true,
      refundedAt: true,
      amountCents: true,
      refundedCents: true,
      currency: true,
      provider: true,
      status: true,
      gatewayTxnRef: true,
      paymentIntentRef: true,
      providerRef: true,
      accessPlanId: true,
      accessPlan: { select: { label: true } },
    },
  });
  const header = [
    "Mã đơn",
    "Ngày thanh toán",
    "Ngày hoàn",
    "Gói",
    "Số tiền",
    "Đã hoàn",
    "Tiền tệ",
    "Cổng",
    "Mã giao dịch của cổng",
    "Trạng thái",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const o of orders) {
    lines.push(
      [
        o.id,
        vnDateTime(o.paidAt),
        vnDateTime(o.refundedAt),
        o.accessPlanId ? (o.accessPlan?.label ?? "Gói đã xoá") : "Giá khoá",
        o.amountCents,
        refundedAmount(o),
        o.currency.toUpperCase(),
        o.provider === "vnpay" ? "VNPay" : o.provider === "stripe" ? "Thẻ quốc tế" : o.provider,
        o.gatewayTxnRef ?? o.paymentIntentRef ?? o.providerRef ?? "",
        o.status === "refunded" ? "Đã hoàn" : o.refundedCents ? "Đã hoàn một phần" : "Đã thanh toán",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return { csv: "﻿" + lines.join("\r\n"), filename };
}

// ---------------------------------------------------------------------------
// AC4 — Người học (ẩn danh)
// ---------------------------------------------------------------------------

export interface LearnerReport {
  enrolled: number;
  bySource: { accessCode: number; directPurchase: number; other: number };
  activeLast30Days: number;
  byStatus: { active: number; completed: number; expired: number; refunded: number; dropped: number };
  weeklyNew: { week: string; count: number }[];
}

export async function getLearnerReport(
  courseId: string,
  opts: { range: ReportRange; now?: Date },
  db: DbClient = prisma,
): Promise<LearnerReport> {
  const now = opts.now ?? new Date();
  const since = rangeStart(opts.range, now);
  const [enrollments, codeUsers, orderUsers] = await Promise.all([
    db.enrollment.findMany({ where: { courseId }, select: { userId: true, status: true, enrolledAt: true } }),
    db.courseAccessCode.findMany({
      where: { courseId, status: "redeemed", redeemedByUserId: { not: null } },
      select: { redeemedByUserId: true },
    }),
    db.order.findMany({ where: { courseId, status: { in: ["paid", "refunded"] } }, select: { userId: true } }),
  ]);
  const enrolledIds = new Set(enrollments.map((e) => e.userId));
  const viaCode = new Set(codeUsers.map((c) => c.redeemedByUserId as string).filter((u) => enrolledIds.has(u)));
  const viaOrder = new Set(orderUsers.map((o) => o.userId).filter((u) => enrolledIds.has(u)));
  let other = 0;
  for (const u of enrolledIds) if (!viaCode.has(u) && !viaOrder.has(u)) other += 1;

  const byStatus = { active: 0, completed: 0, expired: 0, refunded: 0, dropped: 0 };
  const byWeek = new Map<string, number>();
  let first = since ?? now;
  for (const e of enrollments) {
    byStatus[e.status] += 1;
    if (!since || e.enrolledAt >= since) {
      bump(byWeek, vnWeekKey(e.enrolledAt));
      if (!since && e.enrolledAt < first) first = e.enrolledAt;
    }
  }

  // "Đang học" = có hoạt động học trong 30 ngày. Ngoài các namespace do giáo viên/hệ thống tạo
  // (learnerActivityWhere), bỏ cả `enrollment.*`: ghi danh hay gia hạn chưa phải là học.
  const base = learnerActivityWhere();
  const activeRows = enrolledIds.size
    ? await db.learningEvent.groupBy({
        by: ["userId"],
        where: {
          courseId,
          occurredAt: { gte: new Date(now.getTime() - 30 * DAY_MS) },
          userId: { in: Array.from(enrolledIds) },
          NOT: [...(Array.isArray(base.NOT) ? base.NOT : base.NOT ? [base.NOT] : []), { eventType: { startsWith: "enrollment." } }],
        },
      })
    : [];

  return {
    enrolled: enrolledIds.size,
    bySource: { accessCode: viaCode.size, directPurchase: viaOrder.size, other },
    activeLast30Days: activeRows.length,
    byStatus,
    weeklyNew: weekSeries(byWeek, first, now),
  };
}

// ---------------------------------------------------------------------------
// AC5 — Mức nắm vững theo bài
// ---------------------------------------------------------------------------

export interface MasteryLessonRow {
  lessonId: string;
  title: string;
  moduleTitle: string;
  insufficient: boolean;
  /** Chỉ có khi đủ REPORT_MIN_GROUP người. Phần trăm làm tròn, tổng có thể lệch 1 do làm tròn. */
  learners?: number;
  reviewPct?: number;
  practicePct?: number;
  solidPct?: number;
  /** Bài có tỉ lệ "Cần ôn" cao nhất trong khoá (chỉ xét bài đủ dữ liệu). */
  mostNeedsReview?: boolean;
}

export type MasteryReport = { enabled: false } | { enabled: true; lessons: MasteryLessonRow[] };

async function courseLessons(courseId: string, db: DbClient) {
  const modules = await db.module.findMany({
    where: { courseId, isHidden: false },
    orderBy: { orderIndex: "asc" },
    select: {
      title: true,
      lessons: { where: { isHidden: false }, orderBy: { orderIndex: "asc" }, select: { id: true, title: true } },
    },
  });
  return modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
}

export async function getMasteryByLesson(courseId: string, db: DbClient = prisma): Promise<MasteryReport> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { personalizationEnabled: true } });
  if (!course?.personalizationEnabled) return { enabled: false };

  const lessons = await courseLessons(courseId, db);
  const skills = await db.skill.findMany({
    where: { code: { in: lessons.map((l) => lessonSkillCode(l.id)) } },
    select: { id: true, code: true },
  });
  const skillByCode = new Map(skills.map((s) => [s.code, s.id]));
  const enrolled = await enrolledUserIds(courseId, db);
  const states = skills.length && enrolled.size
    ? await db.learnerSkillState.findMany({
        where: { skillId: { in: skills.map((s) => s.id) }, userId: { in: Array.from(enrolled) } },
        select: { skillId: true, masteryProbability: true },
      })
    : [];
  const bySkill = new Map<string, number[]>();
  for (const s of states) {
    const arr = bySkill.get(s.skillId) ?? [];
    arr.push(s.masteryProbability);
    bySkill.set(s.skillId, arr);
  }

  const rows: MasteryLessonRow[] = lessons.map((l) => {
    const skillId = skillByCode.get(lessonSkillCode(l.id));
    const values = (skillId && bySkill.get(skillId)) || [];
    const base = { lessonId: l.id, title: l.title, moduleTitle: l.moduleTitle };
    if (values.length < REPORT_MIN_GROUP) return { ...base, insufficient: true };
    let review = 0;
    let solid = 0;
    for (const v of values) {
      if (v < MASTERY_REVIEW_BELOW) review += 1;
      else if (v >= MASTERY_SOLID_AT) solid += 1;
    }
    const n = values.length;
    const practice = n - review - solid;
    return {
      ...base,
      insufficient: false,
      learners: n,
      reviewPct: Math.round((review / n) * 100),
      practicePct: Math.round((practice / n) * 100),
      solidPct: Math.round((solid / n) * 100),
    };
  });

  let top: MasteryLessonRow | null = null;
  for (const r of rows) if (!r.insufficient && (r.reviewPct ?? 0) > 0 && (!top || (r.reviewPct ?? 0) > (top.reviewPct ?? 0))) top = r;
  if (top) top.mostNeedsReview = true;
  return { enabled: true, lessons: rows };
}

// ---------------------------------------------------------------------------
// AC6 — Câu hỏi bị sai nhiều
// ---------------------------------------------------------------------------

export interface HardQuestionRow {
  questionId: string;
  prompt: string;
  /** Số người (= số lượt đầu) đã trả lời. */
  responses: number;
  correctPct: number;
  topWrongOption: { label: string; chosenPct: number; misconception: string | null } | null;
}

export interface HardQuestionsQuiz {
  quizId: string;
  quizTitle: string;
  lessonTitle: string;
  questions: HardQuestionRow[];
}

/** Ngưỡng của AC6: đủ lượt theo phân tích câu hỏi và đủ k người. */
export const HARD_QUESTION_MIN_RESPONSES = Math.max(ITEM_ANALYTICS_MIN_ATTEMPTS, REPORT_MIN_GROUP);

function plainText(html: string, max = 160): string {
  const t = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export async function getHardestQuestions(courseId: string, db: DbClient = prisma): Promise<HardQuestionsQuiz[]> {
  const lessons = await courseLessons(courseId, db);
  const lessonTitle = new Map(lessons.map((l) => [l.id, l.title]));
  const quizzes = await db.quiz.findMany({
    where: { lessonId: { in: lessons.map((l) => l.id) } },
    select: { id: true, title: true, lessonId: true },
  });
  if (!quizzes.length) return [];
  const enrolled = await enrolledUserIds(courseId, db);

  // Lượt nộp ĐẦU TIÊN của mỗi học viên cho mỗi quiz.
  const attempts = await db.quizAttempt.findMany({
    where: { quizId: { in: quizzes.map((q) => q.id) }, status: "submitted" },
    orderBy: [{ submittedAt: "asc" }, { startedAt: "asc" }],
    select: { id: true, userId: true, quizId: true },
  });
  const seen = new Set<string>();
  const firstIds: string[] = [];
  for (const a of attempts) {
    if (!enrolled.has(a.userId)) continue;
    const k = `${a.userId}:${a.quizId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    firstIds.push(a.id);
  }
  if (!firstIds.length) return [];

  const [responses, questions] = await Promise.all([
    db.answerResponse.findMany({
      where: { attemptId: { in: firstIds }, needsGrading: false },
      select: { questionId: true, isCorrect: true, response: true },
    }),
    db.quizQuestion.findMany({
      where: { quizId: { in: quizzes.map((q) => q.id) } },
      select: {
        id: true,
        quizId: true,
        prompt: true,
        options: { select: { id: true, label: true, isCorrect: true, misconceptionId: true } },
      },
    }),
  ]);
  const misconceptionIds = Array.from(
    new Set(questions.flatMap((q) => q.options.map((o) => o.misconceptionId)).filter((x): x is string => !!x)),
  );
  const misconceptions = misconceptionIds.length
    ? await db.misconception.findMany({ where: { id: { in: misconceptionIds } }, select: { id: true, name: true } })
    : [];
  const misName = new Map(misconceptions.map((m) => [m.id, m.name]));

  const stats = new Map<string, { n: number; correct: number; wrong: Map<string, number> }>();
  for (const r of responses) {
    const s = stats.get(r.questionId) ?? { n: 0, correct: 0, wrong: new Map<string, number>() };
    s.n += 1;
    if (r.isCorrect) s.correct += 1;
    else if (Array.isArray(r.response)) {
      for (const id of r.response) if (typeof id === "string") bump(s.wrong, id);
    }
    stats.set(r.questionId, s);
  }

  const out: HardQuestionsQuiz[] = [];
  for (const quiz of quizzes) {
    const rows: HardQuestionRow[] = [];
    for (const q of questions.filter((x) => x.quizId === quiz.id)) {
      const s = stats.get(q.id);
      if (!s || s.n < HARD_QUESTION_MIN_RESPONSES) continue;
      let top: HardQuestionRow["topWrongOption"] = null;
      let topCount = 0;
      for (const o of q.options) {
        if (o.isCorrect) continue;
        const c = s.wrong.get(o.id) ?? 0;
        if (c > topCount) {
          topCount = c;
          top = {
            label: plainText(o.label, 100),
            chosenPct: Math.round((c / s.n) * 100),
            misconception: o.misconceptionId ? (misName.get(o.misconceptionId) ?? null) : null,
          };
        }
      }
      rows.push({
        questionId: q.id,
        prompt: plainText(q.prompt),
        responses: s.n,
        correctPct: Math.round((s.correct / s.n) * 100),
        topWrongOption: top,
      });
    }
    rows.sort((a, b) => a.correctPct - b.correctPct);
    if (rows.length) {
      out.push({
        quizId: quiz.id,
        quizTitle: quiz.title,
        lessonTitle: (quiz.lessonId && lessonTitle.get(quiz.lessonId)) || "",
        questions: rows.slice(0, 5),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// AC7 — Mức dùng phản hồi (bấm "bài nên xem lại" sau khi làm sai)
// ---------------------------------------------------------------------------

export interface RemediationMonthRow {
  month: string;
  insufficient: boolean;
  deliveries?: number;
  clicked?: number;
  clickRatePct?: number;
}

export async function getRemediationUptake(
  courseId: string,
  opts: { range: ReportRange; now?: Date },
  db: DbClient = prisma,
): Promise<RemediationMonthRow[]> {
  const now = opts.now ?? new Date();
  const since = rangeStart(opts.range, now);
  const lessons = await courseLessons(courseId, db);
  const quizzes = await db.quiz.findMany({ where: { lessonId: { in: lessons.map((l) => l.id) } }, select: { id: true } });
  if (!quizzes.length) return [];
  const attempts = await db.quizAttempt.findMany({
    where: { quizId: { in: quizzes.map((q) => q.id) } },
    select: { id: true },
  });
  if (!attempts.length) return [];

  const deliveries = (
    await db.feedbackDelivery.findMany({
      where: { attemptId: { in: attempts.map((a) => a.id) }, ...(since ? { deliveredAt: { gte: since } } : {}) },
      select: { id: true, userId: true, deliveredAt: true, remediationLessonIds: true },
    })
  ).filter((d) => Array.isArray(d.remediationLessonIds) && d.remediationLessonIds.length > 0);
  if (!deliveries.length) return [];

  const clicks = await db.learningEvent.findMany({
    where: {
      eventType: LearningEventType.FeedbackRemediationClicked,
      courseId,
      ...(since ? { occurredAt: { gte: since } } : {}),
    },
    select: { payload: true },
  });
  const clickedIds = new Set<string>();
  for (const c of clicks) {
    const id = (c.payload as { deliveryId?: unknown } | null)?.deliveryId;
    if (typeof id === "string") clickedIds.add(id);
  }

  const months = new Map<string, { deliveries: number; clicked: number; users: Set<string> }>();
  for (const d of deliveries) {
    const key = vnMonthKey(d.deliveredAt);
    const m = months.get(key) ?? { deliveries: 0, clicked: 0, users: new Set<string>() };
    m.deliveries += 1;
    if (clickedIds.has(d.id)) m.clicked += 1;
    m.users.add(d.userId);
    months.set(key, m);
  }
  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) =>
      m.users.size < REPORT_MIN_GROUP
        ? { month, insufficient: true }
        : {
            month,
            insufficient: false,
            deliveries: m.deliveries,
            clicked: m.clicked,
            clickRatePct: Math.round((m.clicked / m.deliveries) * 100),
          },
    );
}

// ---------------------------------------------------------------------------
// Sự kiện
// ---------------------------------------------------------------------------

/** Mở trang báo cáo: tối đa một sự kiện mỗi người, mỗi khoá, mỗi ngày (giờ VN). */
export async function recordReportViewed(userId: string, courseId: string, db: DbClient = prisma): Promise<void> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  const day = new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10);
  await emitEvent(
    userId,
    LearningEventType.ReportPublisherViewed,
    { organizationId: course?.organizationId ?? null, courseId },
    { courseId, eventKey: `report.publisher.viewed:${userId}:${courseId}:${day}` },
    db,
  );
}

export async function recordReportExported(
  userId: string,
  courseId: string,
  kind: "revenue_csv",
  db: DbClient = prisma,
): Promise<void> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  await emitEvent(
    userId,
    LearningEventType.ReportPublisherExported,
    { organizationId: course?.organizationId ?? null, courseId, kind },
    { courseId, eventKey: `report.publisher.exported:${userId}:${courseId}:${Date.now()}` },
    db,
  );
}
