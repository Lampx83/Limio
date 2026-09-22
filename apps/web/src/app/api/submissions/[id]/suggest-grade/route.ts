import { NextResponse } from "next/server";
import { getSubmissionGradingContext } from "@feedbackme/core-lms";
import { AiGenerationError, AiTutorError, suggestAssignmentGrade } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";

/**
 * "Gợi ý điểm bằng AI" cho một bài nộp assignment. CHỈ trả gợi ý — không ghi
 * gì vào DB. GV vẫn phải tự bấm "Chấm điểm" ở GradeForm mới thực sự lưu.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const ctx = await getSubmissionGradingContext(userId, params.id);

    let openai;
    try {
      openai = await getOpenaiClient();
    } catch (e) {
      if ((e as Error).message === "openai_not_configured") {
        return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
      }
      throw e;
    }

    const suggestion = await suggestAssignmentGrade(userId, ctx, openai);
    return NextResponse.json({ ...suggestion, hadRubric: !!ctx.rubricText?.trim() });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    if (e instanceof AiTutorError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 429 });
    }
    if (e instanceof AiGenerationError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 400 });
    }
    throw e;
  }
}
