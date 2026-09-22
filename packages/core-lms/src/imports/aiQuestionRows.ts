import { MatchingConfig, OrderingConfig, ShortAnswerConfig } from "../exam/schemas";
import {
  parseOneRow,
  summarizeRows,
  type ParsedMcqRow,
  type ParseMcqResult,
} from "./mcqTemplate";

/**
 * Một câu hỏi do AI trích xuất từ văn bản tự do (dán từ Word, ghi tay...). Shape
 * này do `extractQuestionsFromText` (packages/core-feedback/src/aiTutor) sinh ra
 * — AI CHỈ làm việc đọc hiểu (tách prompt/đáp án khỏi văn bản lộn xộn), không tự
 * quyết câu nào hợp lệ.
 *
 * mcq/true_false đi qua khuôn "dòng thô" của Excel import (parseOneRow) để dùng
 * chung validate. ordering/matching KHÔNG diễn đạt được bằng khuôn cột A-F đó
 * (cần chuỗi thứ tự / cặp ghép, không phải "chọn 1 trong N option") — có nhánh
 * validate riêng, dùng thẳng OrderingConfig/MatchingConfig (schemas.ts, đã dùng
 * chung với Bank/Exam từ Đợt 1).
 */
export type AiExtractedQuestion =
  | {
      type: "mcq" | "true_false";
      prompt: string;
      options: Array<{ label: string; isCorrect: boolean }>;
      explanation: string | null;
      topic: string | null;
    }
  | {
      type: "ordering";
      prompt: string;
      /** Đúng thứ tự = thứ tự trong mảng — AI không được tự sắp lại. */
      items: Array<{ label: string }>;
      explanation: string | null;
      topic: string | null;
    }
  | {
      type: "matching";
      prompt: string;
      pairs: Array<{ left: string; right: string }>;
      explanation: string | null;
      topic: string | null;
    }
  | {
      type: "fill_in";
      /** Câu có chỗ trống — giữ nguyên ký hiệu chỗ trống của văn bản gốc (không cần chuẩn hoá). */
      prompt: string;
      /** Mọi biến thể đáp án được chấp nhận (so không phân biệt hoa thường). */
      acceptedAnswers: string[];
      explanation: string | null;
      topic: string | null;
    };

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

/** Điền các field chung (points/difficulty/...) mặc định — giống hệt giá trị mặc định của parseOneRow. */
function emptyParsedDefaults() {
  return {
    points: 1,
    difficulty: 3 as const,
    cognitiveLevel: "apply" as const,
    code: null,
    learningOutcome: null,
    authorName: null,
    reviewStatus: null,
    editNote: null,
  };
}

function mcqOrTrueFalseRow(
  q: Extract<AiExtractedQuestion, { type: "mcq" | "true_false" }>,
  rowNumber: number,
): ParsedMcqRow {
  // Biến thành "dòng thô" đúng shape mà Excel import tiêu thụ, rồi chạy qua
  // ĐÚNG hàm validate xác định đó (parseOneRow) — nguyên tắc an toàn cốt lõi
  // của AI import: AI không được tự quyết câu nào hợp lệ. Một câu AI đọc thiếu
  // đáp án đúng (mọi option isCorrect=false) đi qua đây vẫn bị bắt lỗi y hệt
  // một dòng Excel thiếu cột Correct.
  //
  // Giới hạn 6 đáp án (A-F): khớp giới hạn cột OptionA..F của template Excel.
  // Câu AI trả nhiều hơn 6 lựa chọn thì chỉ giữ 6 đầu, không throw.
  const options = q.options.slice(0, OPTION_LETTERS.length);
  const row: Record<string, string> = {
    Prompt: q.prompt ?? "",
    Type: q.type === "true_false" ? "true_false" : "mcq",
    Correct: options
      .map((o, i) => (o.isCorrect ? (OPTION_LETTERS[i] as string) : null))
      .filter((letter): letter is string => letter !== null)
      .join(","),
    Explanation: q.explanation ?? "",
    Topic: q.topic ?? "",
  };
  options.forEach((o, i) => {
    row[`Option${OPTION_LETTERS[i]}`] = o.label ?? "";
  });
  return parseOneRow(row, rowNumber);
}

