import { prisma, type PrismaClient } from "@feedbackme/db";
import { computeLevel } from "./levels";

const TOP_N = 20;

/** Monday 00:00 UTC of the week containing `now`. */
function startOfWeekUtc(now: Date = new Date()): Date {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  // Days back to Monday. Sunday → 6 days back. Monday → 0.
  const daysBack = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  weeklyXp: number;
  /** Total XP in the course (cumulative, for level display). */
  totalXp: number;
  level: number;
  isYou: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalParticipants: number;
  weekStart: Date;
  /** When current user is outside top N AND not opted out. Null otherwise. */
  selfRank: {
    rank: number;
    weeklyXp: number;
    percentile: number; // 1-100, lower = better
  } | null;
  /** True if the current user has opted out of leaderboards globally. */
  selfOptedOut: boolean;
}

/**
 * Course leaderboard for the current week (Monday 00:00 UTC → now).
 * Excludes opted-out users. `currentUserId` may be null for anonymous viewers.
 */
export async function getCourseLeaderboard(
  courseId: string,
  currentUserId: string | null,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<LeaderboardResponse> {
  const weekStart = startOfWeekUtc(now);

  // Aggregate weekly XP per user, excluding opt-outs.
  const rows = await db.$queryRaw<
    Array<{
      userId: string;
      weeklyXp: bigint;
      displayName: string;
      leaderboardOptOut: boolean;
    }>
  >`
    SELECT
      x."userId" as "userId",
      SUM(x."amount")::bigint as "weeklyXp",
      u."displayName" as "displayName",
      u."leaderboardOptOut" as "leaderboardOptOut"
    FROM "XpTransaction" x
    JOIN "User" u ON u.id = x."userId"
    WHERE x."courseId" = ${courseId}
      AND x."occurredAt" >= ${weekStart}
      AND x."amount" > 0
      AND u."leaderboardOptOut" = false
    GROUP BY x."userId", u."displayName", u."leaderboardOptOut"
    ORDER BY "weeklyXp" DESC, x."userId" ASC
  `;

  const totalParticipants = rows.length;

  // Get cumulative course XP for the top N for level display.
  const topRows = rows.slice(0, TOP_N);
  const topUserIds = topRows.map((r) => r.userId);
  const totals =
    topUserIds.length === 0
      ? []
      : await db.userCourseProgress.findMany({
          where: { userId: { in: topUserIds }, courseId },
          select: { userId: true, xp: true },
        });
  const totalXpByUser = new Map(totals.map((t) => [t.userId, t.xp]));

  const entries: LeaderboardEntry[] = topRows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    displayName: r.displayName,
    weeklyXp: Number(r.weeklyXp),
    totalXp: totalXpByUser.get(r.userId) ?? 0,
    level: computeLevel(totalXpByUser.get(r.userId) ?? 0),
    isYou: r.userId === currentUserId,
  }));

  let selfOptedOut = false;
  let selfRank: LeaderboardResponse["selfRank"] = null;
  if (currentUserId) {
    const u = await db.user.findUnique({
      where: { id: currentUserId },
      select: { leaderboardOptOut: true },
    });
    selfOptedOut = u?.leaderboardOptOut ?? false;

    if (!selfOptedOut) {
      const inTop = entries.some((e) => e.userId === currentUserId);
      if (!inTop) {
        const idx = rows.findIndex((r) => r.userId === currentUserId);
        if (idx >= 0) {
          const rank = idx + 1;
          selfRank = {
            rank,
            weeklyXp: Number(rows[idx]!.weeklyXp),
            percentile: Math.max(1, Math.round((rank / totalParticipants) * 100)),
          };
        }
      }
    }
  }

  return { entries, totalParticipants, weekStart, selfRank, selfOptedOut };
}

export interface ClearedLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  resolvedCount: number;
  isYou: boolean;
}

const CLEARED_TOP_N = 10;
const CLEARED_LOOKBACK_DAYS = 7;

/**
 * "Misconception champions" — top learners by # misconceptions resolved in the
 * last 7 days, course-scoped (only counts misconceptions testable in this
 * course's quiz options). Excludes opted-out users. Empty list when no course
 * has any testable misconceptions or no resolutions in the window.
 */
export async function getClearedChampionsLeaderboard(
  courseId: string,
  currentUserId: string | null,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<{ entries: ClearedLeaderboardEntry[]; lookbackDays: number }> {
  const since = new Date(now.getTime() - CLEARED_LOOKBACK_DAYS * 24 * 3600 * 1000);

  // Misconceptions testable in this course.
  const courseMcRows = await db.questionOption.findMany({
    where: {
      misconceptionId: { not: null },
      question: { quiz: { courseId } },
    },
    select: { misconceptionId: true },
    distinct: ["misconceptionId"],
  });
  const courseMcIds = courseMcRows
    .map((r) => r.misconceptionId)
    .filter((x): x is string => x !== null);
  if (courseMcIds.length === 0) {
    return { entries: [], lookbackDays: CLEARED_LOOKBACK_DAYS };
  }

  // Resolutions are reliable to count from MisconceptionFlag (resolved=true,
  // resolvedAt within window) — one row per (user, misconception), so it
  // naturally dedupes re-resolutions in the same cycle.
  const flags = await db.misconceptionFlag.findMany({
    where: {
      resolved: true,
      resolvedAt: { gte: since },
      misconceptionId: { in: courseMcIds },
      user: { leaderboardOptOut: false },
    },
    select: { userId: true, user: { select: { displayName: true } } },
  });

  const counts = new Map<string, { displayName: string; count: number }>();
  for (const f of flags) {
    const prev = counts.get(f.userId);
    if (prev) prev.count += 1;
    else counts.set(f.userId, { displayName: f.user.displayName, count: 1 });
  }

  const sorted = Array.from(counts.entries())
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.count - a.count || a.userId.localeCompare(b.userId))
    .slice(0, CLEARED_TOP_N);

  return {
    entries: sorted.map((s, i) => ({
      rank: i + 1,
      userId: s.userId,
      displayName: s.displayName,
      resolvedCount: s.count,
      isYou: s.userId === currentUserId,
    })),
    lookbackDays: CLEARED_LOOKBACK_DAYS,
  };
}

export async function setLeaderboardOptOut(
  userId: string,
  optOut: boolean,
  db: PrismaClient = prisma,
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { leaderboardOptOut: optOut },
  });
}
