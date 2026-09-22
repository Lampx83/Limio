import type { AiExtractedQuestion } from "./aiQuestionRows";
import type { ParsedQuestionRow, ParseResult } from "../exam/import";
import { configSchemaForType } from "../exam/schemas";

/**
 * Biến `AiExtractedQuestion[]` thành `ParsedQuestionRow[]` (shape mà Exam
 * dùng — packages/core-lms/src/exam/import.ts), song song với
 * `aiQuestionsToParseResult` (Bank/Quiz). Không đi qua khuôn "dòng thô Excel"
 * như bên Bank/Quiz vì Exam's ParsedQuestionRow đã là JSON structured sẵn —
 * dựng config trực tiếp rồi validate bằng ĐÚNG `configSchemaForType()` mà
 * Excel import Exam dùng, giữ nguyên tắc "AI chỉ đọc hiểu, không tự quyết
 * câu nào hợp lệ".
 *
 * true_false: suy `correct` TRỰC TIẾP từ nội dung nhãn (không qua vị trí A/B
 * như commitToBank.ts từng làm trước khi sửa bug) — xem normalizeTrueFalse
 * bên dưới, cùng regex với aiQuestionRows.ts.
 *
 * passageId luôn null, skillIds luôn [] — AI import không gắn đoạn văn hay
 * skill (đó là việc của luồng Excel/manual, đã có UI riêng để làm sau khi
 * import).
 */

const OPTION_IDS = ["a", "b", "c", "d", "e", "f"] as const;

const TRUE_LABEL = /^(đúng|dung|true|yes|correct)$/i;
const FALSE_LABEL = /^(sai|false|no|incorrect)$/i;

function trueFalseCorrect(
  options: Array<{ label: string; isCorrect: boolean }>,
): "true" | "false" {
  // Không suy từ vị trí (xem lỗi từng gặp ở commitToBank.ts) — suy trực tiếp
  // từ option nào có isCorrect=true, rồi đọc NHÃN của chính option đó xem nó
  // là "Đúng" hay "Sai". AI có thể trả 2 nhãn theo thứ tự bất kỳ; cái quyết
  // định luôn là isCorrect đi kèm với nhãn nào, không phải option đó đứng
  // trước hay sau.
  const correct = options.find((o) => o.isCorrect);
  if (correct && TRUE_LABEL.test(correct.label.trim())) return "true";
  if (correct && FALSE_LABEL.test(correct.label.trim())) return "false";
  // Nhãn lạ (hiếm — prompt đã yêu cầu đúng 2 nhãn quen thuộc): fallback về
  // đúng option được đánh dấu isCorrect, coi label đầu là "true" nếu nó đúng.
  return options[0]?.isCorrect ? "true" : "false";
}

function withExplanation<T extends Record<string, unknown>>(
  config: T,
  explanation: string | null,
): T {
  return explanation ? { ...config, explanation } : config;
}

function baseRow(
  rowNumber: number,
  type: NonNullable<ParsedQuestionRow["parsed"]>["type"],
  prompt: string,
  rawConfig: unknown,
): ParsedQuestionRow {
  const errors: string[] = [];
  if (!prompt.trim()) errors.push("Thiếu câu hỏi");

  const schema = configSchemaForType(type);
  const result = schema.safeParse(rawConfig);
  if (!result.success) {
    errors.push(...result.error.issues.map((iss) => iss.message));
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
      type,
      prompt,
      passageId: null,
      passageTitleRaw: "",
      points: 1,
      difficulty: 2,
      config: result.data,
      skillIds: [],
      unresolvedSkillCodes: [],
      notes: null,
    },
  };
}

function mcqOrTrueFalseRow(
  q: Extract<AiExtractedQuestion, { type: "mcq" | "true_false" }>,
  rowNumber: number,
): ParsedQuestionRow {
  const options = q.options.slice(0, OPTION_IDS.length);
  if (q.type === "true_false") {
    const config = withExplanation(
      { correct: trueFalseCorrect(options) },
      q.explanation,
    );
    return baseRow(rowNumber, "true_false_notgiven", q.prompt ?? "", config);
  }
  const config = withExplanation(
    {
      options: options.map((o, i) => ({
        id: OPTION_IDS[i]!,
        label: o.label ?? "",
        isCorrect: o.isCorrect,
      })),
    },
    q.explanation,
  );
  return baseRow(rowNumber, "mcq", q.prompt ?? "", config);
}

function orderingRow(
  q: Extract<AiExtractedQuestion, { type: "ordering" }>,
  rowNumber: number,
): ParsedQuestionRow {
  const items = (q.items ?? []).map((it, i) => ({ id: `i${i + 1}`, label: it.label ?? "" }));
  const config = withExplanation({ items }, q.explanation);
  return baseRow(rowNumber, "ordering", q.prompt ?? "", config);
}

function matchingRow(
  q: Extract<AiExtractedQuestion, { type: "matching" }>,
  rowNumber: number,
): ParsedQuestionRow {
  const pairs = (q.pairs ?? []).map((p, i) => ({
    id: `p${i + 1}`,
    left: p.left ?? "",
    right: p.right ?? "",
  }));
  const config = withExplanation({ pairs }, q.explanation);
  return baseRow(rowNumber, "matching", q.prompt ?? "", config);
}

function fillInRow(
  q: Extract<AiExtractedQuestion, { type: "fill_in" }>,
  rowNumber: number,
): ParsedQuestionRow {
  const acceptedAnswers = (q.acceptedAnswers ?? [])
    .map((a) => a?.trim())
    .filter((a): a is string => !!a);
  const config = withExplanation(
    { acceptedAnswers, matchMode: "case_insensitive" as const },
    q.explanation,
  );
  return baseRow(rowNumber, "short_answer", q.prompt ?? "", config);
}

/**
 * `rowNumber` giữ đúng thứ tự xuất hiện trong văn bản gốc (không nhóm theo
 * loại) — giống `aiQuestionsToParseResult` bên Bank/Quiz.
 */
export function aiQuestionsToExamRows(questions: AiExtractedQuestion[]): ParseResult {
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
  const summary = {
    ok: rows.filter((r) => r.status === "ok").length,
    warning: rows.filter((r) => r.status === "warning").length,
    error: rows.filter((r) => r.status === "error").length,
    total: rows.length,
  };
  return { rows, summary };
}
