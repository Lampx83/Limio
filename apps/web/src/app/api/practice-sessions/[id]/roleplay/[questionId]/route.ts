import { NextResponse } from "next/server";
import { getPracticeVoiceContext } from "@feedbackme/core-lms";
import { transcribeRolePlayTurn } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import { mapPracticeAnswerError } from "@/lib/practiceAnswerApi";
import { readVoiceUpload } from "@/lib/practiceVoiceUpload";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Hội thoại đóng vai (docs/tieu-chi/limio-language-luyen-hoi-thoai-dong-vai.md): chuyển chữ MỘT lượt nói. Multipart `file`, query `?turn=<số thứ tự lượt>`.
 * Khác route `voice`: KHÔNG lưu tệp ghi âm và KHÔNG lưu câu trả lời (học viên giữ bản chữ từng lượt ở trình duyệt rồi lưu câu trả lời qua route
 * `answers` như mọi câu mở); chỉ trả `{ text, durationSec }`, trừ ví token của HỌC VIÊN và ghi sự kiện (không mang chữ nói).
 * Xem thử của giảng viên dùng route `practice-preview/.../voice` (không lưu gì).
 */
export async function POST(req: Request, { params }: { params: { id: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: sessionId, questionId } = params;
  const rawTurn = new URL(req.url).searchParams.get("turn");
  const turn = rawTurn === null || rawTurn.trim() === "" ? NaN : Number(rawTurn);
  if (!Number.isInteger(turn) || turn < 0 || turn > 39) return NextResponse.json({ error: "validation_failed", details: "turn" }, { status: 400 });

  try {
    // Chủ buổi, buổi còn dở, câu là essay còn bật voiceAnswer — kiểm TRƯỚC khi đọc tệp lên bộ nhớ.
    await getPracticeVoiceContext(userId, sessionId, questionId);
    const upload = await readVoiceUpload(req);
    if (upload instanceof NextResponse) return upload;
    const stt = await transcribeRolePlayTurn(
      { userId, sessionId, questionId, turnIndex: turn, audio: { buffer: upload.buffer, mimeType: upload.mimeType } },
      { openai: () => getOpenaiClient({ needsOpenaiKey: true }) },
    );
    return NextResponse.json({ text: stt.text, durationSec: stt.durationSec });
  } catch (e) {
    const practice = mapPracticeAnswerError(e);
    if (practice) return practice;
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
