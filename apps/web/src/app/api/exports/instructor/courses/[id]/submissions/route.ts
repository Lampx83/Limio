import { NextResponse } from "next/server";
import { canEditCourse } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

const SUBMISSION_STATUS: Record<string, string> = {
  submitted: "Đã nộp",
  graded: "Đã chấm",
  pending: "Chờ chấm",
  late: "Nộp muộn",
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!(await canEditCourse(userId, params.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const subs = await prisma.assignmentSubmission.findMany({
    where: { assignment: { lesson: { module: { courseId: params.id } } } },
    orderBy: { submittedAt: "desc" },
    include: {
      user: { select: { displayName: true, email: true } },
      assignment: {
        select: {
          title: true,
          maxScore: true,
          lesson: { select: { title: true } },
        },
      },
    },
  });

  const rows = subs.map((s) => ({
    "Họ tên học viên": s.user.displayName ?? "",
    "Email học viên": s.user.email,
    "Bài học": s.assignment.lesson.title,
    "Bài tập": s.assignment.title,
    "Trạng thái": SUBMISSION_STATUS[s.status] ?? s.status,
    "Điểm": s.score !== null ? `${s.score}/${s.assignment.maxScore}` : "Chưa chấm",
    "Nhận xét giảng viên": s.feedback ?? "",
    "Nội dung bài nộp": s.body,
    "File đính kèm": s.attachmentUrl ?? "",
    "Nộp lúc": s.submittedAt,
    "Chấm lúc": s.gradedAt ?? "",
  }));

  const filename = `bai-nop-${params.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, rows);
}
