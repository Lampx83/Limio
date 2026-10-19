// Con số kiểu thống kê và số nguồn [n] trong bài giảng AI soạn từ mô tả chủ đề.
// Module thuần. Không có tài liệu gốc thì con số cụ thể là thứ AI dễ bịa nhất, nên mọi con số kiểu thống kê
// phải có trong văn bản giảng viên đã thấy (mô tả, dàn ý đã chốt, các trang đã đọc); không thì bị loại.

/**
 * Phần trăm, số kèm đơn vị lớn (triệu, tỷ...), số có phân cách hàng nghìn, năm 1500–2099, số từ 5 chữ số.
 * Không bắt số nhỏ ("ba bước", "lớp 9", "x + 6 = 0", "Web 2.0") vì đó là nội dung bài học, không phải số liệu.
 */
const FIGURE_RE =
  /\d+(?:[.,]\d+)?\s?(?:%|(?:phần trăm|triệu|tỷ|tỉ|nghìn|ngàn|percent|million|billion)(?![\p{L}]))|(?<![\d.,])\d{1,3}(?:[.,]\d{3})+(?![\d.,]*\d)|(?<![\d.,])(?:1[5-9]|20)\d{2}(?![\d.,]*\d)|(?<![\d.,])\d{5,}(?![\d.,]*\d)/gu;

export function statFigures(text: string): string[] {
  return [...text.matchAll(FIGURE_RE)].map((m) => m[0].trim());
}

/** Khoá so khớp: chỉ giữ chữ số, để "45%", "45 %" và "45 phần trăm" là một; "1.250" và "1,250" là một. */
const keyOf = (s: string) => s.replace(/\D/g, "");

/** Mọi khoá số có trong văn bản (gồm cả số nhỏ): một con số được coi là "có nguồn" nếu khoá của nó nằm ở đây. */
export function figureKeys(text: string): Set<string> {
  return new Set([...text.matchAll(/\d(?:[\d.,]*\d)?/g)].map((m) => keyOf(m[0])));
}

/** Các con số kiểu thống kê trong `text` không có trong `corpus` (không lặp, giữ cách viết gốc). */
export function unsupportedFigures(text: string, corpus: string | Set<string>): string[] {
  const keys = typeof corpus === "string" ? figureKeys(corpus) : corpus;
  return [...new Set(statFigures(text).filter((f) => !keys.has(keyOf(f))))];
}

const CITE_RE = /\s*\[(\d{1,2}(?:\s*[,;]\s*\d{1,2})*)\]/g;

/** Gỡ số nguồn "[1]", "[1, 3]" khỏi câu; trả câu đã gỡ và các số gặp được. */
export function extractCites(text: string): { text: string; nums: number[] } {
  const nums: number[] = [];
  const out = text
    .replace(CITE_RE, (_, g: string) => {
      for (const n of g.split(/[,;]/)) nums.push(Number(n.trim()));
      return "";
    })
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
  return { text: out, nums: [...new Set(nums)] };
}

/** Dòng chân slide: "Nguồn: [1], [3]" (nhãn theo ngôn ngữ của bài); chỉ giữ số có trong danh sách nguồn (1..refCount). */
export function formatCite(nums: number[], refCount: number, label = "Nguồn"): string {
  const ok = [...new Set(nums)].filter((n) => Number.isInteger(n) && n >= 1 && n <= refCount).sort((a, b) => a - b);
  return ok.length ? `${label}: ${ok.map((n) => `[${n}]`).join(", ")}` : "";
}

/** Gỡ số nguồn ở mọi chuỗi lồng nhau, gom số lại. */
export function stripCitesDeep<T>(v: T, nums: number[]): T {
  if (typeof v === "string") {
    const r = extractCites(v);
    nums.push(...r.nums);
    return r.text as unknown as T;
  }
  if (Array.isArray(v)) return v.map((x) => stripCitesDeep(x, nums)) as unknown as T;
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, stripCitesDeep(x, nums)])) as unknown as T;
  }
  return v;
}

/** Mọi chuỗi trong một giá trị lồng nhau, nối lại (để quét con số). */
export function allText(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(allText).join("\n");
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).map(allText).join("\n");
  return "";
}
