import { z } from "zod";

/**
 * Zod schemas for ExamQuestion.config — one per question type.
 * The DB column is Json; these schemas validate shape at create/update time.
 */

/**
 * Giải thích đáp án — HS thấy sau khi bài được chấm, và chỉ khi đề bật
 * `showResultsAfterSubmit`. Sống trong config (không phải cột riêng) vì
 * getExamAttemptReview() đã đọc `config.explanation` từ đầu.
 *
 * Mọi config schema PHẢI trải trường này vào object gốc — zod mặc định
 * loại bỏ khoá lạ, nên thiếu nó là giải thích bị xoá âm thầm lúc lưu.
 */
const explanationField = {
  explanation: z.string().trim().max(2_000).optional(),
};

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(2_000),
  isCorrect: z.boolean(),
});

export const McqConfig = z
  .object({
    options: z.array(optionSchema).min(2).max(10),
    ...explanationField,
  })
  .refine((c) => c.options.filter((o) => o.isCorrect).length === 1, {
    message: "MCQ must have exactly one correct option",
  })
  .refine((c) => new Set(c.options.map((o) => o.id)).size === c.options.length, {
    message: "option ids must be unique",
  });

export const MultiConfig = z
  .object({
    options: z.array(optionSchema).min(2).max(10),
    ...explanationField,
  })
  .refine((c) => c.options.some((o) => o.isCorrect), {
    message: "MULTI must have at least one correct option",
  })
  .refine((c) => new Set(c.options.map((o) => o.id)).size === c.options.length, {
    message: "option ids must be unique",
  });

export const TrueFalseNotGivenConfig = z.object({
  correct: z.enum(["true", "false", "notgiven"]),
  ...explanationField,
});

const blankSchema = z.object({
  id: z.string().min(1),
  acceptedAnswers: z.array(z.string().min(1).max(200)).min(1).max(20),
  matchMode: z.enum(["exact", "case_insensitive"]).default("case_insensitive"),
});

export const GapFillConfig = z.object({
  blanks: z.array(blankSchema).min(1).max(20),
  ...explanationField,
});

export const ShortAnswerConfig = z.object({
  acceptedAnswers: z.array(z.string().min(1).max(200)).min(1).max(20),
  matchMode: z.enum(["exact", "case_insensitive"]).default("case_insensitive"),
  ...explanationField,
});

export const EssayConfig = z.object({
  /** Tiêu chí đánh giá: giảng viên viết điều AI cần xét khi góp ý câu trả lời. */
  rubric: z.string().max(5_000).optional(),
  minWords: z.number().int().positive().max(10_000).optional(),
  /** Bài mẫu (Sample answer) là `explanation`; audio của bài mẫu là đường dẫn tệp trong kho đề (`/api/exam-assets/<tên>`). */
  explanationAudio: z.string().max(500).regex(/^\/api\/exam-assets\/[A-Za-z0-9._-]+$/).optional(),
  /** Bài luyện nhúng: cho học viên trả lời bằng giọng nói (mặc định bật). */
  voiceAnswer: z.boolean().optional(),
  /** Bài luyện nhúng: AI góp ý câu trả lời ngay khi học viên kiểm tra (mặc định bật). */
  aiFeedback: z.boolean().optional(),
  ...explanationField,
});

// ---------------------------------------------------------------------------
// Đợt 0 (thống nhất luồng nhập câu hỏi Quiz/Bank/Exam) — 4 loại câu chỉ Quiz có
// trước đây, nay đưa vào bộ chuẩn dùng chung. Xem bảng đối chiếu đã chốt với
// người dùng: `mcq`/`multi` tách biệt, `true_false` giữ 3 lựa chọn (đã có ở
// trên), `fill_in` của Quiz là tập con của `short_answer` (đã có, không cần
// schema riêng — xem packages/core-lms/src/quizzes/grading.ts case "fill_in"
// và "short_answer": cùng cơ chế so khớp accepted-answers, short_answer chỉ
// thêm regex mà bản chuẩn cố tình bỏ). `matching_heading` (P1, chưa build) đổi
// tên thành `matching`, lấy cấu trúc đã chạy tốt của Quiz làm chuẩn.
// ---------------------------------------------------------------------------

const orderingItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(2_000),
});

/**
 * Sắp xếp thứ tự. Thứ tự các phần tử TRONG MẢNG `items` chính là thứ tự đúng
 * (giống cách Quiz coi orderIndex của option là thứ tự chuẩn) — không có
 * trường "correctOrder" riêng để tránh hai nguồn sự thật lệch nhau.
 */
export const OrderingConfig = z
  .object({
    items: z.array(orderingItemSchema).min(2).max(20),
    ...explanationField,
  })
  .refine((c) => new Set(c.items.map((i) => i.id)).size === c.items.length, {
    message: "item ids must be unique",
  });

const matchingPairSchema = z.object({
  id: z.string().min(1),
  left: z.string().min(1).max(2_000),
  right: z.string().min(1).max(2_000),
});

/**
 * Ghép đôi. Mỗi phần tử `pairs` gom sẵn cả hai vế (left/right) của một cặp —
 * đơn giản hơn cách Quiz lưu (2 option rời + extra.side/pairKey phải tự đối
 * chiếu), dễ validate và dễ hiển thị hơn. Cột trái/phải xáo trộn độc lập ở
 * tầng hiển thị, không ảnh hưởng cấu trúc lưu.
 */
export const MatchingConfig = z
  .object({
    pairs: z.array(matchingPairSchema).min(2).max(20),
    ...explanationField,
  })
  .refine((c) => new Set(c.pairs.map((p) => p.id)).size === c.pairs.length, {
    message: "pair ids must be unique",
  });