function orderingRow(
  q: Extract<AiExtractedQuestion, { type: "ordering" }>,
  rowNumber: number,
): ParsedMcqRow {
  const errors: string[] = [];
  if (!q.prompt?.trim()) errors.push("Thiếu câu hỏi");
  const items = (q.items ?? []).map((it, i) => ({ id: `i${i + 1}`, label: it.label ?? "" }));
  const cfg = OrderingConfig.safeParse({
    items,
    ...(q.explanation ? { explanation: q.explanation } : {}),
  });
  if (!cfg.success) {
    errors.push(...cfg.error.issues.map((iss) => iss.message));
  }
  if (errors.length > 0) {
    return { rowNumber, status: "error", errors, warnings: [] };
  }
  return {
    rowNumber,
    status: "ok",
    errors: [],
    warnings: [],
    parsed: {
      type: "ordering",
      prompt: q.prompt,
      options: [],
      items,
      explanation: q.explanation ?? null,
      topic: q.topic ?? null,
      ...emptyParsedDefaults(),
    },
  };
}

function matchingRow(
  q: Extract<AiExtractedQuestion, { type: "matching" }>,
  rowNumber: number,
): ParsedMcqRow {
  const errors: string[] = [];
  if (!q.prompt?.trim()) errors.push("Thiếu câu hỏi");
  const pairs = (q.pairs ?? []).map((p, i) => ({
    id: `p${i + 1}`,
    left: p.left ?? "",
    right: p.right ?? "",
  }));
  const cfg = MatchingConfig.safeParse({
    pairs,
    ...(q.explanation ? { explanation: q.explanation } : {}),
  });
  if (!cfg.success) {
    errors.push(...cfg.error.issues.map((iss) => iss.message));
  }
  if (errors.length > 0) {
    return { rowNumber, status: "error", errors, warnings: [] };
  }
  return {
    rowNumber,
    status: "ok",
    errors: [],
    warnings: [],
    parsed: {
      type: "matching",
      prompt: q.prompt,
      options: [],
      pairs,
      explanation: q.explanation ?? null,
      topic: q.topic ?? null,
      ...emptyParsedDefaults(),
    },
  };
}

function fillInRow(
  q: Extract<AiExtractedQuestion, { type: "fill_in" }>,
  rowNumber: number,
): ParsedMcqRow {
  const errors: string[] = [];
  if (!q.prompt?.trim()) errors.push("Thiếu câu hỏi");
  const acceptedAnswers = (q.acceptedAnswers ?? [])
    .map((a) => a?.trim())
    .filter((a): a is string => !!a);
  const cfg = ShortAnswerConfig.safeParse({
    acceptedAnswers,
    matchMode: "case_insensitive",
    ...(q.explanation ? { explanation: q.explanation } : {}),
  });
  if (!cfg.success) {
    errors.push(...cfg.error.issues.map((iss) => iss.message));
  }
  if (errors.length > 0) {
    return { rowNumber, status: "error", errors, warnings: [] };
  }
  return {
    rowNumber,
    status: "ok",
    errors: [],
    warnings: [],
    parsed: {
      type: "fill_in",
      prompt: q.prompt,
      options: [],
      acceptedAnswers,
      explanation: q.explanation ?? null,
      topic: q.topic ?? null,
      ...emptyParsedDefaults(),
    },
  };
}

/**
 * Biến mảng câu hỏi AI trích xuất thành `ParsedMcqRow[]` — cùng shape bảng
 * preview/commit mà Excel import dùng, nên `ImportMcqModal` tái dùng nguyên
 * không cần biết câu hỏi tới từ Excel hay từ AI. `rowNumber` giữ đúng thứ tự
 * xuất hiện trong văn bản gốc (không nhóm theo loại).
 */
export function aiQuestionsToParseResult(
  questions: AiExtractedQuestion[],
): ParseMcqResult {
  const rows = questions.map((q, i) => {
    const rowNumber = i + 1;
    switch (q.type) {
      case "ordering":
        return orderingRow(q, rowNumber);
      case "matching":
        return matchingRow(q, rowNumber);
      case "fill_in":
        return fillInRow(q, rowNumber);
      default:
        return mcqOrTrueFalseRow(q, rowNumber);
    }
  });
  return { rows, summary: summarizeRows(rows) };
}
