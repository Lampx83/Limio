import { NextResponse } from "next/server";
import { runFreeChatTurn } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import { mapPracticeAnswerError } from "@/lib/practiceAnswerApi";
import { speakPartnerLine } from "@/lib/freeChatSpeech";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * "Thử nói tự do" (docs/tieu-chi/limio-language-noi-tu-do-voi-ban-ao.md): MỘT lượt hội thoại với bạn ảo. Body JSON `{ history, message }`:
 * `history` là các tin ĐÃ XONG do trình duyệt giữ (xen kẽ learner/partner, không gồm lời mở đầu), `message` là lời học viên lượt này (≤ 300 ký tự).
 * Máy chủ không lưu hội thoại; trừ ví token của HỌC VIÊN; ghi sự kiện không mang chữ. Trả `{ reply, turn, maxTurns, speech }`: `speech` là giọng đọc lời bạn ảo (null nếu đọc lỗi — vẫn có chữ).
 * Nói thì trình duyệt chuyển chữ trước qua route `roleplay/{câu}?turn=n` rồi mới gửi chữ vào đây.
 */
export async function POST(req: Request, { params }: { params: { id: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { history?: unknown; message?: unknown };
  try {
    body = (await req.json()) as { history?: unknown; message?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const r = await runFreeChatTurn(
      { userId, sessionId: params.id, questionId: params.questionId, history: body.history ?? [], message: body.message },
      // Lấy khách hàng AI chậm: thiếu cấu hình chỉ lộ khi thật sự cần gọi mô hình.
      { openai: () => getOpenaiClient() },
    );
    const speech = await speakPartnerLine(r.reply, r.language);
    return NextResponse.json({ reply: r.reply, turn: r.turn, maxTurns: r.maxTurns, speech });
  } catch (e) {
    const practice = mapPracticeAnswerError(e);
    if (practice) return practice;
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
