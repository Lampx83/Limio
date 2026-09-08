import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { computeLevel, LEVEL_THRESHOLDS, levelName, MAX_LEVEL, nextLevelXp } from "./levels";
import { periodRange } from "./leaderboard/periodKey";

/**
 * Daily caps per (user, course, reason). Awards beyond the cap go through
 * but with `amount=0` and reason="xp.capped.daily" for audit.
 */
export const DAILY_CAPS: Record<string, number> = {
  "lesson.completed": 10,
  "quiz.passed.first_try": 5,
  "quiz.passed.retry": 5,
  "assignment.deep_reflection": 5,
};

export type AwardReason =
  | "lesson.completed"
  | "quiz.passed.first_try"
  | "quiz.passed.retry"
  | "misconception.resolved"
  | "quest.completed"
  | "h5p.completed"
  | "tournament.prize"
  | "tournament.mission.completed"
  | "tournament.mission.review.awarded"
  | "assignment.deep_reflection";

export interface AwardInput {
  userId: string;
  courseId: string;
  amount: number;
  reason: AwardReason;
  sourceId: string;
  /** Extra fields merged into the `xp.awarded` event payload. Useful for
   *  audit trails of derived numbers (e.g. D3 multiplier + base amount). */
  extraEventPayload?: Record<string, unknown>;
}

export interface AwardResult {
  /** True if this call resulted in a NEW transaction (i.e. wasn't a duplicate emit). */
  awarded: boolean;
  /** True if XP > 0 was actually granted (false when capped or speed-run). */
  amountGranted: number;
  before: { xp: number; level: number };
  after: { xp: number; level: number };
  leveledUp: boolean;
  /** Audit reason actually stored: input.reason, or "xp.capped.daily". */
  storedReason: string;
}

export class XpError extends Error {
  constructor(public readonly code: "validation_failed") {
    super(code);
  }
}

/**
 * Award XP for a (user, course, reason, sourceId) tuple. Idempotent on the
 * tuple — re-calling with the same sourceId returns awarded=false and the
 * already-stored result. Capped at the daily limit per reason; over-cap
 * grants are recorded with amount=0 and reason="xp.capped.daily".
 *
 * The daily window is the VN-local calendar day (via `periodRange`), not
 * UTC — matching streak.ts and the leaderboard's own day bucketing. Using
 * UTC here would reset the cap at 07:00 VN instead of midnight, letting a
 * learner active before and after that instant double up within one VN day.
 */
