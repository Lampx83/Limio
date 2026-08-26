/**
 * Đọc một câu trả lời thô thành thứ con người và phần mềm thống kê đều dùng
 * được: phương án đã chọn, đáp án đúng, và phần trả lời bằng chữ.
 *
 * Sinh ra để xuất dữ liệu phân tích chất lượng câu hỏi (CTT/IRT). File kết quả
 * cũ chỉ ghi "Đúng"/"Sai" nên không phân tích được phương án nhiễu — muốn biết
 * câu nào có nhiễu chết (không ai chọn) hay nhiễu bẫy hơn cả đáp án thì phải
 * có LỰA CHỌN CỤ THỂ của từng thí sinh.
 */

/** Dạng answerJson mà trình làm bài ghi xuống. */
type AnswerJson =
  | { optionIds?: unknown }
  | { correct?: unknown }
  | { blanks?: unknown }
  | { text?: unknown }
  | null;

/**
 * Vị trí phương án → chữ cái.
 *
 * Lấy theo THỨ TỰ GỐC trong cấu hình câu hỏi, không phải thứ tự thí sinh nhìn
 * thấy: đề có thể xáo phương án từng người, nên "A" trên màn hình mỗi người
 * một khác. Phân tích nhiễu chỉ có nghĩa khi mọi người quy về cùng một mốc.
 */
export function optionLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : `#${index + 1}`;
}

export interface ResponseDescription {
  /** Phương án thí sinh chọn, ví dụ "A" hoặc "A;C". Rỗng nếu không phải trắc nghiệm. */
  chosen: string;
  /** Đáp án đúng, cùng định dạng với `chosen`. */
  key: string;
  /** Phần trả lời bằng chữ (điền khuyết, tự luận). Rỗng nếu không có. */
  text: string;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function describeResponse(
  type: string,
  config: unknown,
  answerJson: unknown,
): ResponseDescription {
  const empty: ResponseDescription = { chosen: "", key: "", text: "" };
  const cfg = asRecord(config);
  const ans = asRecord(answerJson) as AnswerJson;

  switch (type) {
    case "mcq":
    case "multi":
    case "matching_heading": {
      const options = Array.isArray(cfg?.options)
        ? (cfg!.options as Array<Record<string, unknown>>)
        : [];
      const letterById = new Map<string, string>();
      const keyLetters: string[] = [];
      options.forEach((o, i) => {
        const id = typeof o.id === "string" ? o.id : String(i);
        letterById.set(id, optionLetter(i));
        if (o.isCorrect === true) keyLetters.push(optionLetter(i));
      });
      const raw = ans && "optionIds" in ans ? ans.optionIds : null;
      const chosenIds = Array.isArray(raw)
        ? raw.filter((x): x is string => typeof x === "string")
        : [];
      // Sắp theo thứ tự phương án chứ không theo thứ tự bấm, để hai thí sinh
      // chọn cùng bộ đáp án luôn ra cùng một chuỗi — nếu không thì đếm tần
      // suất sẽ tách "A;C" và "C;A" thành hai nhóm.
      const chosen = chosenIds
        .map((id) => letterById.get(id))
        .filter((l): l is string => !!l)
        .sort();
      return { chosen: chosen.join(";"), key: keyLetters.join(";"), text: "" };
    }

    case "true_false_notgiven": {
      const chosen = ans && "correct" in ans && typeof ans.correct === "string" ? ans.correct : "";
      const key = typeof cfg?.correct === "string" ? cfg.correct : "";
      return { chosen, key, text: "" };
    }

    case "gap_fill": {
      const blanks = Array.isArray(cfg?.blanks)
        ? (cfg!.blanks as Array<Record<string, unknown>>)
        : [];
      const submitted = asRecord(ans && "blanks" in ans ? ans.blanks : null) ?? {};
      const parts = blanks.map((b) => {
        const id = typeof b.id === "string" ? b.id : "";
        const v = submitted[id];
        return typeof v === "string" ? v : "";
      });
      const key = blanks
        .map((b) =>
          Array.isArray(b.acceptedAnswers) ? (b.acceptedAnswers as unknown[]).join("|") : "",
        )
        .join(" / ");
      return { chosen: "", key, text: parts.join(" / ") };
    }

    case "short_answer":
    case "essay": {
      const text = ans && "text" in ans && typeof ans.text === "string" ? ans.text : "";
      return { chosen: "", key: "", text };
    }

    default:
      return empty;
  }
}
