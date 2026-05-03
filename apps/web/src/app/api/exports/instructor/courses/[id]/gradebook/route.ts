import { NextResponse } from "next/server";
import { canEditCourse } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

/**
 * Course gradebook CSV — one row per (learner, item). Items = quizzes +
 * assignments. Columns: learner_email, learner_name, item_type, item_title,
 * score_pct, raw_score, max_score, status, submitted_at.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const courseId = params.id;
  if (!(await canEditCourse(userId, courseId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true },
  });
  if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
    },
  });
  const learnerIds = enrollments.map((e) => e.user.id);

  const [quizAttempts, submissions] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: {
        userId: { in: learnerIds },
        status: "submitted",
        quiz: { courseId },
      },
      orderBy: { submittedAt: "desc" },
      include: {
        quiz: { select: { title: true, passThresholdPct: true } },
      },
    }),
    prisma.assignmentSubmission.findMany({
      where: {
        userId: { in: learnerIds },
        assignment: { lesson: { module: { courseId } } },
      },
      orderBy: { submittedAt: "desc" },
      include: {
        assignment: { select: { title: true, maxScore: true } },
      },
    }),
  ]);

  const userMap = new Map(
    enrollments.map((e) => [
      e.user.id,
      { email: e.user.email, name: e.user.displayName },
    ]),
  );

  const rows: Array<Record<string, unknown>> = [];
  for (const a of quizAttempts) {
    const u = userMap.get(a.userId);
    rows.push({
      learner_email: u?.email ?? "",
      learner_name: u?.name ?? "",
      item_type: "quiz",
      item_title: a.quiz.title,
      score_pct: a.scorePct ?? 0,
      passed: a.passed ?? false,
      pass_threshold_pct: a.quiz.passThresholdPct,
      submitted_at: a.submittedAt,
    });
  }
  for (const s of submissions) {
    const u = userMap.get(s.userId);
    rows.push({
      learner_email: u?.email ?? "",
      learner_name: u?.name ?? "",
      item_type: "assignment",
      item_title: s.assignment.title,
      score_pct:
        s.score !== null
          ? Math.round((s.score / s.assignment.maxScore) * 1000) / 10
          : null,
      raw_score: s.score,
      max_score: s.assignment.maxScore,
      status: s.status,
      submitted_at: s.submittedAt,
      graded_at: s.gradedAt,
    });
  }

  const filename = `gradebook-${course.title.replace(/[^\w]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, rows);
}
