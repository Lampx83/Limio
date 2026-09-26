import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  /** True if the streak counter went up on this call. */
  extended: boolean;
  /** True if a previous streak (>0) got broken before resetting on this call. */
  broken: boolean;
  /** True if a missed day was forgiven by the weekly streak freeze on this call. */
  freezeUsed: boolean;
  previousStreak: number;
}

/** Bỏ lỡ đúng 1 ngày được tha nếu chưa dùng đóng băng trong chừng này ngày. */
export const FREEZE_COOLDOWN_DAYS = 7;

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

/** Đóng băng còn dùng được nếu chưa từng dùng, hoặc đã dùng cách đây ≥ cooldown. */
function freezeAvailable(lastUsed: Date | null, today: Date): boolean {
  return lastUsed === null || dayDiff(lastUsed, today) >= FREEZE_COOLDOWN_DAYS;
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
 *   - exactly 2 days after (1 missed day) AND streak freeze available (none
 *     used in the last FREEZE_COOLDOWN_DAYS) → current+=1, missed day forgiven,
 *     emit `streak.freeze.used`
 *   - otherwise ≥2 days after → emit `streak.broken {previousStreak}`, reset to 1
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
        freezeUsed: false,
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
        freezeUsed: false,
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
        freezeUsed: false,
        previousStreak: existing.currentStreak,
      };
    }

    // Bỏ lỡ đúng 1 ngày: tha nếu còn lượt đóng băng. Ngày bỏ lỡ KHÔNG được cộng
    // vào streak — chỉ giữ chuỗi khỏi đứt, hôm nay tính +1 như bình thường.
    if (
      diff === 2 &&
      existing.currentStreak > 0 &&
      freezeAvailable(existing.lastFreezeUsedDate, today)
    ) {
      const newCurrent = existing.currentStreak + 1;
      const newLongest = Math.max(existing.longestStreak, newCurrent);
      const missedDate = new Date(today.getTime() - 86_400_000);
      await tx.streakRecord.update({
        where: { id: existing.id },
        data: {
          currentStreak: newCurrent,
          longestStreak: newLongest,
          lastActiveDate: today,
          lastFreezeUsedDate: today,
        },
      });
      await tx.learningEvent.create({
        data: {
          userId, courseId,
          eventType: LearningEventType.StreakFreezeUsed,
          payload: {
            missedDate: missedDate.toISOString().slice(0, 10),
            streak: newCurrent,
          } as Prisma.InputJsonValue,
        },
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
        freezeUsed: true,
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
        freezeUsed: false,
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
      freezeUsed: false,
      previousStreak,
    };
  });
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  isActiveToday: boolean;
  /** Còn lượt đóng băng để tha 1 ngày bỏ lỡ (chưa dùng trong 7 ngày gần nhất). */
  freezeAvailable: boolean;
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
    freezeAvailable: freezeAvailable(row?.lastFreezeUsedDate ?? null, today),
  };
}

/** Number of whole VN-local days since the epoch (a stable day index). */
function vnDayNumber(d: Date): number {
  return Math.floor(vnDayStart(d).getTime() / 86_400_000);
}

/**
 * Cross-course "learning streak" for the global header.
 *
 * Per-course StreakRecord can't answer "how many days in a row did the learner
 * study (in ANY course)?" — a learner who touches a different course each day
 * has currentStreak=1 in every course. So we count consecutive VN-local days on
 * which the learner had ANY qualifying activity, using `streak.extended` events
 * (emitted once per course per active day) as the day source.
 *
 * currentStreak = length of the consecutive run ending today (or yesterday — a
 * streak isn't "broken" until a full day is missed). Bounded to the last ~400
 * days so the header query stays cheap.
 */
export async function getGlobalStreak(
  userId: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<StreakInfo> {
  const since = new Date(now.getTime() - 400 * 86_400_000);
  const events = await db.learningEvent.findMany({
    where: {
      userId,
      eventType: LearningEventType.StreakExtended,
      occurredAt: { gte: since },
    },
    select: { occurredAt: true },
    orderBy: { occurredAt: "desc" },
  });
  if (events.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, isActiveToday: false, freezeAvailable: false };
  }

  // Distinct active VN-day numbers, descending.
  const days = [...new Set(events.map((e) => vnDayNumber(e.occurredAt)))].sort(
    (a, b) => b - a,
  );
  const todayNum = vnDayNumber(now);
  const isActiveToday = days[0] === todayNum;

  // Current streak: consecutive run ending today or yesterday.
  let currentStreak = 0;
  if (days[0] === todayNum || days[0] === todayNum - 1) {
    currentStreak = 1;
    for (let i = 1; i < days.length && days[i] === days[i - 1]! - 1; i++) {
      currentStreak++;
    }
  }

  // Longest run within the window.
  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1]! - 1 ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    lastActiveDate: new Date(days[0]! * 86_400_000),
    isActiveToday,
    // Streak toàn cục chỉ đếm ngày liên tiếp, không có khái niệm đóng băng.
    freezeAvailable: false,
  };
}
