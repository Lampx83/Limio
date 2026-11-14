import { NextResponse } from "next/server";

/** Tối đa 25 MB (giới hạn của Whisper); bản ghi 3 phút từ trình duyệt chỉ vài MB. */
export const VOICE_MAX_BYTES = 25 * 1024 * 1024;

/** Định dạng ghi âm nhận vào → đuôi tệp lưu. Khớp những gì MediaRecorder ra (webm/ogg, mp4 trên Safari) và tệp tải lên thông dụng. */
export const VOICE_MIME_TO_EXT: Record<string, string> = {
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
 * Đọc và kiểm tệp ghi âm (multipart `file`) của route giọng nói: học viên và xem thử của giảng viên dùng chung.
 * Trả `{ buffer, mimeType, ext }` hoặc phản hồi lỗi sẵn để route trả thẳng.
 */
export async function readVoiceUpload(req: Request): Promise<{ buffer: Buffer; mimeType: string; ext: string } | NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "validation_failed", details: "no_file" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "validation_failed", details: "empty_file" }, { status: 400 });
  if (file.size > VOICE_MAX_BYTES) return NextResponse.json({ error: "file_too_large", details: { maxBytes: VOICE_MAX_BYTES } }, { status: 413 });
  const mimeType = file.type.split(";")[0]!.trim().toLowerCase();
  const ext = VOICE_MIME_TO_EXT[mimeType];
  if (!ext) return NextResponse.json({ error: "unsupported_media_type", details: { allowed: Object.keys(VOICE_MIME_TO_EXT) } }, { status: 415 });
  return { buffer: Buffer.from(await file.arrayBuffer()), mimeType, ext };
}
