import { NextResponse } from "next/server";
import { gradeSubmission } from "@feedbackme/core-lms";
import { onAssignmentGraded } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    await gradeSubmission(userId, params.id, body);
    // C5.x — if this assignment backs a MANUAL_REVIEW tournament mission, fold
    // the score into MissionSubmission. No-op for course-only assignments.
    await onAssignmentGraded(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
