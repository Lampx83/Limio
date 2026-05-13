// Ranking board (Phase 1, P0) — live aggregation from XpTransaction with
// snapshot-based rank deltas. Postgres-only; Redis ZSET swap is a future
// optimization behind the same interface.
//
// Boundary semantics: "live" buckets are read from XpTransaction over the
// UTC range computed by periodRange(period, now). Once cron `closePeriod`
// runs for a (scope, courseId?, period, periodKey), the top-N is written
// to LeaderboardEntry — that snapshot is then used to compute the next
// period's `delta` (previousRank - currentRank, positive = climbed).

import { prisma, type PrismaClient } from "@feedbackme/db";
import { periodKeyOf, periodRange, type Period } from "./periodKey";

export type Scope = "global" | "course";

export interface BoardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  /** previousRank - currentRank. Positive = climbed. Null = no prior snapshot (new). */
  delta: number | null;
  isYou: boolean;
}

export interface BoardResponse {
  scope: Scope;
  courseId: string | null;
  period: Period;
  periodKey: string;
  entries: BoardEntry[];
  totalParticipants: number;
  /** Present when viewer has XP in this bucket; null when none / opted-out. */
  me: { rank: number; xp: number; delta: number | null } | null;
  selfOptedOut: boolean;
}

interface AggRow {
  userId: string;
  xp: bigint;
  displayName: string;
  avatarUrl: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface GetLeaderboardInput {
  scope: Scope;
  period: Period;
  courseId?: string | null;
  viewerId?: string | null;
  limit?: number;
  now?: Date;
}

export async function getLeaderboard(
  input: GetLeaderboardInput,
  db: PrismaClient = prisma,
): Promise<BoardResponse> {
  const now = input.now ?? new Date();
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const scope = input.scope;
  const period = input.period;
  const courseId = scope === "course" ? input.courseId ?? null : null;

  if (scope === "course" && !courseId) {
    throw new Error("getLeaderboard: courseId required when scope='course'");
  }

  const { start, end } = periodRange(period, now);
  const periodKey = periodKeyOf(period, now);

  // Aggregate XP per user across the bucket. amount > 0 excludes cap audit
  // rows (xp.capped.daily, speed-run rejects). Opt-out users are filtered
  // server-side so they cannot appear via any code path.
  const rows = courseId
    ? await db.$queryRaw<AggRow[]>`
        SELECT
          x."userId" AS "userId",
          SUM(x."amount")::bigint AS "xp",
          u."displayName" AS "displayName",
          u."avatarUrl" AS "avatarUrl"
        FROM "XpTransaction" x
        JOIN "User" u ON u.id = x."userId"
        WHERE x."occurredAt" >= ${start}
          AND x."occurredAt" < ${end}
          AND x."amount" > 0
          AND u."leaderboardOptOut" = false
          AND x."courseId" = ${courseId}
        GROUP BY x."userId", u."displayName", u."avatarUrl"
        HAVING SUM(x."amount") > 0
        ORDER BY "xp" DESC, x."userId" ASC
      `
    : await db.$queryRaw<AggRow[]>`
        SELECT
          x."userId" AS "userId",
          SUM(x."amount")::bigint AS "xp",
          u."displayName" AS "displayName",
          u."avatarUrl" AS "avatarUrl"
        FROM "XpTransaction" x
        JOIN "User" u ON u.id = x."userId"
        WHERE x."occurredAt" >= ${start}
          AND x."occurredAt" < ${end}
          AND x."amount" > 0
          AND u."leaderboardOptOut" = false
        GROUP BY x."userId", u."displayName", u."avatarUrl"
        HAVING SUM(x."amount") > 0
        ORDER BY "xp" DESC, x."userId" ASC
      `;

  const totalParticipants = rows.length;
  const top = rows.slice(0, limit);

  // Build a lookup for previous-period ranks (for delta). Only needed for
  // top entries + the viewer.
  const prevKey = previousPeriodKey(period, now);
  const interestedUserIds = new Set<string>(top.map((r) => r.userId));
  if (input.viewerId) interestedUserIds.add(input.viewerId);

  const prevRanks =
    prevKey === null || interestedUserIds.size === 0
      ? new Map<string, number>()
      : await loadPrevRanks(db, {
          scope,
          courseId,
          period,
          periodKey: prevKey,
          userIds: Array.from(interestedUserIds),
        });

  const entries: BoardEntry[] = top.map((r, i) => {
    const rank = i + 1;
    const prev = prevRanks.get(r.userId);
    return {
      rank,
      userId: r.userId,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      xp: Number(r.xp),
      delta: prev == null ? null : prev - rank,
      isYou: r.userId === input.viewerId,
    };
  });

  // Viewer's own rank (if any XP this bucket) + opt-out flag.
  let selfOptedOut = false;
  let me: BoardResponse["me"] = null;
  if (input.viewerId) {
    const u = await db.user.findUnique({
      where: { id: input.viewerId },
      select: { leaderboardOptOut: true },
    });
    selfOptedOut = u?.leaderboardOptOut ?? false;

    if (!selfOptedOut) {
      const idx = rows.findIndex((r) => r.userId === input.viewerId);
      if (idx >= 0) {
        const rank = idx + 1;
        const xp = Number(rows[idx]!.xp);
        const prev = prevRanks.get(input.viewerId);
        me = { rank, xp, delta: prev == null ? null : prev - rank };
      }
    }
  }

  return {
    scope,
    courseId,
    period,
    periodKey,
    entries,
    totalParticipants,
    me,
    selfOptedOut,
  };
}

// Compute the periodKey of the bucket immediately before `now`'s bucket.
// Returns null for all_time (no previous bucket → no delta).
export function previousPeriodKey(period: Period, now: Date): string | null {
  if (period === "all_time") return null;
  const { start } = periodRange(period, now);
  // One millisecond before this bucket's start lands in the previous bucket.
  const prevInstant = new Date(start.getTime() - 1);
  return periodKeyOf(period, prevInstant);
}

async function loadPrevRanks(
  db: PrismaClient,
  args: {
    scope: Scope;
    courseId: string | null;
    period: Period;
    periodKey: string;
    userIds: string[];
  },
): Promise<Map<string, number>> {
  const snapshots = await db.leaderboardEntry.findMany({
    where: {
      scope: args.scope,
      courseId: args.courseId,
      period: args.period,
      periodKey: args.periodKey,
      userId: { in: args.userIds },
    },
    select: { userId: true, rank: true },
  });
  return new Map(snapshots.map((s) => [s.userId, s.rank]));
}
