import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { courseId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await assertCanEditCourse(userId, params.courseId);
  } catch (err) {
    if (err instanceof CourseAuthzError) {
      return NextResponse.json(
        {
          error: err.code === "not_found" ? "course_not_found" : "forbidden",
        },
        { status: err.code === "not_found" ? 404 : 403 },
      );
    }
    throw err;
  }

  const courseId = params.courseId;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [enrollGroups, lessonsCount, quizSubmittedAgg, activeLearnerRows] =
    await Promise.all([
      prisma.enrollment.groupBy({
        by: ["status"],
        where: { courseId },
        _count: true,
      }),
      prisma.lesson.count({ where: { module: { courseId } } }),
      prisma.quizAttempt.groupBy({
        by: ["passed"],
        where: { quiz: { courseId }, status: "submitted" },
        _count: true,
      }),
      prisma.learningEvent.findMany({
        where: {
          courseId,
          occurredAt: { gte: sevenDaysAgo },
          eventType: {
            in: [
              "lesson.viewed",
              "lesson.completed",
              "quiz.submitted",
              "assignment.submitted",
            ],
          },
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

  const enroll = { total: 0, active: 0, completed: 0, dropped: 0, refunded: 0 };
  for (const g of enrollGroups) {
    enroll.total += g._count;
    enroll[g.status] = g._count;
  }

  // Average lesson completion % across active+completed enrollments.
  let avgLessonCompletionPct = 0;
  if (lessonsCount > 0 && enroll.total > 0) {
    const completedLessonEvents = await prisma.learningEvent.findMany({
      where: { courseId, eventType: "lesson.completed" },
      select: { userId: true, payload: true },
    });
    const lessonsByUser = new Map<string, Set<string>>();
    for (const ev of completedLessonEvents) {
      const lessonId = (ev.payload as { lessonId?: string } | null)?.lessonId;
      if (!lessonId || !ev.userId) continue;
      let set = lessonsByUser.get(ev.userId);
      if (!set) {
        set = new Set();
        lessonsByUser.set(ev.userId, set);
      }
      set.add(lessonId);
    }
    let totalPct = 0;
    let learnerCount = 0;
    for (const [, set] of lessonsByUser) {
      totalPct += (set.size / lessonsCount) * 100;
      learnerCount++;
    }
    if (learnerCount > 0) {
      avgLessonCompletionPct = Math.round((totalPct / learnerCount) * 10) / 10;
    }
  }

  // Quiz pass rate (passed / submitted).
  let quizSubmitted = 0;
  let quizPassed = 0;
  for (const g of quizSubmittedAgg) {
    quizSubmitted += g._count;
    if (g.passed) quizPassed += g._count;
  }
  const quizPassRatePct =
    quizSubmitted > 0
      ? Math.round((quizPassed / quizSubmitted) * 1000) / 10
      : null;

  return NextResponse.json({
    enrollment: enroll,
    lessonsCount,
    avgLessonCompletionPct,
    quiz: {
      submitted: quizSubmitted,
      passed: quizPassed,
      passRatePct: quizPassRatePct,
    },
    activeLearners7d: activeLearnerRows.length,
  });
}
