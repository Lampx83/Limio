import { NextResponse } from "next/server";
import { gradeInlineCuepoint } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Grade a batch of in-video cuepoint answers. Returns per-question
 * correctness; emits `video.cuepoint.passed` (idempotent per learner +
 * cuepoint) when all are correct. Does NOT touch QuizAttempt — these
 * are formative checks, not graded attempts.
 */
export async function POST(
  req: Request,
  { params }: { params: { quizId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const result = await gradeInlineCuepoint(userId, params.quizId, body);
    return NextResponse.json(result);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    console.error("[POST /api/quizzes/:quizId/inline-grade] unexpected", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
