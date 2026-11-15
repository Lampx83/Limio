import { translate, type UiLang } from "@/lib/i18n/core";
import { EN, VI, type MessageKey } from "@/lib/i18n/dict";

/**
 * LANG G6 — chữ hiển thị cho góp ý bài viết: nhãn danh mục lỗi, mức tiêu chí, và lời nhắn cho từng
 * mã lỗi. Mọi mã lỗi đều có lời nhắn RIÊNG — hết ví token phải nói rõ chứ không thất bại lặng lẽ.
 */
export const CATEGORY_LABEL: Record<string, string> = {
  grammar: "Ngữ pháp",
  vocabulary: "Từ vựng",
  spelling: "Chính tả",
  word_order: "Trật tự từ",
  particle_or_measure: "Trợ từ / lượng từ",
  punctuation: "Dấu câu",
  cohesion: "Liên kết câu",
  register: "Văn phong",
  other: "Khác",
};

export const CRITERION_LABEL: Record<string, string> = {
  task: "Hoàn thành yêu cầu",
  grammar: "Ngữ pháp",
  vocabulary: "Từ vựng",
  coherence: "Mạch lạc",
  // LANG G7 — tiêu chí bài nói. "fluency" do HỆ THỐNG đo từ bản ghi (không phải mô hình đoán).
  language: "Từ vựng và ngữ pháp",
  fluency: "Lưu loát (đo từ bản ghi)",
};

export const LEVEL_LABEL: Record<string, { text: string; cls: string }> = {
  needs_work: { text: "Cần cải thiện", cls: "bg-amber-100 text-amber-800" },
  fair: { text: "Khá", cls: "bg-sky-100 text-sky-800" },
  good: { text: "Tốt", cls: "bg-emerald-100 text-emerald-800" },
};

const tr = (lang: UiLang, key: MessageKey) => translate(VI, EN, lang, key);
const has = (k: string): k is MessageKey => k in VI;

/** Nhãn danh mục lỗi theo ngôn ngữ giao diện; mã lạ trả lại nguyên mã. */
export function categoryLabel(category: string, lang: UiLang = "vi"): string {
  const k = `practice.wf.cat.${category}`;
  return has(k) ? tr(lang, k) : category;
}

export function criterionLabel(key: string, lang: UiLang = "vi"): string {
  const k = `practice.wf.crit.${key}`;
  return has(k) ? tr(lang, k) : key;
}

/** Mức tiêu chí (ba mức, không số điểm): chữ theo ngôn ngữ, màu giữ nguyên. */
export function levelLabel(level: string, lang: UiLang = "vi"): { text: string; cls: string } | undefined {
  const base = LEVEL_LABEL[level];
  if (!base) return undefined;
  const k = `practice.wf.level.${level}`;
  return { text: has(k) ? tr(lang, k) : base.text, cls: base.cls };
}

const WRITING_ERROR_KEY: Record<string, MessageKey> = {
  no_token_budget: "practice.wf.err.noBudget",
  global_token_cap: "practice.wf.err.tokenCap",
  daily_token_cap: "practice.wf.err.tokenCap",
  rate_limited: "practice.wf.err.rateLimited",
  text_empty: "practice.wf.err.textEmpty",
  text_too_long: "practice.wf.err.textTooLong",
  control_group: "practice.wf.err.controlGroup",
  not_language_course: "practice.wf.err.notLanguageCourse",
  forbidden: "practice.wf.err.forbidden",
  submission_not_found: "practice.wf.err.notFound",
  openai_not_configured: "practice.wf.err.aiNotConfigured",
  openai_error: "practice.wf.err.aiFailed",
  json_parse_failed: "practice.wf.err.aiFailed",
  analysis_empty: "practice.wf.err.aiFailed",
  unauthorized: "practice.wf.err.unauthorized",
};

/** Lời nhắn cho từng mã lỗi (mặc định tiếng Việt; truyền `lang` để dịch). */
export function describeWritingError(code: string | undefined, lang: UiLang = "vi"): string {
  return tr(lang, (code ? WRITING_ERROR_KEY[code] : undefined) ?? "practice.wf.err.default");
}
