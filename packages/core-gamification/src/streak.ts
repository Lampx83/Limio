import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  /** True if the streak counter went up on this call. */
  extended: boolean;
  /** True if a previous streak (>0) got broken before resetting on this call. */
  broken: boolean;
  previousStreak: number;
}

// Streaks roll over at national-local midnight, NOT UTC midnight — otherwise a
// learner active at 23:00 VN (16:00 UTC) and again at 06:00 VN next day would
// look like the same UTC day and lose a day, or the streak would break at 07:00
// local. VN is UTC+7 with no DST, so a fixed offset is exact. Mirrors the
// VN-aware boundary used by the leaderboard cron (leaderboard/closeAll.ts).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Midnight of the VN-local calendar day containing `d`, returned as a Date whose
 * digits ARE the VN date at 00:00 UTC — so it round-trips through a `@db.Date`
 * column as the VN calendar date.
 */
function vnDayStart(d: Date = new Date()): Date {
  const shifted = new Date(d.getTime() + VN_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return shifted;
}

/** Returns the difference in whole VN-local days between two `@db.Date` values. */
function dayDiff(a: Date, b: Date): number {
  const ms = vnDayStart(b).getTime() - vnDayStart(a).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Record a qualifying activity for (user, course). Streak math:
 *   - first activity ever → current=1
 *   - same VN day → no change
 *   - exactly 1 day after lastActiveDate → current+=1
 *   - ≥2 days after → emit `streak.broken {previousStreak}`, reset to 1
 * Always emits `streak.extended {newStreak}` when current goes up.
 *
 * Idempotent on same VN day: calling twice on day N returns the same numbers.
 */
export async function recordActivity(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<StreakResult> {
  const today = vnDayStart(now);

  return db.$transaction(async (tx) => {
    const existing = await tx.streakRecord.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (!existing) {
      await tx.streakRecord.create({
        data: {
          userId,
          courseId,
          currentStreak: 1,
          longestStreak: 1,
          lastActiveDate: today,
        },
      });
      await tx.learningEvent.create({
        data: {
          userId,
          courseId,
          eventType: LearningEventType.StreakExtended,
          payload: { newStreak: 1, longestStreak: 1 } as Prisma.InputJsonValue,
        },
      });
      return {
        currentStreak: 1,
        longestStreak: 1,
        extended: true,
        broken: false,
        previousStreak: 0,
      };
    }

    if (!existing.lastActiveDate) {
      // Should not occur (existing rows always have lastActiveDate), but handle defensively.
      const updated = await tx.streakRecord.update({
        where: { id: existing.id },
        data: { currentStreak: 1, longestStreak: Math.max(existing.longestStreak, 1), lastActiveDate: today },
      });
      await tx.learningEvent.create({
        data: {
          userId, courseId,
          eventType: LearningEventType.StreakExtended,
          payload: { newStreak: 1, longestStreak: updated.longestStreak } as Prisma.InputJsonValue,
        },
      });
      return {
        currentStreak: updated.currentStreak,
        longestStreak: updated.longestStreak,
        extended: true,
        broken: false,
        previousStreak: existing.currentStreak,
      };
    }

    const diff = dayDiff(existing.lastActiveDate, today);

    if (diff === 0) {
      // Already counted today — no change.
      return {
        currentStreak: existing.currentStreak,
        longestStreak: existing.longestStreak,
        extended: false,
        broken: false,
        previousStreak: existing.currentStreak,
      };
    }

    if (diff === 1) {
      // Continued: bump.
      const newCurrent = existing.currentStreak + 1;
      const newLongest = Math.max(existing.longestStreak, newCurrent);
      await tx.streakRecord.update({
        where: { id: existing.id },
        data: { currentStreak: newCurrent, longestStreak: newLongest, lastActiveDate: today },
      });
      await tx.learningEvent.create({
        data: {
          userId, courseId,
          eventType: LearningEventType.StreakExtended,
          payload: { newStreak: newCurrent, longestStreak: newLongest } as Prisma.InputJsonValue,
        },
      });
      return {
        currentStreak: newCurrent,
        longestStreak: newLongest,
        extended: true,
        broken: false,
        previousStreak: existing.currentStreak,
      };
    }

    // Gap ≥ 2 days — broken. Reset to 1.
    const previousStreak = existing.currentStreak;
    await tx.streakRecord.update({
      where: { id: existing.id },
      data: { currentStreak: 1, lastActiveDate: today },
    });
    if (previousStreak > 0) {
      await tx.learningEvent.create({
        data: {
          userId, courseId,
          eventType: LearningEventType.StreakBroken,
          payload: {
            previousStreak,
            longestStreak: existing.longestStreak,
          } as Prisma.InputJsonValue,
        },
      });
    }
    await tx.learningEvent.create({
      data: {
        userId, courseId,
        eventType: LearningEventType.StreakExtended,
        payload: { newStreak: 1, longestStreak: existing.longestStreak } as Prisma.InputJsonValue,
      },
    });
    return {
      currentStreak: 1,
      longestStreak: existing.longestStreak,
      extended: true,
      broken: previousStreak > 0,
      previousStreak,
    };
  });
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  isActiveToday: boolean;
}

export async function getStreak(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<StreakInfo> {
  const row = await db.streakRecord.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  const today = vnDayStart(now);
  const isActiveToday =
    row?.lastActiveDate ? dayDiff(row.lastActiveDate, today) === 0 : false;
  return {
    currentStreak: row?.currentStreak ?? 0,
    longestStreak: row?.longestStreak ?? 0,
    lastActiveDate: row?.lastActiveDate ?? null,
    isActiveToday,
  };
}
