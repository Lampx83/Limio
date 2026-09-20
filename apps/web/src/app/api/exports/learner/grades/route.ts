import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

/**
 * Export learner's grades across all courses: quiz attempts (score)
 * + assignment submissions (graded score). One row per attempt/submission.
 */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [quizAttempts, submissions] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { userId, status: "submitted" },
      orderBy: { submittedAt: "desc" },
      include: {
        quiz: {
          select: {
            title: true,
            courseId: true,
          },
        },
      },
    }),
    prisma.assignmentSubmission.findMany({
      where: { userId },
      orderBy: { submittedAt: "desc" },
      include: {
        assignment: {
          select: {
            title: true,
            maxScore: true,
            lesson: {
              select: {
                module: {
                  select: {
                    courseId: true,
                    course: { select: { title: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  // Resolve quiz courseIds → course titles in one round trip.
  const quizCourseIds = Array.from(
    new Set(quizAttempts.map((a) => a.quiz.courseId).filter((x): x is string => x !== null)),
  );
  const courses =
    quizCourseIds.length === 0
      ? []
      : await prisma.course.findMany({
          where: { id: { in: quizCourseIds } },
          select: { id: true, title: true },
        });
  const courseMap = new Map(courses.map((c) => [c.id, c.title]));

  const rows: Array<Record<string, unknown>> = [];
  for (const a of quizAttempts) {
    rows.push({
      type: "quiz",
      courseTitle: a.quiz.courseId ? courseMap.get(a.quiz.courseId) ?? "" : "",
      itemTitle: a.quiz.title,
      scorePct: a.scorePct ?? 0,
      submittedAt: a.submittedAt,
    });
  }
  for (const s of submissions) {
    rows.push({
      type: "assignment",
      courseTitle: s.assignment.lesson?.module.course.title ?? "",
      itemTitle: s.assignment.title,
      scorePct:
        s.score !== null
          ? Math.round((s.score / s.assignment.maxScore) * 1000) / 10
          : null,
      score: s.score,
      maxScore: s.assignment.maxScore,
      status: s.status,
      submittedAt: s.submittedAt,
      gradedAt: s.gradedAt,
    });
  }

  const filename = `feedbackme-grades-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, rows);
}