/** Số học — đáp án là một số, chấp nhận sai số ±tolerance (mặc định 0 = khớp tuyệt đối). */
export const NumericalConfig = z.object({
  expected: z.number(),
  tolerance: z.number().min(0).max(1_000_000).default(0),
  ...explanationField,
});

const dragDropTokenSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  /**
   * Chỗ trống (1-based) mà token này thuộc về, khớp với ký hiệu `[[N]]` trong
   * `prompt` của câu hỏi (prompt là cột riêng, KHÔNG nằm trong config này —
   * tầng gọi service chịu trách nhiệm đối chiếu `[[N]]` trong prompt khớp với
   * các blankIndex ở đây, giống cách AddQuestionForm.tsx làm phía client cho
   * Quiz). null = mồi nhử, không thuộc chỗ trống nào.
   */
  blankIndex: z.number().int().positive().nullable(),
});

/** Kéo-thả điền từ. Chấm all-or-nothing — mọi chỗ trống phải đúng, không có điểm từng phần. */
export const DragDropFillConfig = z
  .object({
    tokens: z.array(dragDropTokenSchema).min(1).max(20),
    ...explanationField,
  })
  .refine((c) => new Set(c.tokens.map((t) => t.id)).size === c.tokens.length, {
    message: "token ids must be unique",
  })
  .refine((c) => c.tokens.some((t) => t.blankIndex !== null), {
    message: "phải có ít nhất 1 chỗ trống thật (blankIndex khác null) — không chỉ toàn mồi nhử",
  });

// ---------------------------------------------------------------------------
// Đề Khảo sát (docs/tieu-chi/de-thi-khao-sat.md) — câu KHÔNG có đáp án đúng.
// Cùng tên loại câu với đề thường (mcq/multi/short_answer/essay) để dùng lại
// trình làm bài, nhưng cấu hình riêng: không isCorrect, không acceptedAnswers,
// không rubric. `code` là "Mã câu" (tiêu đề cột khi xuất), không hiện cho học viên.
// ---------------------------------------------------------------------------

const surveyCodeField = {
  code: z
    .string()
    .trim()
    .max(20)
    .regex(/^[\p{L}\p{N}_.-]*$/u, "Mã câu chỉ gồm chữ, số và _ . -")
    .optional()
    .transform((v) => (v ? v : undefined)),
};

const surveyOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(2_000),
});

const uniqueOptionIds = (c: { options: Array<{ id: string }> }) =>
  new Set(c.options.map((o) => o.id)).size === c.options.length;

export const SurveyChoiceConfig = z
  .object({ options: z.array(surveyOptionSchema).min(2).max(10), ...surveyCodeField })
  .refine(uniqueOptionIds, { message: "option ids must be unique" });

export const SurveyTextConfig = z.object({ ...surveyCodeField });

/** Thang trượt: giá trị trong [min, max], cách min một bội số của step. */
export const SliderConfig = z
  .object({
    min: z.number().int().min(-1_000).max(1_000),
    max: z.number().int().min(-1_000).max(1_000),
    step: z.number().int().positive().max(1_000),
    minLabel: z.string().trim().max(60).optional(),
    maxLabel: z.string().trim().max(60).optional(),
    ...surveyCodeField,
  })
  .refine((c) => c.max > c.min, { message: "max phải lớn hơn min", path: ["max"] })
  .refine((c) => (c.max - c.min) % c.step === 0, {
    message: "khoảng (max - min) phải chia hết cho bước",
    path: ["step"],
  });

/** Loại câu dùng được trong đề Khảo sát. */
export const SURVEY_QUESTION_TYPES = ["mcq", "multi", "short_answer", "essay", "slider"] as const;

export function isSurveyQuestionType(type: string): boolean {
  return (SURVEY_QUESTION_TYPES as readonly string[]).includes(type);
}

/** Mã câu của một câu khảo sát (hoặc undefined). */
export function surveyQuestionCode(config: unknown): string | undefined {
  const code = (config as { code?: unknown } | null)?.code;
  return typeof code === "string" && code.trim() ? code.trim() : undefined;
}

/** Câu trả lời thang trượt có hợp lệ với cấu hình không. */
export function isValidSliderValue(config: unknown, value: unknown): value is number {
  const c = config as { min?: number; max?: number; step?: number } | null;
  if (!c || typeof value !== "number" || !Number.isFinite(value)) return false;
  const { min = 0, max = 0, step = 1 } = c;
  return value >= min && value <= max && (value - min) % step === 0;
}

/**
 * Discriminated by ExamQuestion.type. `opts.survey` = câu thuộc đề Khảo sát:
 * chỉ nhận các loại trong SURVEY_QUESTION_TYPES, với cấu hình không có đáp án.
 * Thang trượt chỉ có ở đề Khảo sát.
 */
export function configSchemaForType(type: string, opts: { survey?: boolean } = {}): z.ZodTypeAny {
  if (opts.survey) {
    switch (type) {
      case "mcq":
      case "multi":
        return SurveyChoiceConfig;
      case "short_answer":
      case "essay":
        return SurveyTextConfig;
      case "slider":
        return SliderConfig;
      default:
        return z.never();
    }
  }
  switch (type) {
    case "mcq":
      return McqConfig;
    case "multi":
      return MultiConfig;
    case "true_false_notgiven":
      return TrueFalseNotGivenConfig;
    case "gap_fill":
      return GapFillConfig;
    case "short_answer":
      return ShortAnswerConfig;
    case "essay":
      return EssayConfig;
    case "ordering":
      return OrderingConfig;
    case "matching":
      return MatchingConfig;
    case "numerical":
      return NumericalConfig;
    case "drag_drop_fill":
      return DragDropFillConfig;
    default:
      // "matching_heading" (tên cũ, chưa từng build) và loại lạ — reject.
      return z.never();
  }
}
