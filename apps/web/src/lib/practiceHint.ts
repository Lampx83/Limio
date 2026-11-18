/**
 * Gợi ý cách trả lời nằm CUỐI đề điền chỗ trống, trong ngoặc: "…让我再____一下。(gõ một từ tiếng Trung, nghĩa: suy nghĩ, cân nhắc)".
 * Tách ra để phiếu bài tập hiện thành một dòng gợi ý riêng, nhỏ, dưới câu (thay vì chen vào cuối câu bằng cỡ chữ to làm câu khó đọc).
 */
export interface TrailingHint {
  /** Đề đã bỏ phần gợi ý. */
  main: string;
  /** Cách làm, vd "Gõ một từ tiếng Trung". */
  how: string;
  /** Nghĩa của từ cần điền (sau "nghĩa:"), rỗng nếu không có. */
  meaning: string;
}

const HINT = /\s*[（(]\s*((?:gõ|nhập|điền|type|write)(?=[\s:,;]|$)[^()（）]*)[)）]\s*$/iu;

const upperFirst = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

/** Tách gợi ý cuối đề; không có gợi ý (hoặc ngoặc không bắt đầu bằng gõ/nhập/điền/type/write) thì trả null. */
export function splitTrailingHint(prompt: string): TrailingHint | null {
  const m = HINT.exec(prompt);
  if (!m) return null;
  const body = m[1]!.trim();
  const k = /[,;]\s*(?:nghĩa|nghia|meaning)\s*:\s*/iu.exec(body);
  const how = (k ? body.slice(0, k.index) : body).trim();
  const meaning = k ? body.slice(k.index + k[0].length).trim() : "";
  return { main: prompt.slice(0, m.index).trimEnd(), how: upperFirst(how), meaning };
}
