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
    },
    orderBy: { enrolledAt: "desc" },
    take: limit,
  });

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
      user: e.user,
    })),
  });
}
