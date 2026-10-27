import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import {
  assertCanEditCourse,
  CourseAuthzError,
  learnerActivityWhere,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { activityLogLabel } from "@/lib/activityLogLabels";

export const runtime = "nodejs";

/** Log dài nên chỉ lấy các dòng mới nhất; muốn xem sâu hơn thì dùng các bản xuất CSV. */
const LIMIT = 100;

/**
 * Log hoạt động học viên của khoá: LearningEvent mới nhất của học viên đã ghi danh.
 * Chỉ trả nhãn hành động, tên bài học và thời điểm — không trả payload, vì payload
 * của một số sự kiện (câu trả lời, câu hỏi cho trợ lý AI) là nội dung riêng của học viên.
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

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: params.courseId },
    select: { userId: true },
  });
  if (enrollments.length === 0) return NextResponse.json({ events: [], limit: LIMIT });

  const events = await prisma.learningEvent.findMany({
    where: {
      courseId: params.courseId,
      userId: { in: enrollments.map((e) => e.userId) },
      ...learnerActivityWhere(),
    },
    orderBy: { occurredAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      userId: true,
      eventType: true,
      occurredAt: true,
      payload: true,
      user: { select: { displayName: true, email: true } },
    },
  });

  const lessonIdOf = (payload: unknown): string | null => {
    if (!payload || typeof payload !== "object") return null;
    const v = (payload as Record<string, unknown>).lessonId;
    return typeof v === "string" ? v : null;
  };

  const lessonIds = Array.from(
    new Set(events.map((e) => lessonIdOf(e.payload)).filter((x): x is string => !!x)),
  );
  const lessonTitle = new Map<string, string>();
  if (lessonIds.length > 0) {
    const lessons = await prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      select: { id: true, title: true },
    });
    for (const l of lessons) lessonTitle.set(l.id, l.title);
  }

  return NextResponse.json({
    limit: LIMIT,
    events: events.map((e) => {
      const lessonId = lessonIdOf(e.payload);
      return {
        id: e.id.toString(),
        occurredAt: e.occurredAt.toISOString(),
        student: e.user?.displayName || e.user?.email || "—",
        action: activityLogLabel(e.eventType),
        lesson: lessonId ? (lessonTitle.get(lessonId) ?? null) : null,
      };
    }),
  });
}
