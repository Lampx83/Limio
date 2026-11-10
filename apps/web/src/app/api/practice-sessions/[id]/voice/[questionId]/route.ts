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

export const runtime = "nodejs";
export const maxDuration = 120; // Whisper có thể mất hơn một lượt gọi thường

/** Tối đa 25 MB (giới hạn của Whisper); bản ghi 3 phút từ trình duyệt chỉ vài MB. */
const MAX_BYTES = 25 * 1024 * 1024;

/** Định dạng ghi âm nhận vào → đuôi tệp lưu. Khớp những gì MediaRecorder ra (webm/ogg, mp4 trên Safari) và tệp tải lên thông dụng. */
const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

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

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "validation_failed", details: "no_file" }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "validation_failed", details: "empty_file" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large", details: { maxBytes: MAX_BYTES } }, { status: 413 });
    const mimeType = file.type.split(";")[0]!.trim().toLowerCase();
    const ext = MIME_TO_EXT[mimeType];
    if (!ext) return NextResponse.json({ error: "unsupported_media_type", details: { allowed: Object.keys(MIME_TO_EXT) } }, { status: 415 });

    const buffer = Buffer.from(await file.arrayBuffer());
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
