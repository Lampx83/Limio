import { NextResponse } from "next/server";
import { closeDueLeaderboards } from "@feedbackme/core-gamification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Snapshots all leaderboard buckets that just closed at VN+07 midnight.
 * Cron container TZ = Asia/Ho_Chi_Minh, so `0 0 * * *` fires at 00:00 VN.
 * Closes daily always, weekly on Monday (VN), monthly on day 1 (VN).
 * Idempotent — safe to re-run.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await closeDueLeaderboards();
  const summary = {
    asOf: res.asOf.toISOString(),
    periods: res.periods,
    closes: res.results.length,
    snapshotRows: res.results.reduce((n, r) => n + r.snapshotWritten, 0),
    events: res.results.reduce((n, r) => n + r.eventsEmitted, 0),
  };
  return NextResponse.json({ ok: true, ...summary });
}
