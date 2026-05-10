import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

const STATUS_LABEL: Record<string, string> = {
  active: "Đang học",
  completed: "Đã hoàn thành",
  dropped: "Bỏ học",
  refunded: "Đã hoàn tiền",
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

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: params.courseId },
    include: {
      user: { select: { displayName: true, email: true } },
    },
    orderBy: { enrolledAt: "asc" },
  });

  // Resolve last lesson titles for any non-null lastLessonId.
  const lastLessonIds = enrollments
    .map((e) => e.lastLessonId)
    .filter((x): x is string => !!x);
  const lessonTitleMap = new Map<string, string>();
  if (lastLessonIds.length > 0) {
    const lessons = await prisma.lesson.findMany({
      where: { id: { in: lastLessonIds } },
      select: { id: true, title: true },
    });
    for (const l of lessons) lessonTitleMap.set(l.id, l.title);
  }

  const rows = enrollments.map((e) => ({
    "Họ tên": e.user.displayName ?? "",
    Email: e.user.email,
    "Trạng thái": STATUS_LABEL[e.status] ?? e.status,
    "Đăng ký lúc": e.enrolledAt,
    "Hoàn thành lúc": e.completedAt,
    "Bài học cuối": e.lastLessonId
      ? (lessonTitleMap.get(e.lastLessonId) ?? "—")
      : "",
    "Vị trí cuối (giây)": e.lastPositionSec ?? "",
    "Phiên bản course": e.courseVersion,
  }));

  const filename = `enrollment-${course.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, rows);
}
