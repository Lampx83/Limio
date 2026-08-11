import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { canEditCourse, regradeExamAttempts } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/exams/[id]/regrade — chấm lại TẤT CẢ bài đã nộp của đề theo đáp án
 * hiện tại (sau khi instructor sửa nội dung/đáp án đề đã publish). Authz:
 * canEditCourse. Bỏ qua câu tự luận (giữ điểm chấm tay).
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { courseId: true },
  });
  if (!exam) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await canEditCourse(userId, exam.courseId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const r = await regradeExamAttempts(userId, params.id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
