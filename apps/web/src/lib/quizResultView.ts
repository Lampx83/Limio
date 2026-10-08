/**
 * Chữ hiển thị ở trang kết quả quiz, tách ra để kiểm thử được.
 *
 * Hai chỗ trước đây làm người học thấy "lệch" mà không ai giải thích:
 *  1. Điểm phần trăm tính theo ĐIỂM từng câu (câu 2 điểm nặng hơn câu 1 điểm)
 *     nên có thể khác tỷ lệ số câu đúng: 7/12 câu đúng mà điểm là 60%.
 *  2. Dòng "×0.5 (đã master)" là tiếng của hệ thống thưởng, không nói vì sao.
 */

/** 14.0 → "14"; 12.5 → "12,5" (dấu phẩy kiểu Việt). */
export function formatPoints(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return String(rounded).replace(".", ",");
}

export interface ScoreSummary {
  /** Điểm người học đạt được, suy ra từ phần trăm đã lưu (đúng cả khi giảng viên chấm tay). */
  earnedPoints: number;
  totalPoints: number;
  /** Chỉ có khi phần trăm điểm lệch rõ so với tỷ lệ số câu đúng; null nếu không cần giải thích. */
  note: string | null;
}

export function summarizeScore(input: {
  scorePct: number | null;
  totalPoints: number;
  correctCount: number;
  totalQuestions: number;
}): ScoreSummary | null {
  const { scorePct, totalPoints, correctCount, totalQuestions } = input;
  if (scorePct === null || totalPoints <= 0 || totalQuestions <= 0) return null;
  const earnedPoints = Math.round(((scorePct / 100) * totalPoints) * 10) / 10;
  const ratioPct = (correctCount / totalQuestions) * 100;
  const differs = Math.abs(ratioPct - scorePct) >= 0.5;
  return {
    earnedPoints,
    totalPoints,
    note: differs
      ? "Phần trăm được tính theo điểm của từng câu, nên có thể khác tỷ lệ số câu đúng vì mỗi câu có số điểm khác nhau."
      : null,
  };
}

/** Câu giải thích hệ số thưởng XP; null khi hệ số là 1 (không có gì để nói). */
export function xpMultiplierNote(multiplier: number | undefined): string | null {
  if (multiplier === undefined || multiplier === 1) return null;
  if (multiplier < 1) {
    return `Thưởng nhân ×${multiplier} vì bạn đã vững chủ đề này, nên bài dễ không được thưởng đủ.`;
  }
  return `Thưởng nhân ×${multiplier} vì chủ đề này còn khó với bạn.`;
}
