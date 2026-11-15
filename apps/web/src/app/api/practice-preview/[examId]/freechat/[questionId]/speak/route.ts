import { NextResponse } from "next/server";
import { getPreviewFreeChatContext } from "@feedbackme/core-lms";
import { PracticeFeedbackError, frameTextOf, parseFreeChat } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { mapPracticeAnswerError } from "@/lib/practiceAnswerApi";
import { speakPartnerLine } from "@/lib/freeChatSpeech";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Xem trước của GIẢNG VIÊN: đọc lời mở đầu của bạn ảo, hoặc một mẫu câu khi có `?frame=<chỉ số>` (văn bản từ cấu hình câu, không nhận từ trình duyệt).
 * Chỉ người sửa được khoá chứa đề.
 */
export async function POST(req: Request, { params }: { params: { examId: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const ctx = await getPreviewFreeChatContext(userId, params.examId, params.questionId);
    const cfg = parseFreeChat({ freechat: ctx.freechat });
    if (!cfg) throw new PracticeFeedbackError("not_essay");
    const frameParam = new URL(req.url).searchParams.get("frame");
    if (frameParam !== null) {
      if (!/^\d{1,2}$/.test(frameParam)) throw new PracticeFeedbackError("not_found");
      return NextResponse.json({ speech: await speakPartnerLine(frameTextOf(cfg, Number(frameParam)), ctx.language) });
    }
    return NextResponse.json({ speech: await speakPartnerLine(cfg.opening, ctx.language) });
  } catch (e) {
    const practice = mapPracticeAnswerError(e);
    if (practice) return practice;
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
