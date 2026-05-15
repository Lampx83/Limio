import { prisma, type PrismaClient } from "@feedbackme/db";
import { awardXp, type AwardResult } from "./xp";
import {
  checkClearedMisconceptionBadges,
  checkCourseCompletedBadges,
  checkLessonCompletedBadges,
  checkQuizStartedBadges,
  checkQuizSubmittedBadges,
  type BadgeCheckResult,
} from "./badges";
import { recordActivity, type StreakResult } from "./streak";
import { recordQuestProgress } from "./quests";

/**
 * Event handlers — called from `apps/web` orchestration layer AFTER
 * core-lms emits the corresponding learning event. Per CLAUDE.md §4.3,
 * core-gamification never imports core-lms; the wiring is in `apps/web`.
 *
 * A5.8 (Q7) — These handlers take `userId: string` non-null by contract.
 * The caller (orchestration in apps/web) is responsible for filtering out
 * candidate-emitted events: candidate routes auth via the exam_session
 * cookie, never reach the User-only endpoints that trigger these handlers,
 * and event-driven workers must call `isLearnerEvent(event)` first.
 */

export interface LessonCompletedInput {
  userId: string;
  courseId: string;
  lessonId: string;
}

const LESSON_COMPLETED_XP = 10;

export interface LessonCompletedResult {
  xp: AwardResult;
  badges: BadgeCheckResult;
  streak: StreakResult;
}

export async function onLessonCompleted(
  input: LessonCompletedInput,
  db: PrismaClient = prisma,
): Promise<LessonCompletedResult> {
  const xp = await awardXp(
    {
      userId: input.userId,
      courseId: input.courseId,
      amount: LESSON_COMPLETED_XP,
      reason: "lesson.completed",
      sourceId: input.lessonId,
    },
    db,
  );
  const badges = await checkLessonCompletedBadges(input, db);
  const streak = await recordActivity(input.userId, input.courseId, db);
  await recordQuestProgress(
    input.userId,
    "complete_lessons",
    input.courseId,
    1,
    db,
  );
  return { xp, badges, streak };
}

export interface CourseCompletedInput {
  userId: string;
  courseId: string;
}

export async function onCourseCompleted(
  input: CourseCompletedInput,
  db: PrismaClient = prisma,
): Promise<{ badges: BadgeCheckResult }> {
  const badges = await checkCourseCompletedBadges(input, db);
  return { badges };
}

export interface QuizStartedInput {
  userId: string;
  courseId: string;
  quizId: string;
  attemptId: string;
}

export async function onQuizStarted(
  input: QuizStartedInput,
  db: PrismaClient = prisma,
): Promise<{ badges: BadgeCheckResult }> {
  const badges = await checkQuizStartedBadges(input, db);
  return { badges };
}

export interface QuizSubmittedInput {
  userId: string;
  courseId: string;
  attemptId: string;
  quizId: string;
  passed: boolean;
  /** 1-5; null treated as 1. */
  difficulty: number | null;
  /** Whether this is the user's first ever passed attempt for this quiz. */
  isFirstPass: boolean;
  /** Time spent on the attempt, used for anti-farm speed-run check. */
  elapsedSec: number;
}

const SPEED_RUN_THRESHOLD_SEC = 10;

export interface QuizSubmittedResult {
  xp: AwardResult | null;
  badges: BadgeCheckResult;
  streak: StreakResult;
  /** D3 — adaptive XP multiplier based on quiz primary skill mastery. */
  adaptiveMultiplier: number;
  /** Mean mastery across the quiz's tagged skills, or null on cold start. */
  avgMastery: number | null;
}

/**
 * D3 — Adaptive reward sizing per spec §6.3. Returns 1.0 when avgMastery
 * is null (cold start) so a brand-new learner isn't penalized on their
 * first quiz.
 */
export function adaptiveMultiplier(avgMastery: number | null): number {
  if (avgMastery === null) return 1.0;
  if (avgMastery > 0.85) return 0.5;
  if (avgMastery > 0.6) return 0.8;
  if (avgMastery < 0.3) return 1.5;
  return 1.0;
}

/**
 * XP rules: failed → null xp; speed-run → 0-amount audit row; otherwise per spec table.
 * Badges: `first_win` if passed, `perfect_score` if 100%. Both idempotent.
 *
 * D3: when `avgMastery` is provided, base XP is multiplied per spec §6.3 and
 * the storedReason gets `.adaptive` suffix when multiplier ≠ 1.0.
 */
