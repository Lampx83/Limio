/**
 * LANG đợt 2 — Thư viện giáo trình (docs/tieu-chi/limio-language-hoc-vien-dot-2.md). Hằng số dùng chung vì
 * core-lms (ghi, lọc) và apps/web (hiển thị nhãn) đều cần.
 */

/** Kỹ năng trọng tâm của giáo trình. Rộng hơn `LANGUAGE_SKILLS`: ngữ pháp và từ vựng không phải một trong bốn kỹ năng. */
export const LIBRARY_FOCUS_TAGS = ["reading", "listening", "speaking", "writing", "grammar", "vocabulary"] as const;
export type LibraryFocusTag = (typeof LIBRARY_FOCUS_TAGS)[number];

export const LIBRARY_FOCUS_LABEL: Record<LibraryFocusTag, string> = {
  reading: "Đọc",
  listening: "Nghe",
  speaking: "Nói",
  writing: "Viết",
  grammar: "Ngữ pháp",
  vocabulary: "Từ vựng",
};

export const LIBRARY_FOCUS_MAX = 6;
export const LIBRARY_TEXT_MAX = 120;

/** Đường dẫn công khai của ảnh bìa khoá tải lên từ máy (route `/api/course-covers/[file]`); dùng chung cho kiểm đầu vào và phục vụ tệp. */
export const COURSE_COVER_PATH_PREFIX = "/api/course-covers/";

/** Thứ tự các mức CEFR. */
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export function isLibraryFocusTag(v: unknown): v is LibraryFocusTag {
  return typeof v === "string" && (LIBRARY_FOCUS_TAGS as readonly string[]).includes(v);
}

/**
 * "A2" → [A2, A2]; "B1-B2" → [B1, B2]. Sai định dạng, mức không có, hoặc mức đầu cao hơn mức sau → null.
 * Dùng chung để kiểm khi lưu và để lọc theo giao nhau khoảng.
 */
export function parseLevelBand(v: string): [CefrLevel, CefrLevel] | null {
  const m = /^(A1|A2|B1|B2|C1|C2)(?:-(A1|A2|B1|B2|C1|C2))?$/.exec(v);
  if (!m) return null;
  const from = m[1] as CefrLevel;
  const to = (m[2] ?? m[1]) as CefrLevel;
  return CEFR_LEVELS.indexOf(from) <= CEFR_LEVELS.indexOf(to) ? [from, to] : null;
}

/** Hai khoảng trình độ có giao nhau không. Cả hai phải hợp lệ, không thì false. */
export function levelBandsOverlap(a: string, b: string): boolean {
  const x = parseLevelBand(a);
  const y = parseLevelBand(b);
  if (!x || !y) return false;
  const i = (l: CefrLevel) => CEFR_LEVELS.indexOf(l);
  return i(x[0]) <= i(y[1]) && i(y[0]) <= i(x[1]);
}
