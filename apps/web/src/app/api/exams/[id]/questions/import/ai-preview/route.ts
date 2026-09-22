import { NextResponse } from "next/server";
import {
  AiGenerationError,
  AiTutorError,
  extractQuestionsFromText,
} from "@feedbackme/core-feedback";
import { aiQuestionsToExamRows, canEditExam } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";

/**
 * "Nhập bằng AI" cho Đề thi — song song với /api/ai/extract-questions (Bank/
 * Quiz), nhưng gắn theo examId để dùng đúng `canEditExam` + trạng thái đề
 * (không cho AI-import vào đề đã có người làm), giống 2 route file-based
 * (preview/confirm) cạnh route này.
 *
 * Trả `ParseResult` theo shape `ParsedQuestionRow` của Exam (aiQuestionsToExamRows),
 * để ImportQuestionsModal tái dùng đúng bảng preview/commit đã có cho Excel —
 * commit vẫn đi qua /confirm hiện tại (route đó đổi sang nhận `rows` JSON
 * ngoài `file`, xem route confirm cùng thư mục cha).
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

  const body = (await readJson(req)) as { rawText?: string } | null;
  if (!body || typeof body.rawText !== "string") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    throw e;
  }

  try {
    const { questions, skipped } = await extractQuestionsFromText(
      userId,
      { rawText: body.rawText },
      openai,
    );
    const result = aiQuestionsToExamRows(questions);
    return NextResponse.json({ ...result, skipped });
  } catch (e) {
    if (e instanceof AiTutorError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 429 });
    }
    if (e instanceof AiGenerationError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 400 });
    }
    throw e;
  }
}
