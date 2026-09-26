import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { getCourseGamificationStats } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

const COLUMNS = [
  "Họ tên",
  "Email",
  "Lớp",
  "XP",
  "Level",
  "Streak hiện tại",
  "Streak dài nhất",
  "Số badge",
  "Badge",
  "Ẩn khỏi BXH",
] as const;

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
        { error: err.code === "not_found" ? "course_not_found" : "forbidden" },
        { status: err.code === "not_found" ? 404 : 403 },
      );
    }
    throw err;
  }

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    select: { slug: true },
  });
  if (!course)
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });

  const sectionId = new URL(req.url).searchParams.get("section");
  const stats = await getCourseGamificationStats({
    courseId: params.courseId,
    sectionId,
  });

  const rows = stats.rows.map((r) => ({
    "Họ tên": r.displayName,
    Email: r.email,
    Lớp: r.sectionName ?? "",
    XP: r.xp,
    Level: r.level,
    "Streak hiện tại": r.currentStreak,
    "Streak dài nhất": r.longestStreak,
    "Số badge": r.badges.length,
    Badge: r.badges.map((b) => b.name).join("; "),
    "Ẩn khỏi BXH": r.leaderboardOptOut,
  }));

  const filename = `gamification-${course.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, rows, COLUMNS);
}
