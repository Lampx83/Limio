import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";

/**
 * BKT probability threshold to consider a skill "mastered".
 * Mirrors the value used in badge logic (badges.ts CLEARED_BADGE_TIERS).
 */
const MASTERY_THRESHOLD = 0.9;

/**
 * Shape of a TournamentMission's condition fields.
 * Matches the Prisma-generated type for the new columns.
 */
export interface MissionConditionFields {
  conditionType: string | null;
  conditionValue: number | null;
  /** "course" (default) = scoped to tournament.courseId; "global" = platform-wide. */
  conditionScope: string | null;
  /** Minimum score % [1-100]. Used by quiz_passed_min_score and assignment_graded_min_score. */
  conditionMinScore: number | null;
  /** Skill code prefix for skill_mastered_in_group (e.g. "zh_tech.vocab"). */
  conditionSkillCode: string | null;
}

export interface ConditionCheckResult {
  /** Whether the condition is satisfied. */
  met: boolean;
  /** Current count / value the user has reached. */
  current: number;
  /** The threshold that must be reached (conditionValue). 0 when conditionType is null/manual. */
  required: number;
}

/**
 * Supported conditionType values. Kept as a plain object (not an enum) so
 * downstream code can extend the list without touching this file.
 */
export const ConditionType = {
  /** Complete ≥ N lessons (scoped to course or global). */
  LessonCompletedCount: "lesson_completed_count",
  /** Pass ≥ N quizzes (default pass threshold of each quiz). */
  QuizPassedCount: "quiz_passed_count",
  /** Pass ≥ N quizzes with score ≥ conditionMinScore%. */
  QuizPassedMinScore: "quiz_passed_min_score",
  /** Pass ≥ N quizzes on the very first attempt (anti-grind). */
  QuizFirstPass: "quiz_first_pass",
  /** Achieve 100% score in ≥ N quizzes. */
  QuizPassedPerfect: "quiz_passed_perfect",
  /** Maintain a learning streak of ≥ N days in the course. */
  StreakDays: "streak_days",
  /** Resolve ≥ N misconception flags (platform-wide, not course-scoped). */
  MisconceptionResolvedCount: "misconception_resolved_count",
  /** Reach mastery on ≥ N skills (any skill, course-independent). */
  SkillMasteredCount: "skill_mastered_count",
  /** Reach mastery on ≥ N skills whose code starts with conditionSkillCode. */
  SkillMasteredInGroup: "skill_mastered_in_group",
  /** Have ≥ N assignments graded with score ≥ conditionMinScore%. */
  AssignmentGradedMinScore: "assignment_graded_min_score",
  /** Complete ≥ N H5P content items (lifetime-once per packageId, anti-farm). */
  H5pCompletedCount: "h5p_completed_count",
} as const;

/**
 * Check whether a user has met a tournament mission's condition.
 *
 * @param userId       - The learner whose progress is checked.
 * @param mission      - The condition fields from TournamentMission.
 * @param courseId     - tournament.courseId (null for platform-wide tournaments).
 * @param db           - Prisma client (injectable for tests).
 *
 * Returns `{ met, current, required }` so the API can return progress
 * information to the UI even when the condition is not yet met.
 *
 * Notes:
 * - conditionType === null or "manual" → always returns met=false; the
 *   caller (admin / instructor) must mark completion manually.
 * - conditionScope === "global" → queries ignore courseId even when provided.
 * - All queries use existing indexed columns — no JSON payload scanning.
 */
