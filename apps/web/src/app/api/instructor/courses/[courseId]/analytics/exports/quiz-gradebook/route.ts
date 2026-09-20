import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "Đang làm",
  submitted: "Đã nộp",
  abandoned: "Bỏ giữa chừng",
};

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

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    select: { title: true, slug: true },
  });
  if (!course)
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });

  const attempts = await prisma.quizAttempt.findMany({
    where: { quiz: { courseId: params.courseId } },
    include: {
      user: { select: { displayName: true, email: true } },
      quiz: {
        select: {
          title: true,
          lesson: {
            select: {
              title: true,
              module: { select: { title: true } },
            },
          },
        },
      },
      _count: { select: { responses: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  const rows = attempts.map((a) => ({
    Email: a.user.email,
    "Họ tên": a.user.displayName ?? "",
    Module: a.quiz.lesson?.module.title ?? "—",
    "Bài học": a.quiz.lesson?.title ?? "—",
    Quiz: a.quiz.title,
    "Trạng thái": STATUS_LABEL[a.status] ?? a.status,
    "Điểm (%)": a.scorePct ?? "",
    "Số câu trả lời": a._count.responses,
    "Bắt đầu lúc": a.startedAt,
    "Nộp lúc": a.submittedAt,
  }));

  const filename = `gradebook-quiz-${course.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, rows);
}