export async function onQuizSubmitted(
  input: QuizSubmittedInput & { scorePct: number; avgMastery?: number | null },
  db: PrismaClient = prisma,
): Promise<QuizSubmittedResult> {
  const avgMastery = input.avgMastery ?? null;
  const multiplier = adaptiveMultiplier(avgMastery);

  let xp: AwardResult | null = null;
  if (!input.passed) {
    xp = null;
  } else if (input.elapsedSec < SPEED_RUN_THRESHOLD_SEC) {
    xp = await awardXp(
      {
        userId: input.userId,
        courseId: input.courseId,
        amount: 0,
        reason: "quiz.passed.first_try",
        sourceId: `speed_run:${input.attemptId}`,
      },
      db,
    );
  } else {
    const difficulty = input.difficulty ?? 1;
    const baseAmount = (input.isFirstPass ? 50 : 20) * difficulty;
    const amount = Math.round(baseAmount * multiplier);
    // Reason stays in the canonical {first_try, retry} bucket so the daily cap
    // counts adaptive grants together with normal ones. The multiplier is
    // already reflected in `amount` and re-emitted via the xp.awarded payload.
    const reason = input.isFirstPass ? "quiz.passed.first_try" : "quiz.passed.retry";
    xp = await awardXp(
      {
        userId: input.userId,
        courseId: input.courseId,
        amount,
        reason,
        sourceId: input.attemptId,
        extraEventPayload: {
          baseAmount,
          adaptiveMultiplier: multiplier,
          avgMastery,
        },
      },
      db,
    );
  }

  const badges = await checkQuizSubmittedBadges(
    {
      userId: input.userId,
      courseId: input.courseId,
      quizId: input.quizId,
      attemptId: input.attemptId,
      passed: input.passed,
      scorePct: input.scorePct,
    },
    db,
  );

  const streak = await recordActivity(input.userId, input.courseId, db);

  if (input.passed) {
    await recordQuestProgress(
      input.userId,
      "pass_quizzes",
      input.courseId,
      1,
      db,
    );
  }

  return { xp, badges, streak, adaptiveMultiplier: multiplier, avgMastery };
}

// =====================================================================
// D1 — Cross-cutting bridge: Feedback Engine → Gamification.
// When `misconception.resolved` is emitted by core-feedback, award XP.
// Lifetime-once per (user, misconception) via sourceId — guards against
// farming by intentionally re-failing then re-clearing (CLAUDE.md §5.5).
// =====================================================================

const MISCONCEPTION_RESOLVED_XP = 15;

export interface MisconceptionResolvedInput {
  userId: string;
  courseId: string;
  misconceptionId: string;
  /** Attempt that produced the resolution — included in event payload for audit. */
  attemptId: string;
}

// =====================================================================
// H5P bridge: awards XP when learner completes an H5P content item.
// Lifetime-once per (user, packageId) via sourceId — anti-farm (CLAUDE.md §5.5).
// =====================================================================

const H5P_COMPLETED_XP = 20;

export interface H5pCompletedInput {
  userId: string;
  courseId: string;
  packageId: string;
  /** Optional — for audit trail in event payload. */
  attemptId?: string;
  /** Optional — passed-through xAPI score for analytics. */
  scoreRaw?: number | null;
  scoreMax?: number | null;
}

export async function onH5pCompleted(
  input: H5pCompletedInput,
  db: PrismaClient = prisma,
): Promise<{ xp: AwardResult; streak: StreakResult }> {
  const xp = await awardXp(
    {
      userId: input.userId,
      courseId: input.courseId,
      amount: H5P_COMPLETED_XP,
      reason: "h5p.completed",
      sourceId: input.packageId,
      extraEventPayload: {
        attemptId: input.attemptId,
        scoreRaw: input.scoreRaw ?? null,
        scoreMax: input.scoreMax ?? null,
      },
    },
    db,
  );
  const streak = await recordActivity(input.userId, input.courseId, db);
  // Quest progress — H5P completion counts toward "complete_lessons" objective.
  await recordQuestProgress(
    input.userId,
    "complete_lessons",
    input.courseId,
    1,
    db,
  );
  return { xp, streak };
}

// =====================================================================
// Assignment — generative learning rewards.
// XP granted only when learner submits with BOTH self-rating set AND
// reflection length ≥ MIN. Idempotent on (userId, assignmentId) — re-
// submission doesn't re-award.
// =====================================================================

export interface AssignmentDeepReflectionInput {
  userId: string;
  courseId: string;
  assignmentId: string;
  selfRating: number | null;
  reflectionLength: number;
}

const ASSIGNMENT_DEEP_REFLECTION_XP = 15;
const REFLECTION_MIN_CHARS = 20;

export async function onAssignmentDeepReflection(
  input: AssignmentDeepReflectionInput,
  db: PrismaClient = prisma,
): Promise<{ xp: AwardResult | null }> {
  if (
    input.selfRating == null ||
    input.reflectionLength < REFLECTION_MIN_CHARS
  ) {
    return { xp: null };
  }
  const xp = await awardXp(
    {
      userId: input.userId,
      courseId: input.courseId,
      amount: ASSIGNMENT_DEEP_REFLECTION_XP,
      reason: "assignment.deep_reflection",
      sourceId: input.assignmentId,
      extraEventPayload: {
        selfRating: input.selfRating,
        reflectionLength: input.reflectionLength,
      },
    },
    db,
  );
  return { xp };
}

export async function onMisconceptionResolved(
  input: MisconceptionResolvedInput,
  db: PrismaClient = prisma,
): Promise<{ xp: AwardResult; badges: BadgeCheckResult }> {
  const xp = await awardXp(
    {
      userId: input.userId,
      courseId: input.courseId,
      amount: MISCONCEPTION_RESOLVED_XP,
      reason: "misconception.resolved",
      sourceId: input.misconceptionId,
      extraEventPayload: { attemptId: input.attemptId },
    },
    db,
  );
  const badges = await checkClearedMisconceptionBadges(
    { userId: input.userId, courseId: input.courseId },
    db,
  );
  await recordQuestProgress(
    input.userId,
    "resolve_misconceptions",
    input.courseId,
    1,
    db,
  );
  return { xp, badges };
}
