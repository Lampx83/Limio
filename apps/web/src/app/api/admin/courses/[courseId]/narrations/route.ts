import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { listCourseNarrations } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { isFakeTts } from "@/lib/narration/tts";

export const runtime = "nodejs";

/** Quản trị: lời giảng / podcast của từng bài trong khoá, kèm trạng thái và tiến độ tạo giọng (trang tự hỏi lại mỗi vài giây). */
export async function GET(_req: Request, { params }: { params: { courseId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const course = await prisma.course.findUnique({ where: { id: params.courseId }, select: { id: true, title: true, slug: true } });
  if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const rows = await listCourseNarrations(course.id);
  return NextResponse.json({ course, rows, fakeTts: isFakeTts() }, { headers: { "cache-control": "no-store" } });
}
