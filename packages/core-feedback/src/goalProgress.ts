/**
 * CENTER C6.3 — tiến độ của học viên so với mục tiêu (docs/CENTER-schedule-attendance-AC.md, mục C6).
 *
 * Chỉ ĐỌC, và chỉ GỢI Ý: không phán xét. Hai phần:
 *  - Tiến độ theo kỹ năng bằng NHÃN Cần ôn / Nên luyện / Vững (khoá ngoại ngữ: dùng hồ sơ 4 kỹ năng; khoá thường: một
 *    nhãn tổng và số bài đã luyện). Học viên không bao giờ nhận số mastery.
 *  - Nhận định "đúng kế hoạch / chậm / vượt", tính khi đọc từ số tuần còn lại và số giờ học thật (event `lesson.engaged`),
 *    để đổi quy tắc không phải sửa dữ liệu.
 *
 * Quyền xem tiến độ của người khác do tầng gọi kiểm (apps/web), vì core-feedback không import core-lms (CLAUDE.md §4.3).
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import {
  GOAL_PACE_AHEAD_AT,
  GOAL_PACE_BEHIND_BELOW,
  LearningEventType,
  lessonSkillCode,
  masteryLabel,
  type GoalPaceStatus,
  type MasteryLabel,
} from "@feedbackme/shared-types";
import { LANGUAGE_PROFILE_MIN_EVIDENCE, getLanguageProfile, type LanguageSkillRow, type ProfileAudience } from "./languageProfile";
import { resolveFeedbackVariant } from "./variant";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const VN_OFFSET_MS = 7 * 3600_000;

/** Phần của mục tiêu mà việc nhận định cần (khớp cả mục tiêu riêng lẫn mục tiêu lớp). */
export interface GoalForProgress {
  framework: string;
  targetLevel: string;
  /** YYYY-MM-DD; null = mục tiêu lớp chưa có hạn. */
  targetDate: string | null;
  hoursPerWeek: number | null;
  /** Mốc bắt đầu tính giờ thực tế (ISO). */
  startedAt: string;
}

export interface PaceAssessment {
  status: GoalPaceStatus;
  /** Giờ kỳ vọng tới nay theo kế hoạch; null khi chưa đặt số giờ/tuần. */
  expectedHours: number | null;
  /** Giờ học thật kể từ lúc đặt mục tiêu, làm tròn 0,5 giờ. */
  actualHours: number;
  daysLeft: number | null;
  weeksLeft: number | null;
}

const round05 = (h: number) => Math.round(h * 2) / 2;

function vnDay(now: Date): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Thuần, không chạm DB. Quy tắc ở docs/CENTER-schedule-attendance-AC.md, mục C6. */
export function assessPace(input: { goal: GoalForProgress; now: Date; actualSec: number }): PaceAssessment {
  const { goal, now, actualSec } = input;
  const actualHours = round05(actualSec / 3600);

  let daysLeft: number | null = null;
  let weeksLeft: number | null = null;
  if (goal.targetDate) {
    const diff = Math.round((Date.parse(`${goal.targetDate}T00:00:00Z`) - Date.parse(`${vnDay(now)}T00:00:00Z`)) / DAY_MS);
    daysLeft = diff;
    weeksLeft = Math.max(0, Math.ceil(diff / 7));
  }

  const weeksElapsed = (now.getTime() - Date.parse(goal.startedAt)) / WEEK_MS;
  const expectedRaw = goal.hoursPerWeek != null ? goal.hoursPerWeek * Math.max(1, weeksElapsed) : null;
  const base = { expectedHours: expectedRaw != null ? round05(expectedRaw) : null, actualHours, daysLeft, weeksLeft };

  if (daysLeft != null && daysLeft < 0) return { ...base, status: "overdue" };
  if (goal.hoursPerWeek == null || expectedRaw == null) return { ...base, status: "no_hours_target" };
  if (weeksElapsed < 1) return { ...base, status: "too_early" };

  const ratio = actualSec / (expectedRaw * 3600);
  const status: GoalPaceStatus = ratio >= GOAL_PACE_AHEAD_AT ? "ahead" : ratio >= GOAL_PACE_BEHIND_BELOW ? "on_track" : "behind";
  return { ...base, status };
}

export type GoalProgressReason = "personalization_off" | "control_variant" | "course_not_found" | "not_enrolled" | "language_mode_off";

