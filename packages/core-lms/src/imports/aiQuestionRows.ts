import { parseRawMcqRows, type ParseMcqResult } from "./mcqTemplate";

/**
 * Một câu hỏi do AI trích xuất từ văn bản tự do (dán từ Word, ghi tay...). Shape
 * này do `extractQuestionsFromText` (packages/core-feedback/src/aiTutor) sinh ra
 * — AI CHỈ làm việc đọc hiểu (tách prompt/đáp án khỏi văn bản lộn xộn), không tự
 * quyết câu nào hợp lệ.
 */
export interface AiExtractedQuestion {
  type: "mcq" | "true_false";
  prompt: string;
  options: Array<{ label: string; isCorrect: boolean }>;
  explanation: string | null;
  topic: string | null;
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

/**
 * Biến output của AI thành "dòng thô" đúng shape mà `parseRawMcqRows` (Excel
 * import) đang tiêu thụ, rồi chạy qua ĐÚNG hàm validate xác định đó.
 *
 * Đây là nguyên tắc an toàn cốt lõi của AI import: AI không được tự quyết câu
 * nào hợp lệ. Một câu AI đọc thiếu đáp án đúng (mọi option isCorrect=false) thì
 * đi qua đây vẫn bị validate bắt lỗi y hệt như một dòng Excel thiếu cột Correct
 * — không có nhánh nào cho AI tự "đoán cho đủ" hay tự gắn nhãn "ok".
 *
 * Giới hạn 6 đáp án (A-F): khớp đúng giới hạn cột OptionA..F của template Excel.
 * Câu AI trả về nhiều hơn 6 lựa chọn thì chỉ giữ 6 đầu tiên — không throw, để
 * validate tự xử lý phần còn lại (đủ ≥2 đáp án là qua).
 */
export function aiQuestionsToParseResult(
  questions: AiExtractedQuestion[],
): ParseMcqResult {
  const rawRows: Record<string, string>[] = questions.map((q) => {
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
    return row;
  });
  return parseRawMcqRows(rawRows);
}
