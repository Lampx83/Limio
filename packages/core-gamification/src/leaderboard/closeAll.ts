// Cron orchestrator — decides which leaderboard buckets just closed at
// VN+07 midnight and snapshots them. Idempotent: relies on closePeriod's
// dedupe so cron can be re-run safely.
//
// Schedule (cron expression uses container TZ = Asia/Ho_Chi_Minh):
//   `0 0 * * *`  → run at 00:00 VN every day, asOf=now
// Inside, we close:
//   - daily      (always)
//   - weekly     (only when VN today is Monday — yesterday's week just ended)
//   - monthly    (only when VN today is day 1 — last month just ended)
// "all_time" never closes — it's the running cumulative leaderboard.

import { prisma, type PrismaClient } from "@feedbackme/db";
import { closePeriod, type ClosePeriodResult } from "./closePeriod";
import type { Period } from "./periodKey";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function vnParts(asOf: Date): { dayOfMonth: number; dayOfWeek: number } {
  const vn = new Date(asOf.getTime() + VN_OFFSET_MS);
  return {
    dayOfMonth: vn.getUTCDate(),
    // 1 = Mon … 7 = Sun (ISO).
    dayOfWeek: vn.getUTCDay() === 0 ? 7 : vn.getUTCDay(),
  };
}

export function periodsDueAt(asOf: Date): Period[] {
  const { dayOfMonth, dayOfWeek } = vnParts(asOf);
  const due: Period[] = ["daily"];
  if (dayOfWeek === 1) due.push("weekly");
  if (dayOfMonth === 1) due.push("monthly");
  return due;
}

export interface CloseAllResult {
  asOf: Date;
  periods: Period[];
  results: ClosePeriodResult[];
}

export async function closeDueLeaderboards(
  asOf: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<CloseAllResult> {
  const periods = periodsDueAt(asOf);
  const results: ClosePeriodResult[] = [];

  // Course-scoped closes need the set of published courses. Closing for
  // drafts is harmless (no XP) but wastes a query each — filter to
  // published only.
  const publishedCourses = await db.course.findMany({
    where: { status: "published" },
    select: { id: true },
  });

  for (const period of periods) {
    // Global scope.
    results.push(await closePeriod({ scope: "global", period, asOf }, db));
    // Course scope — one snapshot per (course, period).
    for (const c of publishedCourses) {
      results.push(await closePeriod({ scope: "course", courseId: c.id, period, asOf }, db));
    }
  }

  return { asOf, periods, results };
}