export interface OverallProgress {
  label: MasteryLabel;
  lessonsPracticed: number;
  lessonsTotal: number;
}

export interface GoalProgress {
  weeksLeft: number | null;
  daysLeft: number | null;
  pace: { status: GoalPaceStatus; expectedHours: number | null; actualHours: number };
  /** Khoá ngoại ngữ: đủ 4 kỹ năng theo thứ tự Nghe, Nói, Đọc, Viết; ngược lại null. */
  skills: LanguageSkillRow[] | null;
  /** Khoá thường: một nhãn tổng; ngược lại null. */
  overall: OverallProgress | null;
  /** Vì sao không có nhãn (tắt cá nhân hoá, lớp đối chứng...). Vắng mặt khi mọi thứ bình thường. */
  reason?: GoalProgressReason;
}

async function sumActiveSec(userId: string, courseId: string | null, since: Date, until: Date, db: PrismaClient): Promise<number> {
  const rows = await db.learningEvent.findMany({
    where: {
      userId,
      eventType: LearningEventType.LessonEngaged,
      occurredAt: { gte: since, lte: until },
      ...(courseId ? { courseId } : {}),
    },
    select: { payload: true },
    take: 20_000,
  });
  let sec = 0;
  for (const r of rows) {
    const v = Number((r.payload as { activeSec?: unknown } | null)?.activeSec);
    if (Number.isFinite(v) && v > 0) sec += v;
  }
  return sec;
}

/** Nhãn tổng cho khoá không dùng 4 kỹ năng: trung bình mastery các bài học viên thấy được, cần đủ bằng chứng. */
async function overallProgress(userId: string, courseId: string, db: PrismaClient): Promise<OverallProgress> {
  const modules = await db.module.findMany({
    where: { courseId, isHidden: false },
    select: { lessons: { where: { isHidden: false }, select: { id: true } } },
  });
  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const skills = lessonIds.length
    ? await db.skill.findMany({
        where: { code: { in: lessonIds.map(lessonSkillCode) } },
        select: { code: true, learnerStates: { where: { userId, attempts: { gt: 0 } }, select: { masteryProbability: true, attempts: true } } },
      })
    : [];
  const used = skills.map((s) => s.learnerStates[0]).filter((s): s is NonNullable<typeof s> => !!s);
  const evidence = used.reduce((n, s) => n + s.attempts, 0);
  const avg = used.length ? used.reduce((n, s) => n + s.masteryProbability, 0) / used.length : null;
  return {
    label: avg !== null && evidence >= LANGUAGE_PROFILE_MIN_EVIDENCE ? masteryLabel(avg) : "no_data",
    lessonsPracticed: used.length,
    lessonsTotal: lessonIds.length,
  };
}

export async function getGoalProgress(
  input: { userId: string; courseId: string | null; goal: GoalForProgress; audience: ProfileAudience; now?: Date },
  db: PrismaClient = prisma,
): Promise<GoalProgress> {
  const now = input.now ?? new Date();
  const actualSec = await sumActiveSec(input.userId, input.courseId, new Date(input.goal.startedAt), now, db);
  const pace = assessPace({ goal: input.goal, now, actualSec });
  const base = {
    weeksLeft: pace.weeksLeft,
    daysLeft: pace.daysLeft,
    pace: { status: pace.status, expectedHours: pace.expectedHours, actualHours: pace.actualHours },
  };
  const none = (reason?: GoalProgressReason): GoalProgress => ({ ...base, skills: null, overall: null, ...(reason ? { reason } : {}) });

  if (!input.courseId) return none();
  const course = await db.course.findUnique({ where: { id: input.courseId }, select: { personalizationEnabled: true, languageMode: true } });
  if (!course) return none("course_not_found");
  if (!course.personalizationEnabled) return none("personalization_off");

  // Lớp đối chứng (B10) không được thấy kênh cá nhân hoá; giảng viên vẫn xem để quản lớp.
  if (input.audience === "learner") {
    const { variant } = await resolveFeedbackVariant(input.userId, input.courseId, db);
    if (variant === "minimal") return none("control_variant");
  }

  if (course.languageMode) {
    const profile = await getLanguageProfile(input.userId, input.courseId, input.audience, db);
    if (!profile.enabled) return none(profile.reason as GoalProgressReason | undefined);
    return { ...base, skills: profile.skills, overall: null };
  }
  return { ...base, skills: null, overall: await overallProgress(input.userId, input.courseId, db) };
}
