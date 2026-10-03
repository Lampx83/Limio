/**
 * LANG G4 — lịch ôn cách quãng cho flashcard. Toàn bộ là hàm thuần: cùng đầu vào cho
 * cùng kết quả, không đọc đồng hồ (thời điểm luôn do người gọi truyền vào).
 *
 * Biến thể SM-2 đơn giản, mức hạt là NGÀY. Bốn mức tự đánh giá:
 *
 *   thẻ mới (hoặc vừa bị Quên, repetitions = 0):  Quên 1 · Khó 1 · Được 2 · Dễ 4 ngày
 *   thẻ đã thuộc (repetitions ≥ 1), khoảng I, độ dễ E:
 *     Quên  → 1 ngày, repetitions = 0, lapses + 1, E − 0.2
 *     Khó   → max(1, round(I × 1.2)),            E − 0.15
 *     Được  → max(I + 1, round(I × E)),          E giữ nguyên
 *     Dễ    → max(Được + 1, round(I × E × 1.3)), E + 0.15
 *
 * Ràng buộc luôn đúng (có test trên lưới trạng thái): Quên ≤ Khó ≤ Được ≤ Dễ;
 * E ∈ [1.3, 3.0]; khoảng ∈ [1, 365] ngày; lapses không bao giờ giảm.
 *
 * Hạn là ĐẦU ngày giờ Việt Nam của ngày thứ N, không phải đúng giờ đã ôn: học viên
 * ôn lúc 22:00 hẹn 1 ngày thì sáng mai mở là thấy thẻ, không phải chờ tới 22:00.
 */

import type { FlashcardRating } from "@feedbackme/shared-types";

export const FLASHCARD_INITIAL_EASE = 2.5;
export const FLASHCARD_EASE_MIN = 1.3;
export const FLASHCARD_EASE_MAX = 3.0;
export const FLASHCARD_MAX_INTERVAL_DAYS = 365;
/** Khoảng từ mức này trở lên được tính là "Nhớ lâu". */
export const FLASHCARD_MATURE_AT_DAYS = 21;

const DAY_MS = 24 * 60 * 60 * 1000;
// Việt Nam UTC+7, không có giờ mùa hè — cùng chính sách múi giờ cố định của hệ thống.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface ScheduledReview extends SrsState {
  dueAt: Date;
}

export type CardStage = "new" | "learning" | "mature";

/** 00:00 giờ Việt Nam của ngày chứa `date`, trả về dưới dạng thời điểm UTC. */
export function vnDayStart(date: Date): Date {
  const t = date.getTime();
  return new Date(Math.floor((t + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS);
}

/** Khoá so sánh "cùng một từ": bỏ khác biệt hoa-thường, khoảng trắng và dạng Unicode. */
export function normalizeTerm(term: string): string {
  return term.normalize("NFC").trim().toLowerCase();
}

const FIRST_INTERVAL: Record<FlashcardRating, number> = { again: 1, hard: 1, good: 2, easy: 4 };

const clampInterval = (n: number) => Math.min(FLASHCARD_MAX_INTERVAL_DAYS, Math.max(1, n));
const clampEase = (n: number) => Math.min(FLASHCARD_EASE_MAX, Math.max(FLASHCARD_EASE_MIN, n));

function nextInterval(s: SrsState | null, rating: FlashcardRating): number {
  if (!s || s.repetitions === 0) return FIRST_INTERVAL[rating];
  const i = s.intervalDays;
  const e = s.easeFactor;
  if (rating === "again") return 1;
  if (rating === "hard") return clampInterval(Math.max(1, Math.round(i * 1.2)));
  const good = clampInterval(Math.max(i + 1, Math.round(i * e)));
  if (rating === "good") return good;
  return clampInterval(Math.max(good + 1, Math.round(i * e * 1.3)));
}

export function scheduleReview(s: SrsState | null, rating: FlashcardRating, now: Date): ScheduledReview {
  const intervalDays = nextInterval(s, rating);
  const ease = s?.easeFactor ?? FLASHCARD_INITIAL_EASE;
  const easeFactor =
    rating === "again" ? clampEase(ease - 0.2)
    : rating === "hard" ? clampEase(ease - 0.15)
    : rating === "easy" ? clampEase(ease + 0.15)
    : clampEase(ease);
  const wasLearned = !!s && s.repetitions > 0;
  return {
    easeFactor,
    intervalDays,
    repetitions: rating === "again" ? 0 : (s?.repetitions ?? 0) + 1,
    // Chỉ thẻ đã từng thuộc mới tính là "quên" (thẻ mới bấm Quên thì chưa có gì để quên).
    lapses: (s?.lapses ?? 0) + (rating === "again" && wasLearned ? 1 : 0),
    dueAt: new Date(vnDayStart(now).getTime() + intervalDays * DAY_MS),
  };
}

/** Bốn khoảng mà scheduleReview sẽ áp — để nút hiển thị không bao giờ lệch kết quả thật. */
export function previewIntervals(s: SrsState | null, now: Date): Record<FlashcardRating, number> {
  return {
    again: scheduleReview(s, "again", now).intervalDays,
    hard: scheduleReview(s, "hard", now).intervalDays,
    good: scheduleReview(s, "good", now).intervalDays,
    easy: scheduleReview(s, "easy", now).intervalDays,
  };
}

export function cardStage(s: Pick<SrsState, "intervalDays"> | null): CardStage {
  if (!s) return "new";
  return s.intervalDays >= FLASHCARD_MATURE_AT_DAYS ? "mature" : "learning";
}
