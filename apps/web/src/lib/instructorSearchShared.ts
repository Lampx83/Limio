/**
 * Phần dùng chung giữa máy chủ và trình duyệt của ô tìm kiếm ở trang chủ giảng viên: kiểu kết quả, cách so khớp
 * không phân biệt dấu (gõ "thiet ke" vẫn ra "Thiết kế") và cách tô đậm phần khớp. Không import gì phía máy chủ.
 */

export type SearchKind = "course" | "lesson" | "exam" | "slide";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  /** Dòng phụ bên phải: ngữ cảnh ngắn (khoá chứa bài, trạng thái đề...). */
  meta: string;
  href: string;
}

/** Thứ tự nhóm trong danh sách gợi ý, kèm tên nhóm hiện cho giảng viên. */
export const SEARCH_GROUPS: ReadonlyArray<{ kind: SearchKind; label: string }> = [
  { kind: "course", label: "Khoá học" },
  { kind: "lesson", label: "Bài học" },
  { kind: "exam", label: "Đề thi" },
  { kind: "slide", label: "Slide" },
];

export const SEARCH_QUERY_MAX = 80;

/**
 * Bỏ dấu và đưa về chữ thường, GIỮ NGUYÊN độ dài (mỗi đơn vị UTF-16 → đúng một đơn vị) để vị trí khớp trong chuỗi đã
 * "gấp" dùng được thẳng trên chuỗi gốc khi tô đậm. Chuỗi được chuẩn hoá NFC trước, nên "ế" là một đơn vị chứ không
 * phải "e" + dấu rời.
 */
export function foldVi(input: string): string {
  const s = input.normalize("NFC");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === "đ" || ch === "Đ") {
      out += "d";
      continue;
    }
    const base = ch.normalize("NFD")[0] ?? ch;
    out += base.toLowerCase().length === 1 ? base.toLowerCase() : ch;
  }
  return out;
}

/** Cắt khoảng trắng thừa và giới hạn độ dài; chuỗi rỗng nghĩa là không có gì để tìm. */
export function cleanQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, SEARCH_QUERY_MAX);
}

/**
 * Điểm khớp của một tiêu đề với từ khoá (đã gấp): 0 = không khớp; càng cao càng đáng đứng trước.
 * Mở đầu tiêu đề > mở đầu một từ > nằm giữa từ.
 */
export function matchScore(title: string, foldedQuery: string): number {
  if (!foldedQuery) return 0;
  const t = foldVi(title);
  const at = t.indexOf(foldedQuery);
  if (at < 0) return 0;
  if (at === 0) return 3;
  return /\s/.test(t[at - 1] ?? "") ? 2 : 1;
}

export interface HighlightPart {
  text: string;
  hit: boolean;
}

/** Tách tiêu đề thành các đoạn để tô đậm lần khớp đầu tiên; không khớp thì trả nguyên một đoạn. */
export function splitHighlight(title: string, query: string): HighlightPart[] {
  const q = foldVi(cleanQuery(query));
  const normalized = title.normalize("NFC");
  if (!q) return [{ text: normalized, hit: false }];
  const at = foldVi(normalized).indexOf(q);
  if (at < 0) return [{ text: normalized, hit: false }];
  const parts: HighlightPart[] = [];
  if (at > 0) parts.push({ text: normalized.slice(0, at), hit: false });
  parts.push({ text: normalized.slice(at, at + q.length), hit: true });
  if (at + q.length < normalized.length) parts.push({ text: normalized.slice(at + q.length), hit: false });
  return parts;
}
