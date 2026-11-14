import { NextResponse } from "next/server";
import { getPreviewFreeChatContext } from "@feedbackme/core-lms";
import { PracticeFeedbackError, parseFreeChat } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { mapPracticeAnswerError } from "@/lib/practiceAnswerApi";
import { speakPartnerLine } from "@/lib/freeChatSpeech";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Xem trước của GIẢNG VIÊN: đọc lời mở đầu của bạn ảo (văn bản từ cấu hình câu, không nhận từ trình duyệt). Chỉ người sửa được khoá chứa đề. */
export async function POST(_req: Request, { params }: { params: { examId: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const ctx = await getPreviewFreeChatContext(userId, params.examId, params.questionId);
    const cfg = parseFreeChat({ freechat: ctx.freechat });
    if (!cfg) throw new PracticeFeedbackError("not_essay");
    return NextResponse.json({ speech: await speakPartnerLine(cfg.opening, ctx.language) });
  } catch (e) {
    const practice = mapPracticeAnswerError(e);
    if (practice) return practice;
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
