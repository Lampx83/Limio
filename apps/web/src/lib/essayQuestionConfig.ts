/**
 * Cấu hình câu `essay` (Tự luận, trả lời mở) trong trình soạn: đọc từ / dựng thành `config` lưu vào ExamQuestion.
 * docs/tieu-chi/bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md (AC3, AC5a).
 *
 * Hàm thuần để test được. Hai công tắc `voiceAnswer` / `aiFeedback` mặc định BẬT, nên chỉ ghi `false` khi tắt (config gọn,
 * câu cũ chưa có khoá vẫn hiểu là bật). `explanationAudio` là đường dẫn kho đề do route tải lên trả về (`/api/exam-assets/<tên>`).
 */

export interface EssayDraft {
  /** Tiêu chí đánh giá cho AI (HTML từ trình soạn chữ). */
  rubric: string;
  minWords: number;
  /** Bài mẫu (Sample answer). */
  explanation: string;
  explanationAudio: string;
  voiceAnswer: boolean;
  aiFeedback: boolean;
}

export function emptyEssayDraft(): EssayDraft {
  return { rubric: "", minWords: 0, explanation: "", explanationAudio: "", voiceAnswer: true, aiFeedback: true };
}

/** Đường dẫn audio bài mẫu hợp lệ của kho đề (khớp `EssayConfig.explanationAudio`); không thì chuỗi rỗng. */
export function cleanExplanationAudio(v: unknown): string {
  return typeof v === "string" && /^\/api\/exam-assets\/[A-Za-z0-9._-]+$/.test(v) && v.length <= 500 ? v : "";
}

/**
 * Đọc `config` đã lưu thành bản nháp của form. `rubricToHtml` đổi chữ thường của rubric cũ thành HTML cho trình soạn chữ
 * (truyền `plainToRichHtml`; tách ra để hàm này không kéo theo phụ thuộc).
 */
export function essayDraftFromConfig(cfg: Record<string, unknown>, rubricToHtml: (s: string) => string = (s) => s): EssayDraft {
  return {
    rubric: rubricToHtml(typeof cfg.rubric === "string" ? cfg.rubric : ""),
    minWords: typeof cfg.minWords === "number" ? cfg.minWords : 0,
    explanation: typeof cfg.explanation === "string" ? cfg.explanation : "",
    explanationAudio: cleanExplanationAudio(cfg.explanationAudio),
    voiceAnswer: cfg.voiceAnswer !== false,
    aiFeedback: cfg.aiFeedback !== false,
  };
}

/** Dựng `config` của câu essay: chỉ ghi khoá có giá trị; công tắc chỉ ghi khi tắt. */
export function buildEssayConfig(d: EssayDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.rubric) out.rubric = d.rubric;
  if (d.minWords > 0) out.minWords = d.minWords;
  const explanation = d.explanation.trim();
  if (explanation) out.explanation = explanation;
  const audio = cleanExplanationAudio(d.explanationAudio);
  if (audio) out.explanationAudio = audio;
  if (!d.voiceAnswer) out.voiceAnswer = false;
  if (!d.aiFeedback) out.aiFeedback = false;
  return out;
}
