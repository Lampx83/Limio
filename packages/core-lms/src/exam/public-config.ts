/**
 * Phần `config` của câu hỏi được phép gửi xuống trình duyệt của thí sinh.
 *
 * `ExamQuestion.config` chứa đáp án (`isCorrect`, `correct`, `acceptedAnswers`)
 * và lời giải (`explanation`). Truyền nguyên xi vào component client là đưa đáp
 * án cả đề vào RSC payload — thí sinh chỉ cần mở DevTools. Hàm này là whitelist:
 * chỉ giữ đúng những gì giao diện làm bài cần để vẽ câu hỏi; loại lạ thì trả
 * rỗng chứ không chuyển tiếp.
 *
 * Chấm điểm và xem lại đáp án đọc `config` đầy đủ từ DB ở server, không đi qua
 * hàm này.
 */
export function toPublicQuestionConfig(
  type: string,
  config: unknown,
): Record<string, unknown> {
  const c = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  switch (type) {
    case "mcq":
    case "multi": {
      const options = Array.isArray(c.options) ? c.options : [];
      return {
        options: options
          .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
          .map((o) => ({ id: o.id, label: o.label })),
      };
    }
    case "gap_fill": {
      const blanks = Array.isArray(c.blanks) ? c.blanks : [];
      return {
        blanks: blanks
          .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
          .map((b) => ({ id: b.id })),
      };
    }
    case "essay":
      return typeof c.minWords === "number" ? { minWords: c.minWords } : {};
    default:
      // true_false_notgiven, short_answer, và mọi loại chưa biết.
      return {};
  }
}
