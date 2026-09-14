import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
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
  // A6.4 — Vấn đáp AI không có ExamQuestion nên applyAutoGradingForAttempt từ
  // chối thẳng exam.kind="oral" (chấm qua tab Chấm bài, không auto-grade theo
  // câu). Enqueue job cho các attempt này chỉ tạo job lỗi lặp lại vô ích —
  // tra kind trước để bỏ qua, không phải để chặn lỗi.
  const oralAttemptIds =
    r.attemptIds.length === 0
      ? new Set<string>()
      : new Set(
          (
            await prisma.examAttempt.findMany({
              where: { id: { in: r.attemptIds }, exam: { kind: "oral" } },
              select: { id: true },
            })
          ).map((a) => a.id),
        );
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
    if (oralAttemptIds.has(attemptId)) continue;
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
