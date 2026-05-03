import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { startAttempt } from "@feedbackme/core-lms";
import { onQuizStarted } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export async function POST(
  _req: Request,
  { params }: { params: { quizId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await startAttempt(userId, params.quizId);

    // Gamification: only fire on a fresh attempt creation.
    let badges: Awaited<ReturnType<typeof onQuizStarted>> | null = null;
    if (result.created) {
      const quiz = await prisma.quiz.findUnique({
        where: { id: params.quizId },
        select: { courseId: true },
      });
      if (quiz?.courseId) {
        badges = await onQuizStarted({
          userId,
          courseId: quiz.courseId,
          quizId: params.quizId,
          attemptId: result.attemptId,
        });
      }
    }

    return NextResponse.json({ ...result, badges }, {
      status: result.created ? 201 : 200,
    });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
