import { NextResponse } from "next/server";
import { autoSubmitExpiredAttemptsMarkOnly } from "@feedbackme/core-lms";
import { enqueueAutoGrade } from "@/lib/queue/autoGradeJob";

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
