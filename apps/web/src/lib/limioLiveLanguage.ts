// Ngôn ngữ nội dung slide của bài giảng Limio-Live (docs/tieu-chi/ngon-ngu-slide.md): nhận ngôn ngữ từ chữ, ngôn ngữ ghi
// rõ trong mô tả, và chữ hệ thống viết lên slide theo ngôn ngữ đó. Hàm thuần, dùng được cả ở trình duyệt.
import { DECK_LANGUAGES, type DeckLanguage } from "@feedbackme/shared-types";

export { DECK_LANGUAGES, type DeckLanguage };

const CODES: readonly string[] = DECK_LANGUAGES.map((l) => l.code);

export function sanitizeDeckLanguage(v: unknown): DeckLanguage | null {
  return typeof v === "string" && CODES.includes(v) ? (v as DeckLanguage) : null;
}

// Chữ có dấu chỉ tiếng Việt dùng (bỏ á à â ã é è ê í ì ó ò ô õ ú ù ý vì tiếng Pháp, Tây Ban Nha, Bồ Đào Nha cũng có).
const VI_ONLY = new Set([..."ảạăằắẳẵặầấẩẫậẻẽẹềếểễệỉĩịỏọồốổỗộơờớởỡợủũụưừứửữựỳỷỹỵđ"]);
const EN_STOP = new Set(["the", "and", "of", "to", "is", "are", "in", "for", "with", "that", "on", "as", "by", "this", "from", "an", "or", "at", "be", "it", "how", "what", "why", "about", "between"]);
const LATIN_MIN = 40;
const CJK_MIN = 10;

