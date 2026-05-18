import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * GET /api/instructor/courses/[courseId]/quizzes
 *
 * Trả list quiz thuộc course (qua relation Lesson → Module → Course HOẶC
 * `Quiz.courseId` trực tiếp cho quiz course-level), kèm số attempt đã submit
 * để GV biết có dữ liệu để xem hay không.
 */
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
        { error: err.code === "not_found" ? "course_not_found" : "forbidden" },
        { status: err.code === "not_found" ? 404 : 403 },
      );
    }
    throw err;
  }

  const quizzes = await prisma.quiz.findMany({
    where: { courseId: params.courseId },
    select: {
      id: true,
      title: true,
      passThresholdPct: true,
      lesson: {
        select: {
          title: true,
          module: { select: { title: true, orderIndex: true } },
          orderIndex: true,
        },
      },
      _count: { select: { attempts: true, questions: true } },
    },
    orderBy: [
      { lesson: { module: { orderIndex: "asc" } } },
      { lesson: { orderIndex: "asc" } },
      { title: "asc" },
    ],
  });

  return NextResponse.json({
    quizzes: quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      passThresholdPct: q.passThresholdPct,
      moduleTitle: q.lesson?.module.title ?? null,
      lessonTitle: q.lesson?.title ?? null,
      attemptCount: q._count.attempts,
      questionCount: q._count.questions,
    })),
  });
}
