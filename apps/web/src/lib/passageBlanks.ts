/**
 * Đoạn hội thoại có chỗ trống ("A：我______他是你男朋友。") của bài luyện kèm MỘT câu tự luận "Điền vào ba chỗ trống…": học viên gõ thẳng vào từng chỗ trống trong đoạn
 * thoại. Các lời đã gõ gộp thành một đáp án chữ (cùng dạng `{ text }` với ô soạn thảo) để chấm và lưu như cũ; thứ tự ghép là thứ tự chỗ trống trong đoạn.
 * Chỉ nhận đoạn gồm ảnh và các dòng chữ thường; có khối lạ (bảng, audio, danh sách…) thì không nhận và đoạn hiện như cũ.
 */
export const BLANK_SEP = " ｜ ";

const BLANK = /[_＿]{3,}/;

export type BlankPart = { text: string } | { blank: number };
export type BlankNode = { kind: "image"; src: string; alt: string } | { kind: "line"; parts: BlankPart[] };

interface DocNode {
  type?: unknown;
  attrs?: { src?: unknown; alt?: unknown };
  content?: Array<{ type?: unknown; text?: unknown }>;
}

export function parsePassageBlanks(doc: { content?: unknown[] } | null | undefined): { nodes: BlankNode[]; count: number } | null {
  const content = doc?.content;
  if (!Array.isArray(content) || content.length === 0) return null;
  const nodes: BlankNode[] = [];
  let count = 0;
  for (const raw of content as DocNode[]) {
    if (raw?.type === "image") {
      const src = typeof raw.attrs?.src === "string" ? raw.attrs.src : "";
      if (!src.startsWith("/")) return null; // chỉ ảnh của chính hệ thống
      nodes.push({ kind: "image", src, alt: typeof raw.attrs?.alt === "string" ? raw.attrs.alt : "" });
    } else if (raw?.type === "paragraph") {
      const text = (raw.content ?? []).map((c) => (c?.type === "text" && typeof c.text === "string" ? c.text : c?.type === "text" ? "" : "\u0000")).join("");
      if (text.includes("\u0000")) return null; // khối chen trong dòng (đậm, audio…): không nhận
      const parts: BlankPart[] = [];
      let rest = text;
      for (;;) {
        const m = BLANK.exec(rest);
        if (!m) break;
        if (m.index > 0) parts.push({ text: rest.slice(0, m.index) });
        parts.push({ blank: count++ });
        rest = rest.slice(m.index + m[0].length);
      }
      if (rest) parts.push({ text: rest });
      if (parts.length) nodes.push({ kind: "line", parts });
    } else return null;
  }
  return count > 0 ? { nodes, count } : null;
}

/** Gộp các lời đã gõ thành đáp án chữ; chưa gõ gì thì rỗng (câu chưa trả lời). */
export function joinBlankAnswers(values: string[]): string {
  return values.some((v) => v.trim()) ? values.map((v) => v.trim()).join(BLANK_SEP) : "";
}

/** Tách đáp án chữ về từng chỗ trống (tải lại trang không mất). Đáp án cũ không theo khuôn thì dồn hết vào chỗ trống đầu. */
export function splitBlankAnswers(text: string, count: number): string[] {
  const out = Array.from({ length: count }, () => "");
  if (!text) return out;
  const parts = text.split(BLANK_SEP.trim()).map((x) => x.trim());
  if (parts.length === 1) {
    out[0] = parts[0]!;
    return out;
  }
  parts.slice(0, count).forEach((p, i) => (out[i] = p));
  return out;
}
