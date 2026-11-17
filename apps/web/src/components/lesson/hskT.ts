import { translate, type TParams, type UiLang } from "@/lib/i18n/core";
import { EN, VI, type MessageKey } from "@/lib/i18n/dict";

/**
 * Chuỗi của giao diện bài HSK theo ngôn ngữ của KHOÁ (bản tiếng Việt hay tiếng Anh), không theo ngôn ngữ giao diện trình duyệt:
 * khoá tiếng Việt thì tiêu đề mục luôn là "Hội thoại", dù người học đang để giao diện tiếng Anh.
 */
export function hskT(lang: UiLang, key: MessageKey, params?: TParams): string {
  return translate(VI, EN, lang, key, params);
}
