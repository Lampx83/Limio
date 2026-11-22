import { prisma } from "@feedbackme/db";
import { extractMaterialText, getSubmissionGradingContext } from "@feedbackme/core-lms";
import {
  MAX_AUDIO_BYTES,
  SpeakingFeedbackError,
  ensureTranscriptForGrading,
  openAiTranscriber,
  suggestAssignmentGrade,
  type AssignmentGradeSuggestion,
} from "@feedbackme/core-feedback";
import { getOpenaiClient } from "@/lib/openaiClient";
import { collectGradingSources, type TranscribeOutcome } from "@/lib/gradingSources";
import { fetchGoogleDocText } from "@/lib/googleDocText";
import { loadSubmissionFile } from "@/lib/submissionFile";
import { countDocxImages, countPdfImages } from "@/lib/embeddedImages";

export type AssignmentAiSuggestResult =
  | {
      kind: "ok";
      suggestion: AssignmentGradeSuggestion;
      hadRubric: boolean;
      read: string[];
      unread: { what: string; why: string } | null;
      /** `AssignmentSubmission.updatedAt` đọc TRƯỚC khi gọi AI — mốc để biết gợi ý còn mới không. */
      submissionUpdatedAt: Date;
    }
  | { kind: "unreadable"; details: { what: string; why: string } };

/**
 * Một lượt "gợi ý điểm bằng AI" cho một bài nộp — dùng chung cho nút chấm từng bài
 * (`/api/submissions/[id]/suggest-grade`) và chấm hàng loạt (`aiGradeBatchJob`), để hai đường chấm giống hệt nhau:
 * cùng quyền, cùng cách đọc Google Docs/PDF/Word/bài nói, cùng prompt, cùng hạn mức.
 *
 * Không ghi gì vào bài nộp (chỉ bản chữ Whisper vừa tạo được lưu để dùng lại). Lỗi được NÉM (core-lms
 * `AssignmentError`, `AiTutorError`, `AiGenerationError`, `Error("openai_not_configured")`) để tầng gọi tự ánh xạ.
 */
export async function suggestForSubmission(userId: string, submissionId: string): Promise<AssignmentAiSuggestResult> {
  const ctx = await getSubmissionGradingContext(userId, submissionId);
  const openai = await getOpenaiClient(); // ném Error("openai_not_configured") nếu thiếu khoá
  const row = await prisma.assignmentSubmission.findUnique({ where: { id: submissionId }, select: { updatedAt: true } });
  const submissionUpdatedAt = row?.updatedAt ?? new Date();

  const transcribe = async (url: string): Promise<TranscribeOutcome> => {
    try {
      const r = await ensureTranscriptForGrading(userId, submissionId, url, {
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
    { submissionId, ...ctx },
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
    return { kind: "unreadable", details: sources.unread };
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
  return {
    kind: "ok",
    suggestion,
    hadRubric: !!ctx.rubricText?.trim(),
    read: sources.read,
    unread: sources.unread ?? null,
    submissionUpdatedAt,
  };
}
