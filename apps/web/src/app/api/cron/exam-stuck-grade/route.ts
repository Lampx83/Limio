import { NextResponse } from "next/server";
import { gradeStuckSubmittedAttempts } from "@feedbackme/core-lms";

export const runtime = "nodejs";

/**
 * Recovery cron — runs every minute via Docker cron sidecar. Finds
 * ExamAttempts stuck in `submitted` / `auto_submitted` with score=null
 * (typically when the BullMQ worker was down or Redis disconnected at
 * submit time so the auto-grade job never ran) and re-grades them inline.
 *
 * Synchronous grading — no dependency on the worker process. Cap batch
 * size per tick so a giant backlog doesn't block the cron beat.
 *
 * Auth via shared CRON_SECRET. Idempotent — re-running picks up nothing
 * because graded attempts are excluded by the WHERE clause.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await gradeStuckSubmittedAttempts();
  return NextResponse.json({
    ok: true,
    processed: r.processed,
    errors: r.errors,
  });
}
