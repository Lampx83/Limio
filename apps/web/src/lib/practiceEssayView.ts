/**
 * Câu mở (essay) của Bài luyện nhúng — phần thuần của giao diện: đọc an toàn góp ý AI và bài mẫu từ dữ liệu máy chủ trả về,
 * nhãn hiển thị, lời nhắn lỗi tiếng Việt. Xem docs/tieu-chi/bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md (AC1–AC4).
 */

import { tFor } from "@/lib/i18n/tFor";
import type { UiLang } from "@/lib/i18n/core";

export type FeedbackLevel = "needs_work" | "fair" | "good";
export type CriterionKey = "task" | "content" | "language" | "fluency";

export interface FeedbackView {
  summary: string;
  criteria: Array<{ key: CriterionKey; level: FeedbackLevel; comment: string }>;
  errors: Array<{ category: string; quote: string; correction: string; explanation: string }>;
  nextSteps: string[];
  viaVoice: boolean;
}

/** Nhãn tiêu chí: cố ý để tiếng Anh như dữ liệu trả về (học viên luyện ngoại ngữ), phần chữ xung quanh là tiếng Việt. */
export const CRITERION_LABEL: Record<CriterionKey, string> = {
  task: "Task",
  content: "Content",
  language: "Language",
  fluency: "Fluency",
};

export const LEVEL_LABEL: Record<FeedbackLevel, string> = {
  needs_work: "Needs work",
  fair: "Fair",
  good: "Good",
};

/** Màu dịu cho từng mức (không dùng đỏ: đây không phải điểm hay lời phán sai). */
export const LEVEL_CLASS: Record<FeedbackLevel, string> = {
  needs_work: "border-amber-300 bg-amber-50 text-amber-900",
  fair: "border-sky-200 bg-sky-50 text-sky-900",
  good: "border-lime-300 bg-lime-50 text-lime-800",
};

const CRITERIA: readonly CriterionKey[] = ["task", "content", "language", "fluency"];
const LEVELS: readonly FeedbackLevel[] = ["needs_work", "fair", "good"];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Đọc góp ý từ dữ liệu không đáng tin (JSON từ DB hoặc từ route): bỏ mục sai dạng thay vì làm vỡ giao diện. Trả null nếu
 * không có gì đáng hiện (không phải đối tượng, hoặc không có nhận xét nào).
 */
export function parseFeedback(raw: unknown): FeedbackView | null {
  if (!isObj(raw)) return null;
  const criteria: FeedbackView["criteria"] = [];
  if (Array.isArray(raw.criteria)) {
    for (const c of raw.criteria) {
      if (!isObj(c)) continue;
      const key = CRITERIA.find((k) => k === c.key);
      const level = LEVELS.find((l) => l === c.level);
      if (!key || !level) continue;
      criteria.push({ key, level, comment: str(c.comment) });
    }
  }
  const errors: FeedbackView["errors"] = [];
  if (Array.isArray(raw.errors)) {
    for (const e of raw.errors) {
      if (!isObj(e)) continue;
      const quote = str(e.quote);
      const correction = str(e.correction);
      if (!quote || !correction) continue;
      errors.push({ category: str(e.category), quote, correction, explanation: str(e.explanation) });
    }
  }
  const nextSteps = Array.isArray(raw.nextSteps) ? raw.nextSteps.map(str).filter(Boolean) : [];
  const summary = str(raw.summary);
  if (!summary && criteria.length === 0 && errors.length === 0 && nextSteps.length === 0) return null;
  return { summary, criteria, errors, nextSteps, viaVoice: raw.viaVoice === true };
}

/** Bài mẫu (chữ thuần) trong cấu hình đầy đủ của câu — chỉ có sau khi kiểm tra. */
export function sampleTextOf(config: unknown): string | null {
  const e = isObj(config) ? config.explanation : null;
  return typeof e === "string" && e.trim() ? e.trim() : null;
}

/** Đường dẫn audio bài mẫu; chỉ nhận tệp của kho đề (`/api/exam-assets/<tên>`), không bao giờ URL ngoài. */
export function sampleAudioOf(config: unknown): string | null {
  const a = isObj(config) ? config.explanationAudio : null;
  return typeof a === "string" && /^\/api\/exam-assets\/[A-Za-z0-9._-]+$/.test(a) ? a : null;
}

/** Câu mở có bật giọng nói / góp ý AI không (cấu hình công khai; vắng = bật). */
export function essayVoiceEnabled(config: unknown): boolean {
  return !isObj(config) || config.voiceAnswer !== false;
}
export function essayFeedbackEnabled(config: unknown): boolean {
  return !isObj(config) || config.aiFeedback !== false;
}

/** Lời nhắn khi chuyển giọng nói lỗi. Luôn nói rõ ô gõ vẫn dùng được; không đổ lỗi cho học viên. */
export function voiceErrorMessage(code: string | null | undefined, lang: UiLang = "vi"): string {
  const t = tFor(lang);
  switch (code) {
    case "openai_not_configured":
      return t("practice.say.verr.notConfigured");
    case "daily_token_cap":
    case "no_token_budget":
    case "global_token_cap":
      return t("practice.say.verr.quota");
    case "rate_limited":
      return t("practice.say.verr.rate");
    case "audio_too_long":
    case "audio_too_large":
    case "file_too_large":
      return t("practice.say.verr.long");
    case "no_speech":
      return t("practice.say.verr.noSpeech");
    case "unsupported_media_type":
      return t("practice.say.verr.format");
    case "practice_session_closed":
      return t("practice.say.verr.closed");
    case "not_language_course":
      return t("practice.say.verr.notLanguage");
    case "stt_failed":
    case "analysis_empty":
    case "openai_error":
      return t("practice.say.verr.failed");
    default:
      return t("practice.say.verr.other");
  }
}

/**
 * Lời nhắn nhẹ khi chưa có góp ý AI (không phải lỗi của học viên). `control_group` → null: không nói gì, chỉ hiện bài mẫu.
 * `hasSample` quyết định có nhắc "đối chiếu với bài mẫu" hay không (không hứa thứ không có).
 */
export function feedbackErrorMessage(code: string | null | undefined, hasSample: boolean): string | null {
  if (!code || code === "control_group") return null;
  const tail = hasSample ? " Bạn vẫn có thể đối chiếu với bài mẫu bên dưới." : "";
  switch (code) {
    case "not_configured":
      return `Hệ thống chưa bật nhận xét tự động nên chưa có góp ý.${tail}`;
    case "quota":
      return `Hạn mức AI đã hết nên chưa nhận xét được.${tail}`;
    case "empty_answer":
      return "Hãy viết hoặc nói câu trả lời trước khi nhận góp ý.";
    default:
      return `Chưa nhận xét được lúc này. Bạn thử bấm Kiểm tra lại sau nhé.${tail}`;
  }
}
