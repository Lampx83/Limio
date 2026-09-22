import { NextResponse } from "next/server";
import { canEditExam, commitExamQuestionRows } from "@feedbackme/core-lms";
import type { ParsedQuestionRow } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Ghi các row đã preview qua /ai-preview (không có file .xlsx đứng sau để
 * route tự re-parse như /confirm) — nhận thẳng `rows` JSON, giống
 * mcq-import-commit của Bank/Quiz. `canEditExam` + guard "đề đã có người
 * làm" lặp lại từ /confirm vì đây là điểm ghi độc lập, không đi qua route đó.
 *
 * Body: { rows: ParsedQuestionRow[] }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      courseId: true,
      createdById: true,
      status: true,
      _count: { select: { attempts: true } },
    },
  });
  if (!exam) return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  if (!(await canEditExam(userId, exam))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (exam.status === "published" && exam._count.attempts > 0) {
    return NextResponse.json({ error: "exam_has_attempts" }, { status: 409 });
  }

  const body = (await readJson(req)) as { rows?: ParsedQuestionRow[] } | null;
  if (!body?.rows || !Array.isArray(body.rows)) {
    return NextResponse.json(
      { error: "validation_failed", details: "missing_rows" },
      { status: 400 },
    );
  }

  const r = await commitExamQuestionRows(userId, exam.id, body.rows);
  return NextResponse.json(r);
}
