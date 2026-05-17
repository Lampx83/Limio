import { NextResponse } from "next/server";
import { forceSubmitAttemptMarkOnly } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { recordStatus } from "@/lib/exam-live-bus";
import { enqueueAutoGrade } from "@/lib/queue/autoGradeJob";

export const runtime = "nodejs";

/**
 * A5.3.5 — Instructor force-submits an in-progress attempt with a reason.
 *
 * Tintin: marks the attempt + emits audit events sync; enqueues BullMQ
 * grading job so the instructor click returns immediately.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const actorUserId = await requireUserId();
  if (!actorUserId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  const reason = (body as { reason?: unknown })?.reason;
  try {
    const r = await forceSubmitAttemptMarkOnly(actorUserId, params.id, reason);
    await recordStatus(params.id, r.status === "in_progress" ? "submitted" : r.status);
    if (!r.alreadyFinalized) {
      enqueueAutoGrade(params.id).catch((err) => {
        console.error(
          `[force-submit] enqueueAutoGrade failed for ${params.id}:`,
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
