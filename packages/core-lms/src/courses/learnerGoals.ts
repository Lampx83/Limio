/**
 * CENTER C6 — mục tiêu học tập (docs/CENTER-schedule-attendance-AC.md, C6.1, C6.2, C6.4, C6.6, C6.7).
 *
 * - `LearnerGoal`: mục tiêu của từng học viên ("HSK 3 trước 30/06/2027, 4 giờ/tuần"). Học viên tự đặt hoặc giáo viên đặt
 *   hộ. Mỗi học viên một mục tiêu đang theo đuổi cho mỗi khoá (và một mục tiêu chung không gắn khoá).
 * - `SectionGoal`: mục tiêu của lớp, giáo viên quản khoá đặt một lần; học viên thấy là gợi ý và bấm "Dùng mục tiêu này".
 * - Mọi thay đổi phát event `goal.*` mang giá trị cũ/mới (lịch sử), không ghi đè âm thầm.
 * - Riêng tư: chỉ chính học viên, người quản khoá và giáo viên được xếp vào lớp của học viên xem được. Mục tiêu chung
 *   (không gắn khoá) chỉ chủ nhân xem.
 *
 * Việc nhận định tiến độ ("đúng kế hoạch / chậm / vượt") thuộc core-feedback; module này chỉ giữ dữ liệu và quyền.
 */
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import {
  GOAL_FRAMEWORKS,
  GOAL_HOURS_PER_WEEK_MAX,
  GOAL_HOURS_PER_WEEK_MIN,
  GOAL_MAX_YEARS_AHEAD,
  LearningEventType,
  isValidGoalLevel,
  type GoalFramework,
} from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { emitEvent } from "../learning/events";
import { CourseAuthzError } from "./authz";
import { assertCanManageCourse, assertCanViewSection, getTeachingScope, isAssignedToSection } from "./teachingScope";

export class GoalError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "goal_not_found"
      | "goal_exists"
      | "goal_not_active"
      | "not_enrolled"
      | "no_section_goal"
      | "section_not_found",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

const COUNTED_ENROLLMENT = ["active", "completed"] as const;

export type GoalStatusValue = "active" | "achieved" | "archived";

export interface GoalView {
  id: string;
  userId: string;
  courseId: string | null;
  framework: GoalFramework;
  targetLevel: string;
  /** YYYY-MM-DD (giờ VN). */
  targetDate: string;
  hoursPerWeek: number | null;
  status: GoalStatusValue;
  setById: string;
  createdAt: string;
  updatedAt: string;
}

export interface SectionGoalView {
  sectionId: string;
  framework: GoalFramework;
  targetLevel: string;
  targetDate: string | null;
  hoursPerWeek: number | null;
  setById: string;
  updatedAt: string;
}

// ── Ngày giờ VN ──────────────────────────────────────────────────────────

const VN_OFFSET_MS = 7 * 3600_000;

/** Ngày hôm nay theo giờ VN, dạng YYYY-MM-DD. */
export function vnToday(now: Date): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

function isRealDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(`${d}T00:00:00.000Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

function addYears(day: string, years: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

const dayOf = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

// ── Kiểm giá trị ─────────────────────────────────────────────────────────

const FrameworkEnum = z.enum(GOAL_FRAMEWORKS);

const GoalFields = z.object({
  framework: FrameworkEnum,
  targetLevel: z.string().trim().min(1).max(80),
  targetDate: z.string(),
  hoursPerWeek: z.number().finite().min(GOAL_HOURS_PER_WEEK_MIN).max(GOAL_HOURS_PER_WEEK_MAX).nullish(),
});

const SetInput = GoalFields.extend({
  userId: z.string().min(1).optional(),
  courseId: z.string().min(1).nullish(),
});

function bad(details?: unknown): never {
  throw new GoalError("validation_failed", details);
}

/** Hạn phải sau hôm nay (giờ VN) và trong GOAL_MAX_YEARS_AHEAD năm. */
function assertFutureDate(day: string, now: Date) {
  const today = vnToday(now);
  if (!isRealDate(day)) bad("target_date_invalid");
  if (day <= today) bad("target_date_not_future");
  if (day > addYears(today, GOAL_MAX_YEARS_AHEAD)) bad("target_date_too_far");
}

function assertLevel(framework: GoalFramework, level: string) {
  if (!isValidGoalLevel(framework, level)) bad("target_level_invalid");
}

function toView(g: {
  id: string; userId: string; courseId: string | null; framework: GoalFramework; targetLevel: string; targetDate: Date;
  hoursPerWeek: number | null; status: GoalStatusValue; setById: string; createdAt: Date; updatedAt: Date;
}): GoalView {
  return {
    id: g.id, userId: g.userId, courseId: g.courseId, framework: g.framework, targetLevel: g.targetLevel,
    targetDate: dayOf(g.targetDate), hoursPerWeek: g.hoursPerWeek, status: g.status, setById: g.setById,
    createdAt: g.createdAt.toISOString(), updatedAt: g.updatedAt.toISOString(),
  };
}

function toSectionView(g: {
  sectionId: string; framework: GoalFramework; targetLevel: string; targetDate: Date | null; hoursPerWeek: number | null;
  setById: string; updatedAt: Date;
}): SectionGoalView {
  return {
    sectionId: g.sectionId, framework: g.framework, targetLevel: g.targetLevel,
    targetDate: g.targetDate ? dayOf(g.targetDate) : null, hoursPerWeek: g.hoursPerWeek, setById: g.setById,
    updatedAt: g.updatedAt.toISOString(),
  };
}

// ── Quyền ────────────────────────────────────────────────────────────────

/** Giáo viên của học viên trong khoá: người quản khoá, hoặc người chỉ dạy được xếp vào lớp của học viên. */
async function assertTeacherOfLearner(actor: string, learnerId: string, courseId: string, db: DbClient): Promise<void> {
  const scope = await getTeachingScope(actor, courseId, db);
  if (scope === "manage") return;
  if (scope === "teach") {
    const enr = await db.enrollment.findFirst({
      where: { userId: learnerId, courseId, status: { in: [...COUNTED_ENROLLMENT] } },
      select: { section: { select: { id: true, instructorId: true } } },
    });
    if (enr?.section && (await isAssignedToSection(actor, enr.section, db))) return;
  }
  const exists = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
  throw new CourseAuthzError(exists ? "forbidden" : "not_found");
}

/** Xem/sửa một mục tiêu: chủ nhân luôn được; giáo viên chỉ với mục tiêu gắn khoá của học viên mình dạy. */
async function assertCanActOnGoal(actor: string, goal: { userId: string; courseId: string | null }, db: DbClient) {
  if (actor === goal.userId) return;
  if (!goal.courseId) throw new CourseAuthzError("forbidden");
  await assertTeacherOfLearner(actor, goal.userId, goal.courseId, db);
}

async function isEnrolled(userId: string, courseId: string, db: DbClient): Promise<boolean> {
  return (
    (await db.enrollment.findFirst({
      where: { userId, courseId, status: { in: [...COUNTED_ENROLLMENT] } },
      select: { id: true },
    })) != null
  );
}

async function loadGoal(goalId: string, db: DbClient) {
  const g = await db.learnerGoal.findUnique({ where: { id: goalId } });
  if (!g) throw new GoalError("goal_not_found");
  return g;
}

async function hasActiveGoal(userId: string, courseId: string | null, exceptId: string | null, db: DbClient) {
  return (
    (await db.learnerGoal.findFirst({
      where: { userId, courseId, status: "active", ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    })) != null
  );
}

// ── Đặt mục tiêu (C6.1, C6.2) ────────────────────────────────────────────

async function createGoal(
  actor: string,
  userId: string,
  courseId: string | null,
  fields: z.infer<typeof GoalFields>,
  fromSection: boolean,
  now: Date,
  db: DbClient,
): Promise<GoalView> {
  assertLevel(fields.framework, fields.targetLevel);
  assertFutureDate(fields.targetDate, now);

  if (actor !== userId) {
    // Đặt hộ: phải gắn một khoá mà người đặt dạy.
    if (!courseId) bad("course_required_for_teacher");
    await assertTeacherOfLearner(actor, userId, courseId, db);
  }
  if (courseId && !(await isEnrolled(userId, courseId, db))) throw new GoalError("not_enrolled");
  if (await hasActiveGoal(userId, courseId, null, db)) throw new GoalError("goal_exists");

  const row = await db.learnerGoal.create({
    data: {
      userId,
      courseId,
      framework: fields.framework,
      targetLevel: fields.targetLevel.trim(),
      targetDate: toDate(fields.targetDate),
      hoursPerWeek: fields.hoursPerWeek ?? null,
      setById: actor,
    },
  });
  await emitEvent(
    userId,
    LearningEventType.GoalSet,
    {
      goalId: row.id,
      courseId,
      framework: row.framework,
      targetLevel: row.targetLevel,
      targetDate: fields.targetDate,
      hoursPerWeek: row.hoursPerWeek,
      setById: actor,
      fromSection,
    },
    { courseId },
    db,
  );
  return toView(row);
}

/**
 * Đặt mục tiêu. `input.userId` bỏ trống = chính người gọi. Giáo viên đặt hộ phải kèm `courseId` và là giáo viên của
 * học viên trong khoá đó.
 */
export async function setGoal(actorUserId: string, rawInput: unknown, now: Date = new Date(), db: DbClient = prisma): Promise<GoalView> {
  const parsed = SetInput.safeParse(rawInput);
  if (!parsed.success) bad(parsed.error.flatten());
  const { userId, courseId, ...fields } = parsed.data;
  return createGoal(actorUserId, userId ?? actorUserId, courseId ?? null, fields, false, now, db);
}

// ── Đổi mục tiêu và trạng thái (C6.7) ────────────────────────────────────

const PatchInput = z
  .object({
    framework: FrameworkEnum.optional(),
    targetLevel: z.string().trim().min(1).max(80).optional(),
    targetDate: z.string().optional(),
    hoursPerWeek: z.number().finite().min(GOAL_HOURS_PER_WEEK_MIN).max(GOAL_HOURS_PER_WEEK_MAX).nullable().optional(),
  })
  .strict();

type Changes = Record<string, { from: string | number | null; to: string | number | null }>;

export async function changeGoal(actorUserId: string, goalId: string, rawPatch: unknown, now: Date = new Date(), db: DbClient = prisma): Promise<GoalView> {
  const goal = await loadGoal(goalId, db);
  await assertCanActOnGoal(actorUserId, goal, db);
  if (goal.status !== "active") throw new GoalError("goal_not_active");
  const parsed = PatchInput.safeParse(rawPatch);
  if (!parsed.success) bad(parsed.error.flatten());
  const patch = parsed.data;

  const next = {
    framework: patch.framework ?? goal.framework,
    targetLevel: patch.targetLevel ?? goal.targetLevel,
    targetDate: patch.targetDate ?? dayOf(goal.targetDate),
    hoursPerWeek: patch.hoursPerWeek === undefined ? goal.hoursPerWeek : patch.hoursPerWeek,
  };
  assertLevel(next.framework, next.targetLevel);
  // Chỉ kiểm hạn khi người dùng đổi hạn: mục tiêu cũ sắp đến hạn vẫn đổi được số giờ.
  if (patch.targetDate !== undefined && patch.targetDate !== dayOf(goal.targetDate)) assertFutureDate(next.targetDate, now);

  const changes: Changes = {};
  if (next.framework !== goal.framework) changes.framework = { from: goal.framework, to: next.framework };
  if (next.targetLevel.trim() !== goal.targetLevel) changes.targetLevel = { from: goal.targetLevel, to: next.targetLevel.trim() };
  if (next.targetDate !== dayOf(goal.targetDate)) changes.targetDate = { from: dayOf(goal.targetDate), to: next.targetDate };
  if (next.hoursPerWeek !== goal.hoursPerWeek) changes.hoursPerWeek = { from: goal.hoursPerWeek, to: next.hoursPerWeek };
  if (Object.keys(changes).length === 0) return toView(goal);

  const row = await db.learnerGoal.update({
    where: { id: goalId },
    data: {
      framework: next.framework,
      targetLevel: next.targetLevel.trim(),
      targetDate: toDate(next.targetDate),
      hoursPerWeek: next.hoursPerWeek,
    },
  });
  await emitEvent(
    goal.userId,
    LearningEventType.GoalChanged,
    { goalId, changedById: actorUserId, changes },
    { courseId: goal.courseId },
    db,
  );
  return toView(row);
}

export async function setGoalStatus(actorUserId: string, goalId: string, to: GoalStatusValue, db: DbClient = prisma): Promise<GoalView> {
  const goal = await loadGoal(goalId, db);
  await assertCanActOnGoal(actorUserId, goal, db);
  if (!["active", "achieved", "archived"].includes(to)) bad("status_invalid");
  if (goal.status === to) return toView(goal);
  if (to === "active" && (await hasActiveGoal(goal.userId, goal.courseId, goal.id, db))) throw new GoalError("goal_exists");

  const row = await db.learnerGoal.update({ where: { id: goalId }, data: { status: to } });
  await emitEvent(
    goal.userId,
    LearningEventType.GoalStatusChanged,
    { goalId, changedById: actorUserId, from: goal.status, to },
    { courseId: goal.courseId },
    db,
  );
  return toView(row);
}

export interface GoalHistoryItem {
  at: string;
  kind: "set" | "changed" | "status_changed";
  byId: string | null;
  changes?: Changes;
  from?: string;
  to?: string;
}

/** Lịch sử một mục tiêu, dựng từ các event goal.* (append-only). */
export async function getGoalHistory(actorUserId: string, goalId: string, db: DbClient = prisma): Promise<GoalHistoryItem[]> {
  const goal = await loadGoal(goalId, db);
  await assertCanActOnGoal(actorUserId, goal, db);
  const events = await db.learningEvent.findMany({
    where: {
      userId: goal.userId,
      eventType: { in: [LearningEventType.GoalSet, LearningEventType.GoalChanged, LearningEventType.GoalStatusChanged] },
      payload: { path: ["goalId"], equals: goalId },
    },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
  });
  return events.map((e) => {
    const p = e.payload as Record<string, unknown>;
    if (e.eventType === LearningEventType.GoalSet) return { at: e.occurredAt.toISOString(), kind: "set" as const, byId: (p.setById as string) ?? null };
    if (e.eventType === LearningEventType.GoalChanged) {
      return { at: e.occurredAt.toISOString(), kind: "changed" as const, byId: (p.changedById as string) ?? null, changes: p.changes as Changes };
    }
    return { at: e.occurredAt.toISOString(), kind: "status_changed" as const, byId: (p.changedById as string) ?? null, from: p.from as string, to: p.to as string };
  });
}

// ── Đọc (C6.6) ───────────────────────────────────────────────────────────

/** Mục tiêu của chính mình (mặc định chỉ đang theo đuổi). */
export async function listMyGoals(userId: string, opts: { includeInactive?: boolean } = {}, db: DbClient = prisma): Promise<GoalView[]> {
  const rows = await db.learnerGoal.findMany({
    where: { userId, ...(opts.includeInactive ? {} : { status: "active" }) },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toView);
}

/** Mục tiêu của một học viên trong một khoá, cho giáo viên (hoặc chính học viên). */
export async function listLearnerGoals(
  actorUserId: string,
  learnerId: string,
  courseId: string,
  opts: { includeInactive?: boolean } = {},
  db: DbClient = prisma,
): Promise<GoalView[]> {
  if (actorUserId !== learnerId) await assertTeacherOfLearner(actorUserId, learnerId, courseId, db);
  const rows = await db.learnerGoal.findMany({
    where: { userId: learnerId, courseId, ...(opts.includeInactive ? {} : { status: "active" }) },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toView);
}

// ── Mục tiêu của lớp (C6.4) ──────────────────────────────────────────────

const SectionGoalInput = z.object({
  framework: FrameworkEnum,
  targetLevel: z.string().trim().min(1).max(80),
  targetDate: z.string().nullish(),
  hoursPerWeek: z.number().finite().min(GOAL_HOURS_PER_WEEK_MIN).max(GOAL_HOURS_PER_WEEK_MAX).nullish(),
});

async function loadSection(sectionId: string, db: DbClient) {
  const s = await db.courseSection.findUnique({ where: { id: sectionId }, select: { id: true, courseId: true, instructorId: true } });
  if (!s) throw new GoalError("section_not_found");
  return s;
}

/** Đặt (hoặc bỏ, khi `input = null`) mục tiêu của lớp. Chỉ người quản khoá. */
export async function setSectionGoal(
  actorUserId: string,
  sectionId: string,
  rawInput: unknown,
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<SectionGoalView | null> {
  const section = await loadSection(sectionId, db);
  await assertCanManageCourse(actorUserId, section.courseId, db);

  if (rawInput === null) {
    await db.sectionGoal.deleteMany({ where: { sectionId } });
    await emitEvent(actorUserId, LearningEventType.GoalSectionSet, { sectionId, courseId: section.courseId, framework: null, targetLevel: null, targetDate: null }, { courseId: section.courseId }, db);
    return null;
  }
  const parsed = SectionGoalInput.safeParse(rawInput);
  if (!parsed.success) bad(parsed.error.flatten());
  const input = parsed.data;
  assertLevel(input.framework, input.targetLevel);
  if (input.targetDate) assertFutureDate(input.targetDate, now);

  const row = await db.sectionGoal.upsert({
    where: { sectionId },
    create: {
      sectionId, framework: input.framework, targetLevel: input.targetLevel.trim(),
      targetDate: input.targetDate ? toDate(input.targetDate) : null, hoursPerWeek: input.hoursPerWeek ?? null, setById: actorUserId,
    },
    update: {
      framework: input.framework, targetLevel: input.targetLevel.trim(),
      targetDate: input.targetDate ? toDate(input.targetDate) : null, hoursPerWeek: input.hoursPerWeek ?? null, setById: actorUserId,
    },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.GoalSectionSet,
    { sectionId, courseId: section.courseId, framework: row.framework, targetLevel: row.targetLevel, targetDate: input.targetDate ?? null },
    { courseId: section.courseId },
    db,
  );
  return toSectionView(row);
}

/** Mục tiêu của lớp, cho giáo viên được xếp vào lớp hoặc học viên đang học ở lớp đó. */
export async function getSectionGoal(actorUserId: string, sectionId: string, db: DbClient = prisma): Promise<SectionGoalView | null> {
  const section = await loadSection(sectionId, db);
  const enrolled = await db.enrollment.findFirst({ where: { userId: actorUserId, sectionId, status: { in: [...COUNTED_ENROLLMENT] } }, select: { id: true } });
  if (!enrolled) await assertCanViewSection(actorUserId, section, db);
  const row = await db.sectionGoal.findUnique({ where: { sectionId } });
  return row ? toSectionView(row) : null;
}

export interface EffectiveGoal {
  source: "personal" | "section" | "none";
  goal: {
    id: string | null;
    framework: GoalFramework;
    targetLevel: string;
    targetDate: string | null;
    hoursPerWeek: number | null;
    /** Mốc bắt đầu tính giờ thực tế: lúc đặt mục tiêu riêng, hoặc lúc cập nhật mục tiêu lớp / vào lớp (muộn hơn). */
    startedAt: string;
  } | null;
}

/** Mục tiêu hiệu lực của học viên trong một khoá: mục tiêu riêng đang theo đuổi, nếu không có thì mục tiêu của lớp. */
export async function getEffectiveGoal(userId: string, courseId: string, db: DbClient = prisma): Promise<EffectiveGoal> {
  const mine = await db.learnerGoal.findFirst({ where: { userId, courseId, status: "active" }, orderBy: { createdAt: "desc" } });
  if (mine) {
    return { source: "personal", goal: { id: mine.id, framework: mine.framework, targetLevel: mine.targetLevel, targetDate: dayOf(mine.targetDate), hoursPerWeek: mine.hoursPerWeek, startedAt: mine.createdAt.toISOString() } };
  }
  const enr = await db.enrollment.findFirst({
    where: { userId, courseId, status: { in: [...COUNTED_ENROLLMENT] } },
    select: { sectionId: true, enrolledAt: true },
  });
  const sg = enr?.sectionId ? await db.sectionGoal.findUnique({ where: { sectionId: enr.sectionId } }) : null;
  if (!sg) return { source: "none", goal: null };
  const started = enr && enr.enrolledAt > sg.updatedAt ? enr.enrolledAt : sg.updatedAt;
  return { source: "section", goal: { id: null, framework: sg.framework, targetLevel: sg.targetLevel, targetDate: sg.targetDate ? dayOf(sg.targetDate) : null, hoursPerWeek: sg.hoursPerWeek, startedAt: started.toISOString() } };
}

/** Học viên bấm "Dùng mục tiêu này": chép mục tiêu lớp thành mục tiêu riêng (người đặt là chính học viên). */
export async function adoptSectionGoal(
  userId: string,
  courseId: string,
  opts: { targetDate?: string; hoursPerWeek?: number | null } = {},
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<GoalView> {
  const enr = await db.enrollment.findFirst({ where: { userId, courseId, status: { in: [...COUNTED_ENROLLMENT] } }, select: { sectionId: true } });
  if (!enr) throw new GoalError("not_enrolled");
  const sg = enr.sectionId ? await db.sectionGoal.findUnique({ where: { sectionId: enr.sectionId } }) : null;
  if (!sg) throw new GoalError("no_section_goal");
  const targetDate = opts.targetDate ?? (sg.targetDate ? dayOf(sg.targetDate) : null);
  if (!targetDate) bad("target_date_required");
  return createGoal(
    userId, userId, courseId,
    { framework: sg.framework, targetLevel: sg.targetLevel, targetDate, hoursPerWeek: opts.hoursPerWeek !== undefined ? opts.hoursPerWeek : sg.hoursPerWeek },
    true, now, db,
  );
}

export interface SectionLearnerGoalRow {
  userId: string;
  displayName: string;
  goal: GoalView | null;
}

/** Cho giáo viên: từng học viên của lớp kèm mục tiêu riêng đang theo đuổi (nếu có). */
export async function listSectionLearnerGoals(actorUserId: string, sectionId: string, db: DbClient = prisma): Promise<SectionLearnerGoalRow[]> {
  const section = await loadSection(sectionId, db);
  await assertCanViewSection(actorUserId, section, db);
  const enrollments = await db.enrollment.findMany({
    where: { sectionId, status: { in: [...COUNTED_ENROLLMENT] } },
    select: { user: { select: { id: true, displayName: true } } },
  });
  const ids = [...new Set(enrollments.map((e) => e.user.id))];
  const goals = await db.learnerGoal.findMany({ where: { userId: { in: ids }, courseId: section.courseId, status: "active" } });
  const byUser = new Map(goals.map((g) => [g.userId, g]));
  const seen = new Set<string>();
  const rows: SectionLearnerGoalRow[] = [];
  for (const { user } of enrollments) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    const g = byUser.get(user.id);
    rows.push({ userId: user.id, displayName: user.displayName, goal: g ? toView(g) : null });
  }
  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
}
