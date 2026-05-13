// Snapshot writer for the ranking board. Runs from cron at VN+07 midnight
// (daily), Monday (weekly), 1st of month (monthly). Writes top-N of the
// JUST-ENDED bucket into LeaderboardEntry, then emits
// `leaderboard.updated` per top-N user so downstream (badges, notif) can
// react.
//
// Idempotent on (scope, courseId, period, periodKey, userId) via the
// unique key on LeaderboardEntry — re-running the same close is a no-op
// for ranks already written, and event emission uses eventKey scoped to
// the bucket.

import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { periodKeyOf, periodRange, type Period } from "./periodKey";
import type { Scope } from "./board";

interface AggRow {
  userId: string;
  xp: bigint;
}

export interface ClosePeriodInput {
  scope: Scope;
  /** Required when scope='course'. */
  courseId?: string | null;
  period: Period;
  /** "Now" for the close run. The bucket closed is the one immediately before. */
  asOf?: Date;
  /** Top-N rows persisted to LeaderboardEntry. Default 1000. */
  snapshotTop?: number;
  /** Events emitted only for the leading slice of the snapshot. Default 100. */
  notifyTop?: number;
}

export interface ClosePeriodResult {
  scope: Scope;
  courseId: string | null;
  period: Period;
  periodKey: string;
  rangeStart: Date;
  rangeEnd: Date;
  participants: number;
  snapshotWritten: number;
  eventsEmitted: number;
}

export async function closePeriod(
  input: ClosePeriodInput,
  db: PrismaClient = prisma,
): Promise<ClosePeriodResult> {
  const asOf = input.asOf ?? new Date();
  const scope = input.scope;
  const courseId = scope === "course" ? input.courseId ?? null : null;
  if (scope === "course" && !courseId) {
    throw new Error("closePeriod: courseId required when scope='course'");
  }
  if (input.period === "all_time") {
    // all_time has no bucket boundary; nothing to close.
    return {
      scope,
      courseId,
      period: "all_time",
      periodKey: "all_time",
      rangeStart: new Date(0),
      rangeEnd: new Date(0),
      participants: 0,
      snapshotWritten: 0,
      eventsEmitted: 0,
    };
  }

  const snapshotTop = input.snapshotTop ?? 1000;
  const notifyTop = input.notifyTop ?? 100;

  // The bucket we're closing ENDED at `now`'s bucket start (i.e. the bucket
  // containing (now - 1ms)). Reuse periodRange to get its UTC bounds.
  const currentStart = periodRange(input.period, asOf).start;
  const prevInstant = new Date(currentStart.getTime() - 1);
  const periodKey = periodKeyOf(input.period, prevInstant);
  const { start, end } = periodRange(input.period, prevInstant);

  const rows = courseId
    ? await db.$queryRaw<AggRow[]>`
        SELECT x."userId" AS "userId", SUM(x."amount")::bigint AS "xp"
        FROM "XpTransaction" x
        JOIN "User" u ON u.id = x."userId"
        WHERE x."occurredAt" >= ${start}
          AND x."occurredAt" < ${end}
          AND x."amount" > 0
          AND u."leaderboardOptOut" = false
          AND x."courseId" = ${courseId}
        GROUP BY x."userId"
        HAVING SUM(x."amount") > 0
        ORDER BY "xp" DESC, x."userId" ASC
        LIMIT ${snapshotTop}
      `
    : await db.$queryRaw<AggRow[]>`
        SELECT x."userId" AS "userId", SUM(x."amount")::bigint AS "xp"
        FROM "XpTransaction" x
        JOIN "User" u ON u.id = x."userId"
        WHERE x."occurredAt" >= ${start}
          AND x."occurredAt" < ${end}
          AND x."amount" > 0
          AND u."leaderboardOptOut" = false
        GROUP BY x."userId"
        HAVING SUM(x."amount") > 0
        ORDER BY "xp" DESC, x."userId" ASC
        LIMIT ${snapshotTop}
      `;

  if (rows.length === 0) {
    return {
      scope,
      courseId,
      period: input.period,
      periodKey,
      rangeStart: start,
      rangeEnd: end,
      participants: 0,
      snapshotWritten: 0,
      eventsEmitted: 0,
    };
  }

  const snapshot = rows.map((r, i) => ({
    scope,
    courseId,
    period: input.period,
    periodKey,
    userId: r.userId,
    rank: i + 1,
    xp: Number(r.xp),
  }));

  // Idempotency: filter out users already snapshotted for this bucket.
  // Postgres treats NULL as distinct in unique constraints, so the @@unique
  // on (scope, courseId, period, periodKey, userId) doesn't dedupe global
  // closes (courseId IS NULL). We dedupe in application code instead.
  const existing = await db.leaderboardEntry.findMany({
    where: {
      scope,
      courseId,
      period: input.period,
      periodKey,
      userId: { in: snapshot.map((s) => s.userId) },
    },
    select: { userId: true },
  });
  const alreadySnapped = new Set(existing.map((e) => e.userId));
  const toWrite = snapshot.filter((s) => !alreadySnapped.has(s.userId));
  const writeRes = toWrite.length
    ? await db.leaderboardEntry.createMany({ data: toWrite })
    : { count: 0 };

  // Emit leaderboard.updated for top notifyTop users. eventKey is the
  // bucket+user — pre-filter against existing keys so re-runs are quiet.
  const toNotify = snapshot.slice(0, notifyTop);
  const keys = toNotify.map(
    (r) => `leaderboard.updated:${r.scope}:${r.courseId ?? "_"}:${r.period}:${r.periodKey}:${r.userId}`,
  );
  const existingKeys = keys.length
    ? new Set(
        (
          await db.learningEvent.findMany({
            where: { eventKey: { in: keys } },
            select: { eventKey: true },
          })
        ).map((e) => e.eventKey!),
      )
    : new Set<string>();

  let eventsEmitted = 0;
  for (let i = 0; i < toNotify.length; i++) {
    const row = toNotify[i]!;
    const eventKey = keys[i]!;
    if (existingKeys.has(eventKey)) continue;
    await db.learningEvent.create({
      data: {
        userId: row.userId,
        courseId: row.courseId,
        eventType: LearningEventType.LeaderboardUpdated,
        eventKey,
        payload: {
          scope: row.scope,
          courseId: row.courseId,
          period: row.period,
          periodKey: row.periodKey,
          rank: row.rank,
          xp: row.xp,
          totalParticipants: rows.length,
        } as Prisma.InputJsonValue,
      },
    });
    eventsEmitted += 1;
  }

  return {
    scope,
    courseId,
    period: input.period,
    periodKey,
    rangeStart: start,
    rangeEnd: end,
    participants: rows.length,
    snapshotWritten: writeRes.count,
    eventsEmitted,
  };
}