/** Ngôn ngữ của một đoạn chữ; `null` khi quá ngắn hoặc không chắc (L2). */
export function detectLanguage(text: string): DeckLanguage | null {
  const t = text
    .normalize("NFC")
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/\d+/g, " ")
    .toLowerCase();
  const han = (t.match(/\p{Script=Han}/gu) ?? []).length;
  const kana = (t.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? []).length;
  const hangul = (t.match(/\p{Script=Hangul}/gu) ?? []).length;
  const latin = t.match(/\p{Script=Latin}/gu) ?? [];
  const cjk = han + kana + hangul;
  if (cjk >= CJK_MIN && cjk >= latin.length * 0.3) {
    if (hangul >= han + kana) return "ko";
    return kana * 10 >= han + kana ? "ja" : "zh";
  }
  if (latin.length < LATIN_MIN) return null;
  const viOnly = latin.filter((c) => VI_ONLY.has(c)).length;
  if (viOnly / latin.length >= 0.03) return "vi";
  const accented = latin.filter((c) => c > "z").length;
  const words = t.split(/[^\p{L}']+/u).filter(Boolean);
  const stop = words.filter((w) => EN_STOP.has(w)).length;
  if (accented / latin.length < 0.03 && stop >= 2 && stop / words.length >= 0.08) return "en";
  return null;
}

const VI_NAME: Record<string, DeckLanguage> = { anh: "en", "việt": "vi", trung: "zh", hoa: "zh", "nhật": "ja", "hàn": "ko", "pháp": "fr", "đức": "de" };
const EN_NAME: Record<string, DeckLanguage> = { english: "en", vietnamese: "vi", chinese: "zh", mandarin: "zh", japanese: "ja", korean: "ko", french: "fr", german: "de" };
const VI_NAMES = Object.keys(VI_NAME).join("|");
// "bằng tiếng Anh", "ngôn ngữ: tiếng Anh", "slide tiếng Anh"; chỉ nhắc tên môn ("ngữ pháp tiếng Anh") thì không tính.
const VI_EXPLICIT = new RegExp(`(?:^|[\\s,(])(?:bằng|ngôn ngữ(?:\\s+là)?\\s*:?|slides?(?:\\s+bằng)?)\\s+tiếng\\s+(${VI_NAMES})(?![\\p{L}])`, "u");
const EN_EXPLICIT = new RegExp(`(?:^|[\\s,(])(?:in|into)\\s+(${Object.keys(EN_NAME).join("|")})(?![\\p{L}])`, "u");

/** Ngôn ngữ giảng viên ghi rõ trong mô tả ("bài giảng bằng tiếng Anh", "in English"); không ghi thì `null` (L2b). */
export function explicitLanguage(text: string): DeckLanguage | null {
  const t = text.normalize("NFC").toLowerCase();
  const vi = VI_EXPLICIT.exec(t);
  if (vi) return VI_NAME[vi[1]!] ?? null;
  const en = EN_EXPLICIT.exec(t);
  return en ? EN_NAME[en[1]!] ?? null : null;
}

/** Ngôn ngữ của bài soạn từ mô tả: ngôn ngữ ghi rõ, không có thì theo chữ của mô tả (L3). */
export function topicLanguage(topic: string): DeckLanguage | null {
  return explicitLanguage(topic) ?? detectLanguage(topic);
}

// Khoá cấu hình slide không phải nội dung người học đọc (ghi chú giảng, ảnh, trang trí, nhãn kỹ thuật, dòng bìa tự điền).
const SKIP_KEYS = /^(notes|image\w*|motif|coverStyle|layout|icon|tone|cite|href|url|type|illustration|hidden|byline|org\w*|presenter\w*|mode|correct|id)$/i;

/** Chữ nội dung của một slide để nhận ngôn ngữ (L4). */
export function configText(config: unknown): string {
  const out: string[] = [];
  const walk = (v: unknown, key: string) => {
    if (SKIP_KEYS.test(key)) return;
    if (typeof v === "string") {
      if (v.trim() && !/^(https?:|\/)/.test(v)) out.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, ""));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(config, "");
  return out.join("\n");
}

/** Bài cũ chưa có ngôn ngữ: theo chữ của slide, rồi dàn ý, rồi tài liệu gốc (L4). */
export function inferDeckLanguage(input: { slides: unknown[]; outlineText: string; sourceText: string }): DeckLanguage | null {
  return (
    detectLanguage(input.slides.map(configText).join("\n")) ?? detectLanguage(input.outlineText) ?? detectLanguage(input.sourceText)
  );
}

export interface SlideText {
  /** Đuôi tiêu đề của slide tách ra ("Mục tiêu (tiếp)"). */
  cont: string;
  isCont: (title: string) => boolean;
  mainContent: string;
  part: (n: number) => string;
  newPart: string;
  references: string;
  /** Nhãn dòng nguồn ("Nguồn: [1]"). */
  source: string;
  imageSource: string;
  unit: string;
  series: (n: number) => string;
  data: string;
  /** Mở đầu ghi chú giảng của slide Nguồn tham khảo. */
  webNote: string;
}

const CONT_RE = /\((?:tiếp|cont\.)\)\s*$/i;

const VI_TEXT: SlideText = {
  cont: " (tiếp)",
  isCont: (t) => CONT_RE.test(t),
  mainContent: "Nội dung chính",
  part: (n) => `Phần ${n}`,
  newPart: "Phần mới",
  references: "Nguồn tham khảo",
  source: "Nguồn",
  imageSource: "Nguồn ảnh",
  unit: "Đơn vị",
  series: (n) => `Chuỗi ${n}`,
  data: "Số liệu",
  webNote: "Các trang AI đã đọc khi soạn bài:",
};

const EN_TEXT: SlideText = {
  cont: " (cont.)",
  isCont: (t) => CONT_RE.test(t),
  mainContent: "Main content",
  part: (n) => `Part ${n}`,
  newPart: "New section",
  references: "References",
  source: "Source",
  imageSource: "Image source",
  unit: "Unit",
  series: (n) => `Series ${n}`,
  data: "Data",
  webNote: "Pages the AI read while preparing this lecture:",
};

/** Đổi đuôi "(tiếp)" do bộ dựng slide (vốn viết tiếng Việt) thêm vào sang đuôi của ngôn ngữ bài. */
export function localizeCont(title: string, lang: string | null | undefined): string {
  const t = slideText(lang);
  return t === VI_TEXT ? title : title.replace(/\s*\(tiếp\)\s*$/, t.cont);
}

/** Chữ hệ thống trên slide: tiếng Việt khi bài tiếng Việt hoặc chưa xác định; ngôn ngữ khác dùng tạm tiếng Anh (L11). */
export function slideText(lang: string | null | undefined): SlideText {
  return !lang || lang === "vi" ? VI_TEXT : EN_TEXT;
}
