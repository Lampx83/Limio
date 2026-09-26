import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { getRecentXpTransactions } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Giao dịch XP gần đây của 1 học viên trong khoá — drill-down của tab Gamification. */
export async function GET(
  req: Request,
  { params }: { params: { courseId: string } },
) {
  const viewerId = await requireUserId();
  if (!viewerId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await assertCanEditCourse(viewerId, params.courseId);
  } catch (err) {
    if (err instanceof CourseAuthzError) {
      return NextResponse.json(
        { error: err.code === "not_found" ? "course_not_found" : "forbidden" },
        { status: err.code === "not_found" ? 404 : 403 },
      );
    }
    throw err;
  }

  const learnerId = new URL(req.url).searchParams.get("userId");
  if (!learnerId)
    return NextResponse.json({ error: "missing_userId" }, { status: 400 });

  // Chỉ trả cho người thật sự ghi danh khoá này — không dùng endpoint để dò user khác.
  const enrolled = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: learnerId, courseId: params.courseId } },
    select: { id: true },
  });
  if (!enrolled)
    return NextResponse.json({ error: "not_enrolled" }, { status: 404 });

  const transactions = await getRecentXpTransactions(params.courseId, learnerId);
  return NextResponse.json({ transactions });
}
