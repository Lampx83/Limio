import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getPracticeVoiceContext, saveVoiceAnswer } from "@feedbackme/core-lms";
import { transcribePracticeVoice } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import { storageFor } from "@/lib/storage";
import { practiceAnswerKey, practiceAnswerKeyFromAudioKey } from "@/lib/storage-keys";
import { mapPracticeAnswerError } from "@/lib/practiceAnswerApi";
import { readVoiceUpload } from "@/lib/practiceVoiceUpload";

export const runtime = "nodejs";
export const maxDuration = 120; // Whisper có thể mất hơn một lượt gọi thường

/**
 * Bài luyện nhúng, câu mở: học viên trả lời bằng giọng nói. Multipart `file` (bản ghi âm).
 * Thứ tự: kiểm quyền và cấu hình câu (chưa đọc tệp) → kích thước và định dạng → chuyển chữ (trừ ví token của HỌC VIÊN) →
 * ghi tệp vào kho `private` → lưu câu trả lời + bản ghi (thay bản cũ) → xoá tệp cũ. Bản ghi chỉ rời trình duyệt khi học viên
 * bấm "Chuyển thành chữ". Xem thử của giảng viên không đi qua route này.
 */
export async function POST(req: Request, { params }: { params: { id: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: sessionId, questionId } = params;

  try {
    // Chủ buổi, buổi còn dở, câu là essay và voiceAnswer bật — kiểm TRƯỚC khi đọc tệp lên bộ nhớ.
    await getPracticeVoiceContext(userId, sessionId, questionId);

    const upload = await readVoiceUpload(req);
    if (upload instanceof NextResponse) return upload;
    const { buffer, mimeType, ext } = upload;

    const stt = await transcribePracticeVoice(
      { userId, sessionId, questionId, audio: { buffer, mimeType } },
      // Lấy khách hàng AI chậm: thiếu cấu hình chỉ lộ khi thật sự cần gọi Whisper.
      { openai: () => getOpenaiClient({ needsOpenaiKey: true }) },
    );

    const filename = `${questionId}-${randomBytes(4).toString("hex")}.${ext}`;
    const key = practiceAnswerKey(sessionId, filename);
    const storage = storageFor(key);
    await storage.put(key.key, buffer, mimeType);

    let previousAudioKey: string | null;
    try {
      ({ previousAudioKey } = await saveVoiceAnswer(userId, sessionId, questionId, {
        text: stt.text,
        audioKey: key.key,
        audioMeta: { durationSec: stt.durationSec, mimeType, sizeBytes: buffer.length, metrics: stt.metrics },
      }));
    } catch (e) {
      // Không để tệp mồ côi: DB không nhận bản ghi này thì tệp vừa ghi không có ai trỏ tới.
      await storage.delete(key.key).catch((err) => console.error("[practice voice] không xoá được tệp vừa ghi", key.key, err));
      throw e;
    }

    // Bản ghi cuối cùng thay bản cũ: xoá tệp cũ. Hỏng bước này chỉ ghi log (câu trả lời đã lưu xong).
    const old = previousAudioKey ? practiceAnswerKeyFromAudioKey(previousAudioKey) : null;
    if (old && old.key !== key.key) {
      try {
        await storageFor(old).delete(old.key);
      } catch (err) {
        console.error("[practice voice] không xoá được bản ghi cũ", old.key, err);
      }
    }

    return NextResponse.json({ text: stt.text, durationSec: stt.durationSec });
  } catch (e) {
    const practice = mapPracticeAnswerError(e);
    if (practice) return practice;
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
