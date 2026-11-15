/**
 * Chữ hiển thị ở trang kết quả quiz, tách ra để kiểm thử được.
 *
 * Hai chỗ trước đây làm người học thấy "lệch" mà không ai giải thích:
 *  1. Điểm phần trăm tính theo ĐIỂM từng câu (câu 2 điểm nặng hơn câu 1 điểm)
 *     nên có thể khác tỷ lệ số câu đúng: 7/12 câu đúng mà điểm là 60%.
 *  2. Dòng "×0.5 (đã master)" là tiếng của hệ thống thưởng, không nói vì sao.
 */

import { translate, type UiLang } from "@/lib/i18n/core";
import { EN, VI } from "@/lib/i18n/dict";

/** 14.0 → "14"; 12.5 → "12,5" (dấu phẩy kiểu Việt; giao diện en dùng dấu chấm: "12.5"). */
export function formatPoints(n: number, lang: UiLang = "vi"): string {
  const rounded = Math.round(n * 10) / 10;
  return lang === "en" ? String(rounded) : String(rounded).replace(".", ",");
}

export interface ScoreSummary {
  /** Điểm người học đạt được, suy ra từ phần trăm đã lưu (đúng cả khi giảng viên chấm tay). */
  earnedPoints: number;
  totalPoints: number;
  /** Chỉ có khi phần trăm điểm lệch rõ so với tỷ lệ số câu đúng; null nếu không cần giải thích. */
  note: string | null;
}

export function summarizeScore(
  input: {
    scorePct: number | null;
    totalPoints: number;
    correctCount: number;
    totalQuestions: number;
  },
  lang: UiLang = "vi",
): ScoreSummary | null {
  const { scorePct, totalPoints, correctCount, totalQuestions } = input;
  if (scorePct === null || totalPoints <= 0 || totalQuestions <= 0) return null;
  const earnedPoints = Math.round(((scorePct / 100) * totalPoints) * 10) / 10;
  const ratioPct = (correctCount / totalQuestions) * 100;
  const differs = Math.abs(ratioPct - scorePct) >= 0.5;
  return {
    earnedPoints,
    totalPoints,
    note: differs ? translate(VI, EN, lang, "practice.result.scoreNote") : null,
  };
}

/** Câu giải thích hệ số thưởng XP; null khi hệ số là 1 (không có gì để nói). */
export function xpMultiplierNote(multiplier: number | undefined, lang: UiLang = "vi"): string | null {
  if (multiplier === undefined || multiplier === 1) return null;
  return translate(VI, EN, lang, multiplier < 1 ? "practice.result.xpLow" : "practice.result.xpHigh", {
    m: formatPoints(multiplier, lang),
  });
}
