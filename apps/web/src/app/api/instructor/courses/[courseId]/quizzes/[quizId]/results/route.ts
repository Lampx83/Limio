import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * GET /api/instructor/courses/[courseId]/quizzes/[quizId]/results
 *
 * Returns:
 *   - quiz metadata (title, passThresholdPct, lesson/module, totalQuestions)
 *   - stats (totalAttempts, submittedCount, passRate, avgScorePct, avgDurationMs)
 *   - attempts: list of QuizAttempt with user info, status, score, attempt-index
 *
 * Permission: caller must be a course instructor (`assertCanEditCourse`).
 */
export async function GET(
  _req: Request,
  { params }: { params: { courseId: string; quizId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  const quiz = await prisma.quiz.findUnique({
    where: { id: params.quizId },
    select: {
      id: true,
      title: true,
      passThresholdPct: true,
      courseId: true,
      lesson: {
        select: { title: true, module: { select: { title: true } } },
      },
      _count: { select: { questions: true } },
    },
  });
  if (!quiz || quiz.courseId !== params.courseId) {
    return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
  }

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: params.quizId },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
      _count: { select: { responses: true } },
    },
    orderBy: [{ userId: "asc" }, { startedAt: "asc" }],
  });

  // Index attempt-number per user (1-based) so the UI can show "Lần thứ N".
  const seenByUser = new Map<string, number>();
  const enriched = attempts.map((a) => {
    const n = (seenByUser.get(a.userId) ?? 0) + 1;
    seenByUser.set(a.userId, n);
    const durationMs =
      a.submittedAt && a.startedAt
        ? a.submittedAt.getTime() - a.startedAt.getTime()
        : null;
    return {
      id: a.id,
      user: a.user,
      status: a.status,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      scorePct: a.scorePct,
      passed: a.passed,
      attemptIndex: n,
      responseCount: a._count.responses,
      durationMs,
    };
  });

  // Stats — derived from submitted attempts only.
  const submitted = enriched.filter((a) => a.status === "submitted");
  const passed = submitted.filter((a) => a.passed === true);
  const avgScore =
    submitted.length > 0
      ? submitted.reduce((s, a) => s + (a.scorePct ?? 0), 0) / submitted.length
      : null;
  const durations = submitted
    .map((a) => a.durationMs)
    .filter((d): d is number => d != null);
  const avgDuration =
    durations.length > 0
      ? durations.reduce((s, d) => s + d, 0) / durations.length
      : null;

  // Sort by latest attempt first for default display.
  enriched.sort(
    (a, b) =>
      (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
  );

  return NextResponse.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      passThresholdPct: quiz.passThresholdPct,
      totalQuestions: quiz._count.questions,
      lessonTitle: quiz.lesson?.title ?? null,
      moduleTitle: quiz.lesson?.module.title ?? null,
    },
    stats: {
      totalAttempts: enriched.length,
      submittedCount: submitted.length,
      uniqueLearners: seenByUser.size,
      passRate:
        submitted.length > 0 ? passed.length / submitted.length : null,
      avgScorePct: avgScore,
      avgDurationMs: avgDuration,
    },
    attempts: enriched,
  });
}
