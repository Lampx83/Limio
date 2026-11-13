import { translate, type UiLang } from "@/lib/i18n/core";
import { EN, VI, type MessageKey } from "@/lib/i18n/dict";
import { describeWritingError } from "@/lib/writingFeedbackText";

/**
 * LANG G7 — chữ hiển thị cho góp ý bài nói. Dùng chung nhãn danh mục/mức với góp ý Viết
 * (writingFeedbackText) — ở đây chỉ phần riêng: ghi chú giới hạn phát âm và lời nhắn cho từng mã lỗi.
 */

/** G7c.1 — ghi chú cố định ở MỌI nơi hiện góp ý bài nói. */
export const SPEAKING_NOTICE =
  "Máy chỉ nghe ra chữ và nhịp nói; không chấm được phát âm hay thanh điệu. Giảng viên nghe bản ghi để đánh giá phát âm.";

export const SPEAKING_CONSENT =
  "Khi bấm, bản ghi âm của bạn được gửi tới OpenAI để chuyển thành chữ, rồi nội dung đó được AI phân tích. Việc này trừ lượt AI trong ví của bạn theo thời lượng bản ghi (không trừ lại khi bản ghi chưa đổi).";

const SPEAKING_ERROR_KEY: Record<string, MessageKey> = {
  rate_limited: "practice.sf.err.rateLimited",
  audio_missing: "practice.sf.err.audioMissing",
  audio_not_hosted: "practice.sf.err.audioNotHosted",
  audio_too_large: "practice.sf.err.audioTooLarge",
  audio_too_long: "practice.sf.err.audioTooLong",
  no_speech: "practice.sf.err.noSpeech",
  stt_failed: "practice.sf.err.sttFailed",
  openai_error: "practice.sf.err.aiFailed",
  json_parse_failed: "practice.sf.err.aiFailed",
  analysis_empty: "practice.sf.err.aiFailed",
};

/** Lời nhắn cho từng mã lỗi bài nói; mã dùng chung với góp ý Viết lấy từ describeWritingError. */
export function describeSpeakingError(code: string | undefined, lang: UiLang = "vi"): string {
  const key = code ? SPEAKING_ERROR_KEY[code] : undefined;
  return key ? translate(VI, EN, lang, key) : describeWritingError(code, lang);
}
