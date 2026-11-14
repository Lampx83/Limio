import { NextResponse } from "next/server";
import { getFreeChatFrame, getFreeChatOpening, PracticeFeedbackError } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { mapPracticeAnswerError } from "@/lib/practiceAnswerApi";
import { speakPartnerLine } from "@/lib/freeChatSpeech";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Đọc thành tiếng LỜI MỞ ĐẦU của bạn ảo ("Thử nói tự do"), hoặc một MẪU CÂU của phiếu khi có `?frame=<chỉ số>` (màn chuẩn bị). Không có body: văn bản
 * lấy từ cấu hình câu ở máy chủ, nên route này không thể bị dùng để đọc chữ tuỳ ý. Cùng điều kiện truy cập với route hội thoại; không gọi mô hình,
 * không trừ ví. Trả `{ speech }` (null nếu đọc lỗi). Chỉ số không phải số nguyên hoặc ngoài khoảng: 404.
 */
export async function POST(req: Request, { params }: { params: { id: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const frameParam = new URL(req.url).searchParams.get("frame");
    if (frameParam !== null) {
      if (!/^\d{1,2}$/.test(frameParam)) throw new PracticeFeedbackError("not_found");
      const { text, language } = await getFreeChatFrame({ userId, sessionId: params.id, questionId: params.questionId, frame: Number(frameParam) });
      return NextResponse.json({ speech: await speakPartnerLine(text, language) });
    }
    const { opening, language } = await getFreeChatOpening({ userId, sessionId: params.id, questionId: params.questionId });
    return NextResponse.json({ speech: await speakPartnerLine(opening, language) });
  } catch (e) {
    const practice = mapPracticeAnswerError(e);
    if (practice) return practice;
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
