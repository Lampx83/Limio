import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

const STATUS_LABEL: Record<string, string> = {
  submitted: "Đã nộp",
  graded: "Đã chấm",
  pending: "Chờ chấm",
  late: "Nộp muộn",
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

  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      assignment: { lesson: { module: { courseId: params.courseId } } },
    },
    include: {
      user: { select: { displayName: true, email: true } },
      grader: { select: { displayName: true, email: true } },
      assignment: {
        select: {
          title: true,
          maxScore: true,
          dueAt: true,
          lesson: {
            select: {
              title: true,
              module: { select: { title: true } },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const rows = submissions.map((s) => {
    const scorePct =
      s.score !== null && s.assignment.maxScore > 0
        ? Math.round((s.score / s.assignment.maxScore) * 1000) / 10
        : "";
    return {
      Email: s.user.email,
      "Họ tên": s.user.displayName ?? "",
      Module: s.assignment.lesson.module.title,
      "Bài học": s.assignment.lesson.title,
      Assignment: s.assignment.title,
      "Trạng thái": STATUS_LABEL[s.status] ?? s.status,
      Điểm: s.score ?? "",
      "Điểm tối đa": s.assignment.maxScore,
      "Điểm (%)": scorePct,
      "Hạn nộp": s.assignment.dueAt,
      "Nộp lúc": s.submittedAt,
      "Chấm lúc": s.gradedAt,
      "Người chấm":
        s.grader?.displayName ?? s.grader?.email ?? "",
    };
  });

  const filename = `gradebook-assignment-${course.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, rows);
}
