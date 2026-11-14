import { NextResponse } from "next/server";
import { getFreeChatOpening } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { mapPracticeAnswerError } from "@/lib/practiceAnswerApi";
import { speakPartnerLine } from "@/lib/freeChatSpeech";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Đọc thành tiếng LỜI MỞ ĐẦU của bạn ảo ("Thử nói tự do"). Không có body: văn bản lấy từ cấu hình câu ở máy chủ, nên route này không thể bị dùng để
 * đọc chữ tuỳ ý. Cùng điều kiện truy cập với route hội thoại; không gọi mô hình, không trừ ví. Trả `{ speech }` (null nếu đọc lỗi).
 */
export async function POST(_req: Request, { params }: { params: { id: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
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
