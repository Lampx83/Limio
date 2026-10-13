import { NextResponse } from "next/server";
import { extractMaterialText, getSubmissionGradingContext } from "@feedbackme/core-lms";
import {
  AiGenerationError,
  AiTutorError,
  MAX_AUDIO_BYTES,
  SpeakingFeedbackError,
  ensureTranscriptForGrading,
  openAiTranscriber,
  suggestAssignmentGrade,
} from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import { collectGradingSources, type TranscribeOutcome } from "@/lib/gradingSources";
import { fetchGoogleDocText } from "@/lib/googleDocText";
import { loadSubmissionFile } from "@/lib/submissionFile";
import { countDocxImages, countPdfImages } from "@/lib/embeddedImages";

export const runtime = "nodejs";
export const maxDuration = 180; // có thể phải chuyển chữ cả một file ghi âm (Whisper) trước lượt chấm

/**
 * "Gợi ý điểm bằng AI" cho một bài nộp assignment. CHỈ trả gợi ý — không ghi
 * gì vào DB. GV vẫn phải tự bấm "Chấm điểm" ở GradeForm mới thực sự lưu.
 *
 * Ngoài ô chữ, AI đọc phần đính kèm: Google Docs/Sheets/Slides (link đã mở quyền xem), chữ trong
 * PDF/Word, bài nói (Whisper — bản chữ chưa có thì chuyển ngay, trừ ví AI của giảng viên đang chấm).
 * Ảnh/video không chấm bằng AI. Phần không đọc được trả về `unread` để giao diện cảnh báo. Ngoại lệ duy nhất có ghi DB: bản chữ Whisper vừa tạo được lưu (SubmissionTranscript) để
 * lần sau và góp ý bài nói của học viên dùng lại, không trả tiền hai lần.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const ctx = await getSubmissionGradingContext(userId, params.id);

    let openai;
    try {
      openai = await getOpenaiClient();
    } catch (e) {
      if ((e as Error).message === "openai_not_configured") {
        return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
      }
      throw e;
    }

    const transcribe = async (url: string): Promise<TranscribeOutcome> => {
      try {
        const r = await ensureTranscriptForGrading(userId, params.id, url, {
          loadAudio: async (u) => {
            const f = await loadSubmissionFile(u, ctx.uploaderUserId, { maxBytes: MAX_AUDIO_BYTES });
            if (f.ok) return { buffer: f.buffer, mimeType: f.mimeType };
            if (f.reason === "too_large") throw new SpeakingFeedbackError("audio_too_large");
            return null;
          },
          // Whisper vẫn là OpenAI (chat thì đã sang LLM tự host) nên cần key thật — lấy chậm, chỉ khi phải chuyển chữ.
          transcribe: async () => openAiTranscriber(await getOpenaiClient({ needsOpenaiKey: true })),
        });
        return r ? { ok: true, ...r } : { ok: false, reason: "silent" };
      } catch (e) {
        if ((e as Error).message === "openai_not_configured") return { ok: false, reason: "not_configured" };
        if (e instanceof SpeakingFeedbackError) {
          if (e.code === "audio_too_large") return { ok: false, reason: "too_large" };
          if (e.code === "audio_not_hosted") return { ok: false, reason: "not_hosted" };
          if (e.code === "stt_failed") return { ok: false, reason: "failed" };
        }
        throw e; // hết ví/vượt trần → 429 như mọi lời gọi AI khác
      }
    };

    const sources = await collectGradingSources(
      { submissionId: params.id, ...ctx },
      {
        fetchGoogleDoc: (url) => fetchGoogleDocText(url),
        loadFile: (url, maxBytes) => loadSubmissionFile(url, ctx.uploaderUserId, { maxBytes }),
        extractText: (buf, mime) => extractMaterialText(buf, mime),
        countImages: async (buf, kind) => (kind === "pdf" ? countPdfImages(buf) : countDocxImages(buf)),
        transcribe,
      },
    );
    // Không có gì đọc được mà học viên CÓ nộp tệp → nói rõ vì sao, đừng để AI chấm một bài "trống".
    if (!sources.body && sources.attachments.length === 0 && sources.unread) {
      return NextResponse.json({ error: "attachment_unreadable", details: sources.unread }, { status: 422 });
    }

    const suggestion = await suggestAssignmentGrade(
      userId,
      {
        ...ctx,
        submissionBody: sources.body,
        attachments: sources.attachments,
        unreadAttachment: sources.unread?.what ?? null,
      },
      openai,
    );
    return NextResponse.json({
      ...suggestion,
      hadRubric: !!ctx.rubricText?.trim(),
      read: sources.read,
      unread: sources.unread,
    });
  } catch (e) {
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
