import { NextResponse } from "next/server";
import { AiGenerationError, AiTutorError } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { suggestForSubmission } from "@/lib/assignmentAiSuggest";

export const runtime = "nodejs";
export const maxDuration = 180; // có thể phải chuyển chữ cả một file ghi âm (Whisper) trước lượt chấm

/**
 * "Gợi ý điểm bằng AI" cho một bài nộp assignment. CHỈ trả gợi ý — không ghi
 * gì vào DB. GV vẫn phải tự bấm "Chấm điểm" ở GradeForm mới thực sự lưu.
 *
 * Toàn bộ logic nằm ở `lib/assignmentAiSuggest.ts`, dùng chung với chấm hàng loạt. Ngoài ô chữ, AI đọc phần
 * đính kèm (Google Docs/Sheets/Slides, chữ trong PDF/Word, bài nói qua Whisper); ảnh/video không chấm bằng AI.
 * Phần không đọc được trả về `unread` để giao diện cảnh báo. Ngoại lệ duy nhất có ghi DB: bản chữ Whisper vừa
 * tạo được lưu (SubmissionTranscript) để lần sau và góp ý bài nói của học viên dùng lại, không trả tiền hai lần.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const r = await suggestForSubmission(userId, params.id);
    if (r.kind === "unreadable") {
      return NextResponse.json({ error: "attachment_unreadable", details: r.details }, { status: 422 });
    }
    return NextResponse.json({
      ...r.suggestion,
      hadRubric: r.hadRubric,
      read: r.read,
      unread: r.unread,
    });
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    if (e instanceof AiTutorError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 429 });
    }
    if (e instanceof AiGenerationError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 400 });
    }
    throw e;
  }
}