export async function awardXp(
  input: AwardInput,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<AwardResult> {
  if (input.amount < 0) throw new XpError("validation_failed");

  // Step 1: idempotency — bail out fast if this (user, reason, sourceId) is
  // already on the ledger.
  const existing = await db.xpTransaction.findUnique({
    where: {
      userId_reason_sourceId: {
        userId: input.userId,
        reason: input.reason,
        sourceId: input.sourceId,
      },
    },
  });
  if (existing) {
    const progress = await db.userCourseProgress.findUnique({
      where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
    });
    const xp = progress?.xp ?? 0;
    const level = progress?.level ?? 1;
    return {
      awarded: false,
      amountGranted: existing.amount,
      before: { xp, level },
      after: { xp, level },
      leveledUp: false,
      storedReason: existing.reason,
    };
  }

  // Step 2: daily cap check — count today's grants (with positive amount only)
  // for this (user, course, reason).
  const cap = DAILY_CAPS[input.reason];
  let amountToGrant = input.amount;
  let storedReason: string = input.reason;
  if (cap !== undefined) {
    const todayCount = await db.xpTransaction.count({
      where: {
        userId: input.userId,
        courseId: input.courseId,
        reason: input.reason,
        amount: { gt: 0 },
        occurredAt: { gte: periodRange("daily", now).start },
      },
    });
    if (todayCount >= cap) {
      amountToGrant = 0;
      storedReason = "xp.capped.daily";
    }
  }

  return db.$transaction(async (tx) => {
    // Insert ledger row (idempotency unique key prevents double-insert under race).
    try {
      await tx.xpTransaction.create({
        data: {
          userId: input.userId,
          courseId: input.courseId,
          amount: amountToGrant,
          reason: storedReason,
          sourceId: input.sourceId,
        },
      });
    } catch (e) {
      // Duck-type — instanceof unreliable across bundler boundaries.
      const code = (e as { code?: string }).code;
      if (code === "P2002") {
        // Lost the race — another request already inserted. Treat as no-op.
        const progress = await tx.userCourseProgress.findUnique({
          where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
        });
        return {
          awarded: false,
          amountGranted: 0,
          before: { xp: progress?.xp ?? 0, level: progress?.level ?? 1 },
          after: { xp: progress?.xp ?? 0, level: progress?.level ?? 1 },
          leveledUp: false,
          storedReason,
        };
      }
      throw e;
    }

    // Update aggregate (or create on first XP grant for this course).
    const progress = await tx.userCourseProgress.upsert({
      where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
      create: {
        userId: input.userId,
        courseId: input.courseId,
        xp: amountToGrant,
        level: computeLevel(amountToGrant),
      },
      update: { xp: { increment: amountToGrant } },
    });

    // Recompute level from updated xp; bump if needed.
    const newLevel = computeLevel(progress.xp);
    let leveledUp = false;
    let after = progress;
    if (newLevel !== progress.level) {
      after = await tx.userCourseProgress.update({
        where: { id: progress.id },
        data: { level: newLevel },
      });
      leveledUp = newLevel > progress.level;
    }

    const before = {
      xp: progress.xp - amountToGrant,
      level: computeLevel(progress.xp - amountToGrant),
    };

    // Emit xp.awarded (always) + level.up (only on actual change, idempotent).
    if (amountToGrant > 0) {
      await tx.learningEvent.create({
        data: {
          userId: input.userId,
          courseId: input.courseId,
          eventType: LearningEventType.XpAwarded,
          payload: {
            amount: amountToGrant,
            reason: storedReason,
            sourceId: input.sourceId,
            newXp: after.xp,
            newLevel: after.level,
            ...(input.extraEventPayload ?? {}),
          } as Prisma.InputJsonValue,
        },
      });
    }
    if (leveledUp) {
      try {
        await tx.learningEvent.create({
          data: {
            userId: input.userId,
            courseId: input.courseId,
            eventType: LearningEventType.LevelUp,
            payload: {
              fromLevel: before.level,
              toLevel: after.level,
              levelName: levelName(after.level),
            } as Prisma.InputJsonValue,
            // Idempotent per (user, course, level) so re-runs don't double-emit.
            eventKey: `level.up:${input.userId}:${input.courseId}:${after.level}`,
          },
        });
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code !== "P2002") throw e;
      }
    }

    return {
      awarded: true,
      amountGranted: amountToGrant,
      before,
      after: { xp: after.xp, level: after.level },
      leveledUp,
      storedReason,
    };
  });
}

export interface CourseXpProgress {
  xp: number;
  level: number;
  levelName: string;
  isMaxLevel: boolean;
  /** XP at which the current level was unlocked. */
  levelStartXp: number;
  /** XP threshold to reach the next level. Null at max level. */
  nextLevelXp: number | null;
  xpToNext: number | null;
  /** % progress within the current level's bracket [0..100]. 100 at max level. */
  levelProgressPct: number;
}

export async function getCourseXpProgress(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<CourseXpProgress> {
  const row = await db.userCourseProgress.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  const xp = row?.xp ?? 0;
  const level = row?.level ?? 1;
  const next = nextLevelXp(level);
  const levelStartXp = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const isMaxLevel = level >= MAX_LEVEL;
  const levelProgressPct = isMaxLevel
    ? 100
    : Math.max(
        0,
        Math.min(100, Math.round(((xp - levelStartXp) / (next! - levelStartXp)) * 100)),
      );
  return {
    xp,
    level,
    levelName: levelName(level),
    isMaxLevel,
    levelStartXp,
    nextLevelXp: next,
    xpToNext: next === null ? null : Math.max(0, next - xp),
    levelProgressPct,
  };
}
