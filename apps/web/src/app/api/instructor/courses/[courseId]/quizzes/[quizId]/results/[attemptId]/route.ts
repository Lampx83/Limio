import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import {
  assertCanEditCourse,
  CourseAuthzError,
  getAttemptResultAsInstructor,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * GET /api/instructor/courses/[courseId]/quizzes/[quizId]/results/[attemptId]
 *
 * Returns the full graded attempt (questions + responses + correctness +
 * misconception code) so the instructor drawer can render per-question detail.
 */
export async function GET(
  _req: Request,
  {
    params,
  }: { params: { courseId: string; quizId: string; attemptId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Verify the attempt belongs to this quiz + this course before authz check
  // — avoid leaking the existence of unrelated attempts.
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: params.attemptId },
    select: { quizId: true, quiz: { select: { courseId: true } } },
  });
  if (
    !attempt ||
    attempt.quizId !== params.quizId ||
    attempt.quiz.courseId !== params.courseId
  ) {
    return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
  }

  try {
    await assertCanEditCourse(userId, params.courseId);
  } catch (err) {
    if (err instanceof CourseAuthzError) {
      return NextResponse.json(
        { error: err.code === "not_found" ? "course_not_found" : "forbidden" },
        { status: err.code === "not_found" ? 404 : 403 },
      );
    }
    throw err;
  }

  try {
    const result = await getAttemptResultAsInstructor(params.attemptId);
    return NextResponse.json(result);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
