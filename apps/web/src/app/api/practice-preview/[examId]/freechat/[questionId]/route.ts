import { NextResponse } from "next/server";
import { getPreviewFreeChatContext } from "@feedbackme/core-lms";
import { PracticeFeedbackError, generateFreeChatReply, parseFreeChat } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import { mapPracticeAnswerError } from "@/lib/practiceAnswerApi";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Xem trước "Thử nói tự do" của GIẢNG VIÊN: cùng một lượt hội thoại nhưng KHÔNG buổi luyện, KHÔNG lưu gì, KHÔNG ghi sự kiện; trừ ví token của
 * GIẢNG VIÊN. Chỉ người sửa được khoá chứa đề; câu phải là `essay` có `freechat`. Body JSON như route của học viên.
 */
export async function POST(req: Request, { params }: { params: { examId: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { history?: unknown; message?: unknown };
  try {
    body = (await req.json()) as { history?: unknown; message?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const ctx = await getPreviewFreeChatContext(userId, params.examId, params.questionId);
    const cfg = parseFreeChat({ freechat: ctx.freechat });
    if (!cfg) throw new PracticeFeedbackError("not_essay");
    const r = await generateFreeChatReply(
      { userId, cfg, language: ctx.language, levelBand: ctx.levelBand, history: body.history ?? [], message: body.message },
      { openai: () => getOpenaiClient() },
    );
    return NextResponse.json({ reply: r.reply, turn: r.turn, maxTurns: r.maxTurns });
  } catch (e) {
    const practice = mapPracticeAnswerError(e);
    if (practice) return practice;
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
