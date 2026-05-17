import { NextResponse } from "next/server";
import { submitAttemptMarkOnly } from "@feedbackme/core-lms";
import { requireExamSubject } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { recordStatus } from "@/lib/exam-live-bus";
import { enqueueAutoGrade } from "@/lib/queue/autoGradeJob";

export const runtime = "nodejs";

/**
 * A7.5.1 — Manual submit.
 *
 * Tintin: marks the attempt as submitted synchronously (status + submittedAt
 * + ExamSubmitted event) then enqueues auto-grading as a BullMQ job. Returns
 * 200 immediately so 5K SV submitting near deadline don't queue on the
 * N-question grading $transaction. The result page surfaces `score` once the
 * worker fills it in (status flips to "graded").
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const subject = await requireExamSubject(params.id);
  if (!subject) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await submitAttemptMarkOnly(subject, params.id);
    await recordStatus(params.id, r.status === "in_progress" ? "submitted" : r.status);
    if (!r.alreadyFinalized) {
      // Fire-and-forget enqueue. If Redis is down, log and continue — the
      // cron tick will pick up auto-grading as a fallback (its mark-only
      // helper enqueues too).
      enqueueAutoGrade(params.id).catch((err) => {
        console.error(
          `[submit] enqueueAutoGrade failed for ${params.id}:`,
          err,
        );
      });
    }
    return NextResponse.json({
      status: r.status,
      autoScore: null,
      fullyGraded: false,
      gradingQueued: !r.alreadyFinalized,
    });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