export async function checkMissionCondition(
  userId: string,
  mission: MissionConditionFields,
  courseId: string | null,
  db: PrismaClient = prisma,
): Promise<ConditionCheckResult> {
  const { conditionType, conditionValue, conditionScope, conditionMinScore, conditionSkillCode } =
    mission;

  // No condition configured or manual-only → cannot auto-verify.
  if (!conditionType || conditionType === "manual" || conditionValue === null) {
    return { met: false, current: 0, required: conditionValue ?? 0 };
  }

  const required = conditionValue;
  // "global" scope ignores courseId; everything else uses the provided courseId.
  const scopedCourseId = conditionScope === "global" ? null : courseId;

  let current = 0;

  switch (conditionType) {
    // ── lesson_completed_count ───────────────────────────────────────────
    // Source: LearningEvent (append-only, one event per lesson completion per user).
    // LessonCompleted events are emitted by core-lms inside completeLesson().
    case ConditionType.LessonCompletedCount: {
      current = await db.learningEvent.count({
        where: {
          userId,
          eventType: LearningEventType.LessonCompleted,
          ...(scopedCourseId ? { courseId: scopedCourseId } : {}),
        },
      });
      break;
    }

    // ── quiz_passed_count ────────────────────────────────────────────────
    // Source: QuizAttempt. Uses the indexed (userId, quizId) columns. Quiz không còn ngưỡng đạt:
    // "passed" nghĩa là đã nộp bài.
    case ConditionType.QuizPassedCount: {
      current = await db.quizAttempt.count({
        where: {
          userId,
          status: "submitted",
          ...(scopedCourseId ? { quiz: { courseId: scopedCourseId } } : {}),
        },
      });
      break;
    }

    // ── quiz_passed_min_score ────────────────────────────────────────────
    // Like quiz_passed_count but also requires scorePct ≥ conditionMinScore.
    // conditionMinScore defaults to 85 when not set (instructor oversight guard).
    case ConditionType.QuizPassedMinScore: {
      const minScore = conditionMinScore ?? 85;
      current = await db.quizAttempt.count({
        where: {
          userId,
          status: "submitted",
          scorePct: { gte: minScore },
          ...(scopedCourseId ? { quiz: { courseId: scopedCourseId } } : {}),
        },
      });
      break;
    }

    // ── quiz_first_pass ──────────────────────────────────────────────────
    // Source: XpTransaction with reason "quiz.passed.first_try" AND amount > 0.
    // amount=0 rows are speed-run audit entries — exclude them so a
    // 9-second pass does not count toward first-try missions.
    case ConditionType.QuizFirstPass: {
      current = await db.xpTransaction.count({
        where: {
          userId,
          reason: "quiz.passed.first_try",
          amount: { gt: 0 },
          ...(scopedCourseId ? { courseId: scopedCourseId } : {}),
        },
      });
      break;
    }

    // ── quiz_passed_perfect ──────────────────────────────────────────────
    // 100% score in a submitted, passed attempt.
    case ConditionType.QuizPassedPerfect: {
      current = await db.quizAttempt.count({
        where: {
          userId,
          status: "submitted",
          scorePct: { gte: 100 },
          ...(scopedCourseId ? { quiz: { courseId: scopedCourseId } } : {}),
        },
      });
      break;
    }

    // ── streak_days ──────────────────────────────────────────────────────
    // Source: StreakRecord.currentStreak (always up-to-date; rebuilt by
    // recordActivity() after each lesson/quiz/H5P in core-gamification).
    // Requires a courseId — platform-wide tournaments cannot use this type.
    case ConditionType.StreakDays: {
      if (!scopedCourseId) {
        current = 0;
        break;
      }
      const streak = await db.streakRecord.findUnique({
        where: { userId_courseId: { userId, courseId: scopedCourseId } },
        select: { currentStreak: true },
      });
      current = streak?.currentStreak ?? 0;
      break;
    }

    // ── misconception_resolved_count ─────────────────────────────────────
    // Source: MisconceptionFlag. No courseId — misconceptions are user-level,
    // not course-scoped (a learner's conceptual error persists across courses).
    case ConditionType.MisconceptionResolvedCount: {
      current = await db.misconceptionFlag.count({
        where: { userId, resolved: true },
      });
      break;
    }

    // ── skill_mastered_count ─────────────────────────────────────────────
    // Source: LearnerSkillState. masteryProbability ≥ 0.9 = "mastered" per BKT.
    // No course filter — skill mastery is cross-course by design.
    case ConditionType.SkillMasteredCount: {
      current = await db.learnerSkillState.count({
        where: { userId, masteryProbability: { gte: MASTERY_THRESHOLD } },
      });
      break;
    }

    // ── skill_mastered_in_group ──────────────────────────────────────────
    // Filters skills whose code starts with conditionSkillCode prefix.
    // Step 1: resolve prefix → skill IDs (small set — skill catalog is bounded).
    // Step 2: count mastered rows for those IDs.
    case ConditionType.SkillMasteredInGroup: {
      if (!conditionSkillCode) {
        current = 0;
        break;
      }
      const skillsInGroup = await db.skill.findMany({
        where: { code: { startsWith: conditionSkillCode } },
        select: { id: true },
      });
      if (skillsInGroup.length === 0) {
        current = 0;
        break;
      }
      current = await db.learnerSkillState.count({
        where: {
          userId,
          skillId: { in: skillsInGroup.map((s) => s.id) },
          masteryProbability: { gte: MASTERY_THRESHOLD },
        },
      });
      break;
    }

    // ── assignment_graded_min_score ──────────────────────────────────────
    // Source: AssignmentSubmission with status="graded" and score ≥ threshold.
    // score is an integer out of assignment.maxScore (default 100).
    // conditionMinScore is treated as a percentage: score/maxScore*100 ≥ minScore.
    // For simplicity (and because maxScore defaults to 100), we compare score
    // directly. If instructors use non-100 maxScore they should adjust conditionMinScore.
    case ConditionType.AssignmentGradedMinScore: {
      const minScore = conditionMinScore ?? 70;
      current = await db.assignmentSubmission.count({
        where: {
          userId,
          status: "graded",
          score: { gte: minScore },
          ...(scopedCourseId
            ? { assignment: { lesson: { module: { courseId: scopedCourseId } } } }
            : {}),
        },
      });
      break;
    }

    // ── h5p_completed_count ──────────────────────────────────────────────
    // Source: XpTransaction with reason "h5p.completed" and amount > 0.
    // sourceId = packageId and deduped lifetime-once (anti-farm) — same
    // logic as onH5pCompleted() in handlers.ts.
    case ConditionType.H5pCompletedCount: {
      current = await db.xpTransaction.count({
        where: {
          userId,
          reason: "h5p.completed",
          amount: { gt: 0 },
          ...(scopedCourseId ? { courseId: scopedCourseId } : {}),
        },
      });
      break;
    }

    default:
      // Unknown conditionType — treat as unmet so bad data doesn't auto-grant.
      current = 0;
      break;
  }

  return { met: current >= required, current, required };
}
