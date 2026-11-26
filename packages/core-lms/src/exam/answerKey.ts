/**
 * Đáp án của một câu hỏi dưới dạng các dòng chữ để hiện lên màn chiếu lớp (docs/tieu-chi/hsk-che-do-chieu-lop.md, A6).
 *
 * Hàm thuần: nhận `type` và `config` ĐẦY ĐỦ của câu (có đáp án) rồi trả chữ. Chỉ gọi ở máy chủ, sau khi đã kiểm quyền người dạy;
 * trình duyệt chỉ nhận kết quả đã rút gọn này, không nhận `config`.
 */
export interface AnswerKeyText {
  /** Mỗi dòng một đáp án (đã ghép thành chữ). Rỗng với câu mở: không có đáp án cố định. */
  lines: string[];
  explanation: string | null;
  /** Câu mở/chấm tay: không có đáp án cố định để hiện. */
  open: boolean;
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

export function answerKeyText(type: string, config: unknown): AnswerKeyText {
  const c = rec(config);
  const explanation = s(c.explanation) || null;
  let lines: string[] = [];
  switch (type) {
    case "mcq":
    case "multi":
      lines = arr(c.options)
        .map(rec)
        .filter((o) => o.isCorrect === true)
        .map((o) => s(o.label))
        .filter(Boolean);
      break;
    case "short_answer":
      lines = arr(c.acceptedAnswers).map(s).filter(Boolean).slice(0, 3);
      break;
    case "gap_fill": {
      const blanks = arr(c.blanks).map(rec);
      lines = blanks
        .map((b, i) => {
          const alts = arr(b.acceptedAnswers).map(s).filter(Boolean);
          if (!alts.length) return "";
          return blanks.length > 1 ? `${i + 1}. ${alts.join(" / ")}` : alts.join(" / ");
        })
        .filter(Boolean);
      break;
    }
    case "ordering":
      // `items` được lưu theo ĐÚNG thứ tự; chỉ bản gửi cho học viên mới xáo.
      lines = arr(c.items)
        .map((i) => s(rec(i).label))
        .filter(Boolean)
        .map((t, i) => `${i + 1}. ${t}`);
      break;
    case "matching":
      lines = arr(c.pairs)
        .map(rec)
        .map((p) => (s(p.left) && s(p.right) ? `${s(p.left)} → ${s(p.right)}` : ""))
        .filter(Boolean);
      break;
    case "numerical":
      lines = c.expected === undefined || c.expected === null ? [] : [s(c.expected)];
      break;
    case "drag_drop_fill":
      lines = arr(c.tokens)
        .map(rec)
        .filter((t) => typeof t.blankIndex === "number")
        .sort((a, b) => (a.blankIndex as number) - (b.blankIndex as number))
        .map((t) => `[${t.blankIndex}] ${s(t.label)}`);
      break;
    default:
      lines = [];
  }
  const open = lines.length === 0;
  return { lines, explanation, open };
}
