/**
 * Đợt 2 (thống nhất "Nhập thủ công" Quiz/Ngân hàng/Đề thi) — vocabulary + shape
 * DÙNG CHUNG cho picker + editor ở tầng UI. Đặt tên/shape khớp 1-1 với
 * `configSchemaForType()` ở packages/core-lms/src/exam/schemas.ts — nơi đó là
 * "Đợt 0", đã chốt với user trước khi có refactor này (xem comment đầu file
 * đó). Bank/Đề thi backend đã nói đúng vocabulary này rồi (config JSON blob),
 * nên adapter của 2 nơi đó gần như truyền thẳng.
 *
 * Quiz KHÔNG đổi backend/data shape (quyết định 2026-09-22, tách biệt Quiz
 * LMS khỏi Bank/Đề thi để sau này có thể tách app riêng mà không ảnh hưởng
 * nhau) — Quiz vẫn dùng `options[]` table + tên loại riêng (`true_false`,
 * `fill_in`, không có `multi` tách biệt). Adapter của Quiz (Đợt 3) chịu trách
 * nhiệm dịch 2 chiều canonical ⇄ shape/tên của Quiz; state ở file này KHÔNG
 * phải wire format của Quiz.
 *
 * Đổi tên/shape ở đây mà không soát lại exam/schemas.ts (và ngược lại) sẽ làm
 * 2 nơi lệch nhau — luôn sửa cả hai cùng lúc.
 */

export const QUESTION_TYPES = [
  "mcq",
  "multi",
  "true_false_notgiven",
  "gap_fill",
  "short_answer",
  "essay",
  "ordering",
  "matching",
  "numerical",
  "drag_drop_fill",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface McqOption {
  id: string;
  label: string;
  isCorrect: boolean;
  /**
   * Quiz-only: gắn misconception cho đáp án sai để sinh feedback chẩn đoán
   * (B9 SSMMD). Bank/Đề thi không có khái niệm này — adapter của 2 nơi đó bỏ
   * qua field này khi build config.
   */
  misconceptionId?: string | null;
}

export interface McqDraft {
  options: McqOption[];
}

export interface MultiDraft {
  options: McqOption[];
}

export interface TrueFalseNotGivenDraft {
  correct: "true" | "false" | "notgiven" | null;
}

export interface GapFillBlank {
  id: string;
  acceptedAnswers: string[];
  matchMode: "exact" | "case_insensitive";
}

export interface GapFillDraft {
  blanks: GapFillBlank[];
}

export interface ShortAnswerDraft {
  acceptedAnswers: string[];
  matchMode: "exact" | "case_insensitive";
  /** Quiz-only nâng cao (regex thay vì so khớp chuỗi). Bank/Đề thi bỏ qua. */
  acceptedRegexes?: string[];
}

export interface EssayDraft {
  rubric?: string;
  minWords?: number;
}

export interface OrderingItem {
  id: string;
  label: string;
}

export interface OrderingDraft {
  items: OrderingItem[];
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface MatchingDraft {
  pairs: MatchingPair[];
}

export interface NumericalDraft {
  expected: number | null;
  tolerance: number;
}

export interface DragDropToken {
  id: string;
  label: string;
  /** Chỗ trống (1-based) token này thuộc về, khớp `[[N]]` trong prompt. null = mồi nhử. */
  blankIndex: number | null;
}

export interface DragDropFillDraft {
  tokens: DragDropToken[];
}

export type QuestionDraftByType = {
  mcq: McqDraft;
  multi: MultiDraft;
  true_false_notgiven: TrueFalseNotGivenDraft;
  gap_fill: GapFillDraft;
  short_answer: ShortAnswerDraft;
  essay: EssayDraft;
  ordering: OrderingDraft;
  matching: MatchingDraft;
  numerical: NumericalDraft;
  drag_drop_fill: DragDropFillDraft;
};

/** Nhãn hiển thị tiếng Việt — dùng chung ở picker, chip loại câu, danh sách... */
export const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "TN 1 đáp án",
  multi: "TN nhiều đáp án",
  true_false_notgiven: "Đúng / Sai",
  gap_fill: "Điền khuyết",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
  ordering: "Sắp xếp",
  matching: "Ghép cặp",
  numerical: "Điền số",
  drag_drop_fill: "Kéo thả",
};

/**
 * 5 loại AI import sinh được (xem apps/web/src/components/instructor/ImportMcqModal.tsx,
 * dòng "Hỗ trợ 5 loại: trắc nghiệm, đúng/sai, sắp xếp thứ tự, ghép cặp, điền khuyết").
 * Dùng để gắn badge "✨ AI" trên picker — cùng pattern badge đã có ở
 * ActivityPicker.tsx (tile "Văn bản" có badge AI tương tự).
 */
export const AI_SUPPORTED_TYPES: ReadonlySet<QuestionType> = new Set([
  "mcq",
  "true_false_notgiven",
  "ordering",
  "matching",
  "gap_fill",
]);
