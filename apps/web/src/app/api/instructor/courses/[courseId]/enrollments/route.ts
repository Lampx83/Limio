import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const VALID_STATUSES = ["active", "completed", "dropped", "refunded"] as const;
type Status = (typeof VALID_STATUSES)[number];

export async function GET(
  req: Request,
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

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status: Status | null = VALID_STATUSES.includes(statusParam as Status)
    ? (statusParam as Status)
    : null;
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? 100) || 100,
    500,
  );

  // Stats by status — single groupBy.
  const grouped = await prisma.enrollment.groupBy({
    by: ["status"],
    where: { courseId: params.courseId },
    _count: true,
  });
  const stats = {
    total: 0,
    active: 0,
    completed: 0,
    dropped: 0,
    refunded: 0,
    expired: 0,
  };
  for (const g of grouped) {
    stats.total += g._count;
    stats[g.status] = g._count;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId: params.courseId,
      ...(status ? { status } : {}),
      ...(q
        ? {
            user: {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { displayName: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      // Danh sách học viên phải nói được ai đã vào lớp nào. Không có cột này
      // thì người rơi vào lớp mặc định trông y hệt người đã được xếp lớp.
      section: { select: { name: true, isDefault: true } },
    },
    orderBy: { enrolledAt: "desc" },
    take: limit,
  });

  // Hoạt động gần nhất mỗi học viên trong khoá — không có cột nào cho việc
  // này trên Enrollment (đúng §6.1: state phái sinh đọc từ LearningEvent,
  // không denormalize thêm), nên lấy occurredAt mới nhất mỗi userId.
  const lastActivityByUser = new Map<string, string>();
  if (enrollments.length > 0) {
    const lastEvents = await prisma.learningEvent.groupBy({
      by: ["userId"],
      where: {
        userId: { in: enrollments.map((e) => e.userId) },
        courseId: params.courseId,
      },
      _max: { occurredAt: true },
    });
    for (const ev of lastEvents) {
      if (ev.userId && ev._max.occurredAt) {
        lastActivityByUser.set(ev.userId, ev._max.occurredAt.toISOString());
      }
    }
  }

  return NextResponse.json({
    stats,
    enrollments: enrollments.map((e) => ({
      id: e.id,
      status: e.status,
      courseVersion: e.courseVersion,
      enrolledAt: e.enrolledAt.toISOString(),
      completedAt: e.completedAt?.toISOString() ?? null,
      lastLessonId: e.lastLessonId,
      lastPositionSec: e.lastPositionSec,
      lastActivityAt: lastActivityByUser.get(e.userId) ?? null,
      section: { name: e.section.name, isDefault: e.section.isDefault },
      user: e.user,
    })),
  });
}
