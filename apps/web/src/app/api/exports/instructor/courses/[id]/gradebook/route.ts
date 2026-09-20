import { NextResponse } from "next/server";
import { canEditCourse } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

const ITEM_TYPE: Record<string, string> = {
  quiz: "Quiz",
  assignment: "Bài tập",
};

const SUBMISSION_STATUS: Record<string, string> = {
  submitted: "Đã nộp",
  graded: "Đã chấm",
  pending: "Chờ chấm",
  late: "Nộp muộn",
};

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
        quiz: { select: { title: true } },
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
      "Họ tên học viên": u?.name ?? "",
      "Email học viên": u?.email ?? "",
      "Loại": ITEM_TYPE.quiz,
      "Tiêu đề": a.quiz.title,
      "Điểm (%)": a.scorePct ?? 0,
      "Nộp lúc": a.submittedAt,
    });
  }

  for (const s of submissions) {
    const u = userMap.get(s.userId);
    const scorePct =
      s.score !== null
        ? `${Math.round((s.score / s.assignment.maxScore) * 1000) / 10}%`
        : "";
    rows.push({
      "Họ tên học viên": u?.name ?? "",
      "Email học viên": u?.email ?? "",
      "Loại": ITEM_TYPE.assignment,
      "Tiêu đề": s.assignment.title,
      "Điểm": s.score !== null ? `${s.score}/${s.assignment.maxScore}` : "Chưa chấm",
      "Điểm (%)": scorePct,
      "Trạng thái": SUBMISSION_STATUS[s.status] ?? s.status,
      "Nộp lúc": s.submittedAt,
      "Chấm lúc": s.gradedAt ?? "",
    });
  }

  const filename = `bang-diem-${course.title.replace(/[^\w\s]/g, "").trim().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, rows);
}
