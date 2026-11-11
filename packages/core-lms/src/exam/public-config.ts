import { publicToken, seededShuffle } from "./public-tokens";

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
function objects(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
}

export function toPublicQuestionConfig(
  type: string,
  config: unknown,
  /**
   * Hạt giống xáo trộn cho Sắp xếp/Ghép cặp/Kéo thả (nên là mã lượt làm + mã câu): cùng hạt thì cùng thứ tự, nên tải lại trang không
   * đổi thứ tự; mỗi lượt làm một thứ tự khác. Bỏ trống thì xáo theo hạt rỗng (vẫn ổn định, chỉ không khác nhau giữa các học viên).
   */
  seed = "",
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
    case "ordering": {
      // Thứ tự phần tử trong `items` chính là thứ tự đúng: gửi xuống danh sách đã xáo (không trùng thứ tự đúng), mã đổi sang mã công khai.
      const items = objects(c.items).filter((i) => typeof i.id === "string");
      const shuffled = seededShuffle(items, `${seed}|ordering`, (r) => r.every((x, i) => x === items[i]));
      return { items: shuffled.map((i) => ({ id: publicToken(String(i.id)), label: i.label })) };
    }
    case "matching": {
      // Vế trái giữ thứ tự soạn, mã = mã cặp; vế phải xáo độc lập và dùng MÃ CÔNG KHAI (mã cặp thật nằm cạnh vế trái thì nhìn mã là biết cặp).
      const pairs = objects(c.pairs).filter((p) => typeof p.id === "string");
      const rights = seededShuffle(pairs, `${seed}|matching`, (r) => r.every((x, i) => x === pairs[i]));
      return {
        lefts: pairs.map((p) => ({ id: p.id, label: p.left })),
        rights: rights.map((p) => ({ id: publicToken(String(p.id)), label: p.right })),
      };
    }
    case "drag_drop_fill": {
      // Chỉ danh sách token (kèm mồi nhử) đã xáo, KHÔNG có `blankIndex` (đó chính là đáp án). Ô trống lấy từ [[N]] trong đề.
      const tokens = objects(c.tokens).filter((t) => typeof t.id === "string");
      const shuffled = seededShuffle(tokens, `${seed}|drag_drop_fill`, (r) => r.every((x, i) => x === tokens[i]));
      return { tokens: shuffled.map((t) => ({ id: publicToken(String(t.id)), label: t.label })) };
    }
    case "numerical":
      // Chỉ cần ô nhập số; `expected` và `tolerance` là đáp án.
      return {};
    case "essay":
      // Chỉ số từ tối thiểu và hai công tắc của học viên; bài mẫu, audio mẫu và tiêu chí đánh giá chỉ lộ sau khi kiểm tra.
      return {
        ...(typeof c.minWords === "number" ? { minWords: c.minWords } : {}),
        voiceAnswer: c.voiceAnswer !== false,
        aiFeedback: c.aiFeedback !== false,
      };
    case "slider": {
      // Thang trượt của đề Khảo sát — không có đáp án; mã câu (`code`) không gửi xuống.
      const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
      return {
        min: num(c.min, 0),
        max: num(c.max, 100),
        step: num(c.step, 1),
        ...(str(c.minLabel) ? { minLabel: str(c.minLabel) } : {}),
        ...(str(c.maxLabel) ? { maxLabel: str(c.maxLabel) } : {}),
      };
    }
    default:
      // true_false_notgiven, short_answer, và mọi loại chưa biết.
      return {};
  }
}

/**
 * Cấu hình ĐẦY ĐỦ dành cho màn xem lại đáp án (đáp án đã được lộ ở bước đó), kèm `reviewTokens` (mã gốc → mã công khai) cho Sắp xếp,
 * Ghép cặp, Kéo thả điền. Đáp án học viên lưu là mã công khai; trình duyệt không tự tính được HMAC nên dùng bảng này để đổi về mã gốc
 * khi so sánh với đáp án đúng. Loại khác trả nguyên cấu hình.
 */
export function withReviewTokens(type: string, config: unknown): unknown {
  const key = type === "ordering" ? "items" : type === "matching" ? "pairs" : type === "drag_drop_fill" ? "tokens" : null;
  if (!key || !config || typeof config !== "object") return config;
  const c = config as Record<string, unknown>;
  const reviewTokens: Record<string, string> = {};
  for (const o of objects(c[key])) if (typeof o.id === "string") reviewTokens[o.id] = publicToken(o.id);
  return { ...c, reviewTokens };
}
