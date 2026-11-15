import { NextResponse } from "next/server";
import { getPreviewVoiceContext } from "@feedbackme/core-lms";
import { transcribePreviewVoice } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import { mapPracticeAnswerError } from "@/lib/practiceAnswerApi";
import { readVoiceUpload } from "@/lib/practiceVoiceUpload";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Xem trước Bài luyện của GIẢNG VIÊN, câu mở: ghi âm rồi chuyển thành chữ để giảng viên thấy trải nghiệm của học viên.
 * KHÔNG tạo buổi luyện, KHÔNG lưu bản ghi, KHÔNG lưu câu trả lời, KHÔNG ghi sự kiện: chỉ trả chữ. Chuyển chữ trừ ví token của
 * GIẢNG VIÊN. Chỉ người sửa được khoá chứa đề; câu phải là `essay` và `voiceAnswer` bật. Góp ý AI không chạy ở xem thử.
 */
export async function POST(req: Request, { params }: { params: { examId: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    // Quyền, loại câu và công tắc giọng nói — kiểm TRƯỚC khi đọc tệp lên bộ nhớ.
    const ctx = await getPreviewVoiceContext(userId, params.examId, params.questionId);
    const upload = await readVoiceUpload(req);
    if (upload instanceof NextResponse) return upload;
    const stt = await transcribePreviewVoice(
      { userId, language: ctx.language, audio: { buffer: upload.buffer, mimeType: upload.mimeType } },
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
