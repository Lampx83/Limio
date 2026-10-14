/**
 * LANG G4 — hằng số flashcard dùng chung giữa core-feedback (lịch ôn) và apps/web
 * (giao diện). Thứ tự các mảng là thứ tự hiển thị.
 */

/** Bốn mức tự đánh giá sau khi lật thẻ. Khớp enum `FlashcardRating` trong schema. */
export const FLASHCARD_RATINGS = ["again", "hard", "good", "easy"] as const;
export type FlashcardRating = (typeof FLASHCARD_RATINGS)[number];

export const FLASHCARD_RATING_LABEL: Record<FlashcardRating, string> = {
  again: "Quên",
  hard: "Khó",
  good: "Được",
  easy: "Dễ",
};

/**
 * Ba cách hỏi. Chỉ đổi cách trình bày; lịch ôn dùng chung một bộ cho mọi chế độ.
 * Tên trung lập ngôn ngữ ("từ", không phải "Hán") để dùng được cho mọi ngoại ngữ.
 */
export const FLASHCARD_MODES = ["term_to_meaning", "meaning_to_term", "audio_to_term"] as const;
export type FlashcardMode = (typeof FLASHCARD_MODES)[number];

export const FLASHCARD_MODE_LABEL: Record<FlashcardMode, string> = {
  term_to_meaning: "Từ → nghĩa",
  meaning_to_term: "Nghĩa → từ",
  audio_to_term: "Nghe → từ",
};

/** Trần thẻ mới mỗi ngày (giờ Việt Nam) và số thẻ tối đa mỗi phiên. */
export const FLASHCARD_NEW_PER_DAY = 10;
export const FLASHCARD_SESSION_LIMIT = 20;

export function isFlashcardRating(v: unknown): v is FlashcardRating {
  return typeof v === "string" && (FLASHCARD_RATINGS as readonly string[]).includes(v);
}
export function isFlashcardMode(v: unknown): v is FlashcardMode {
  return typeof v === "string" && (FLASHCARD_MODES as readonly string[]).includes(v);
}
