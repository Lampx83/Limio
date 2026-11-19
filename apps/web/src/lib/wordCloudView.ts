// Kiểu hiển thị của Word Cloud trên màn hình (phiên độc lập và slide Limio-Live).
// Chỉ là cách VẼ cùng một bảng tần suất — không đổi dữ liệu, không cần migration.

export const WORD_CLOUD_VIEWS = ["chips", "cloud", "bubbles", "bars"] as const;
export type WordCloudView = (typeof WORD_CLOUD_VIEWS)[number];

export const DEFAULT_WORD_CLOUD_VIEW: WordCloudView = "chips";

export const WORD_CLOUD_VIEW_LABEL: Record<WordCloudView, string> = {
  chips: "Thẻ màu",
  cloud: "Đám mây chữ",
  bubbles: "Bong bóng",
  bars: "Thanh xếp hạng",
};

/** Mô tả ngắn cho tooltip/ô chọn trong trình soạn slide. */
export const WORD_CLOUD_VIEW_HINT: Record<WordCloudView, string> = {
  chips: "Mỗi cụm từ là một viên thuốc màu, càng nhiều càng to.",
  cloud: "Chữ thuần, từ nhiều nhất nằm giữa — giống đám mây từ kinh điển.",
  bubbles: "Mỗi cụm từ là một bong bóng, càng nhiều lượt gửi bong bóng càng lớn.",
  bars: "Top cụm từ xếp theo thanh ngang kèm số lượt, dễ so sánh.",
};

export function normalizeWordCloudView(v: unknown): WordCloudView {
  return typeof v === "string" && (WORD_CLOUD_VIEWS as readonly string[]).includes(v)
    ? (v as WordCloudView)
    : DEFAULT_WORD_CLOUD_VIEW;
}

export interface RankedWord {
  word: string;
  count: number;
  /** 0..1 so với từ nhiều nhất. */
  ratio: number;
}

/** Lấy tối đa `limit` cụm từ nhiều nhất (cùng số lượt thì theo chữ cái cho ổn định, khỏi nhảy vị trí). */
export function rankWords(freq: Record<string, number>, limit: number): RankedWord[] {
  const entries = Object.entries(freq)
    .filter(([, c]) => c > 0)
    .sort(([wa, a], [wb, b]) => b - a || wa.localeCompare(wb, "vi"))
    .slice(0, limit);
  const max = entries[0]?.[1] ?? 1;
  return entries.map(([word, count]) => ({ word, count, ratio: count / max }));
}

/**
 * Xếp từ nhiều nhất vào giữa, giảm dần ra hai bên (1,3,5…,6,4,2 theo thứ hạng đảo)
 * để dòng chữ wrap trông như một đám mây chứ không phải danh sách giảm dần.
 */
export function centerOut<T>(ranked: T[]): T[] {
  const left: T[] = [];
  const right: T[] = [];
  ranked.forEach((w, i) => (i % 2 === 0 ? right : left).push(w));
  return [...left.reverse(), ...right];
}

/** Nội suy tuyến tính; tỉ lệ được kẹp trong 0..1. Dùng căn bậc hai để chênh lệch không quá gắt. */
export function scaleBetween(ratio: number, min: number, max: number): number {
  const r = Math.min(1, Math.max(0, ratio));
  return min + Math.sqrt(r) * (max - min);
}

/** Dữ liệu mẫu cho phần xem trước trong trình soạn slide (không phải dữ liệu thật của học viên). */
export const WORD_CLOUD_SAMPLE: Record<string, number> = {
  "sáng tạo": 9,
  "hợp tác": 7,
  "tư duy phản biện": 6,
  "giao tiếp": 5,
  "kiên trì": 4,
  "học hỏi": 3,
  "lắng nghe": 3,
  "tự tin": 2,
  "linh hoạt": 2,
  "trách nhiệm": 1,
};
