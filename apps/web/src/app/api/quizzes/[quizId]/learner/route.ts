import { NextResponse } from "next/server";
import { getLearnerSafeQuiz } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fetch a quiz shaped for learner consumption — strips `isCorrect` and
 * misconception linkage from options. Used by the in-video cuepoint
 * overlay so it can render questions without leaking answers via the JS
 * bundle. Authenticated only; we don't gate by enrollment here because
 * the same payload also drives instructor preview.
 */
export async function GET(
  _req: Request,
  { params }: { params: { quizId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const quiz = await getLearnerSafeQuiz(params.quizId);
  if (!quiz) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ quiz });
}
