import { NextResponse } from "next/server";
import { autoSubmitExpiredAttemptsMarkOnly } from "@feedbackme/core-lms";
import { enqueueAutoGrade } from "@/lib/queue/autoGradeJob";
import { recordStatus } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/**
 * Cron handler — Docker cron sidecar curls this every minute. Auth via shared
 * CRON_SECRET. Idempotent: if no attempts have passed deadline since the last
 * call, it returns processed=0.
 *
 * Tintin: marks expired attempts as auto-submitted (1 UPDATE + 1 event each)
 * then enqueues BullMQ auto-grade jobs. Prevents the cron tick from spending
 * minutes serially running per-question grading transactions at the deadline.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await autoSubmitExpiredAttemptsMarkOnly();
  let queued = 0;
  let queueErrors = 0;
  for (const attemptId of r.attemptIds) {
    // Sync Redis Hash so the live monitor reflects the new status. Without
    // this, the attempt stays "in_progress" in Redis even though DB has
    // "auto_submitted" — instructor sees stale "đang thi" rows on the live
    // dashboard. Manual submit endpoint already syncs; cron path was missing
    // it. Best-effort: Redis downtime shouldn't block the grading enqueue.
    try {
      await recordStatus(attemptId, "auto_submitted");
    } catch (err) {
      console.error(
        `[cron exam-autosubmit] recordStatus failed for ${attemptId}:`,
        err,
      );
    }
    try {
      await enqueueAutoGrade(attemptId);
      queued++;
    } catch (err) {
      queueErrors++;
      console.error(
        `[cron exam-autosubmit] enqueueAutoGrade failed for ${attemptId}:`,
        err,
      );
    }
  }
  return NextResponse.json({
    ok: true,
    processed: r.processed,
    errors: r.errors,
    queued,
    queueErrors,
  });
}
