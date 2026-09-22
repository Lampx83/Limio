import { NextResponse } from "next/server";
import {
  AiGenerationError,
  AiTutorError,
  extractQuestionsFromText,
} from "@feedbackme/core-feedback";
import { aiQuestionsToParseResult, isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";

/**
 * "Nhập bằng AI" — GV dán văn bản câu hỏi thô, AI tách thành câu hỏi có cấu
 * trúc, rồi chạy qua ĐÚNG validate xác định của luồng import Excel
 * (aiQuestionsToParseResult → parseRawMcqRows) — trả về cùng shape
 * `ParseResult` mà preview Excel trả, để dùng chung UI preview/commit của
 * `ImportMcqModal`. Route này không ghi DB nào ngoài sổ token AI (qua
 * extractQuestionsFromText) — chưa lưu câu hỏi nào, việc lưu vẫn đi qua
 * commitEndpoint hiện có (mcq-import-commit) như luồng Excel.
 *
 * Không gắn theo bankId/quizId: kết quả không phụ thuộc đích đến, chỉ là bước
 * "đọc hiểu văn bản" — GV chọn Import vào đâu ở bước preview/commit sau đó.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Bất kỳ giảng viên nào (hoặc admin) cũng dùng được — không gắn với 1 khoá cụ
  // thể như generate-questions (nơi có lessonId để authz theo khoá).
  const [admin, anyCourse] = await Promise.all([
    isAdmin(userId),
    prisma.courseInstructor.findFirst({ where: { userId } }),
  ]);
  if (!admin && !anyCourse) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
    const { questions } = await extractQuestionsFromText(
      userId,
      { rawText: body.rawText },
      openai,
    );
    const result = aiQuestionsToParseResult(questions);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AiTutorError) {
      // Vượt trần token — 429: người gọi không sai gì, hết hạn mức thì thử lại sau.
      return NextResponse.json({ error: e.code, details: e.details }, { status: 429 });
    }
    if (e instanceof AiGenerationError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 400 });
    }
    throw e;
  }
}
