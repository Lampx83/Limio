import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

/**
 * Long-format CSV: one row per (learner × lesson) for every lesson in the
 * course, regardless of whether the learner has touched it. Status derived
 * from LearningEvent (lesson.viewed → "Đã xem", lesson.completed → "Hoàn
 * thành"). Easier to pivot in Excel than wide-format.
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

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    select: { title: true, slug: true },
  });
  if (!course)
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });

  const [enrollments, modules, events] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: params.courseId },
      include: { user: { select: { displayName: true, email: true } } },
      orderBy: { enrolledAt: "asc" },
    }),
    prisma.module.findMany({
      where: { courseId: params.courseId },
      orderBy: { orderIndex: "asc" },
      include: {
        lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true } },
      },
    }),
    prisma.learningEvent.findMany({
      where: {
        courseId: params.courseId,
        eventType: { in: ["lesson.viewed", "lesson.completed"] },
      },
      select: { userId: true, eventType: true, payload: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    }),
  ]);

  // Build (userId, lessonId) → { status, lastSeen }
  const stateMap = new Map<
    string,
    { status: "Hoàn thành" | "Đã xem"; lastSeen: Date }
  >();
  for (const ev of events) {
    const lessonId = (ev.payload as { lessonId?: string } | null)?.lessonId;
    if (!lessonId) continue;
    const key = `${ev.userId}__${lessonId}`;
    const cur = stateMap.get(key);
    const isCompleted = ev.eventType === "lesson.completed";
    if (!cur) {
      stateMap.set(key, {
        status: isCompleted ? "Hoàn thành" : "Đã xem",
        lastSeen: ev.occurredAt,
      });
    } else {
      // Upgrade: viewed → completed; keep latest seen.
      if (isCompleted) cur.status = "Hoàn thành";
      if (ev.occurredAt > cur.lastSeen) cur.lastSeen = ev.occurredAt;
    }
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const e of enrollments) {
    for (const m of modules) {
      for (const l of m.lessons) {
        const s = stateMap.get(`${e.userId}__${l.id}`);
        rows.push({
          Email: e.user.email,
          "Họ tên": e.user.displayName ?? "",
          Module: m.title,
          "Bài học": l.title,
          "Trạng thái": s?.status ?? "Chưa bắt đầu",
          "Lần xem cuối": s?.lastSeen ?? "",
        });
      }
    }
  }

  const filename = `tien-do-bai-hoc-${course.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, rows);
}
