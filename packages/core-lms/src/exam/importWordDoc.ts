/**
 * HTML đoạn văn (đã làm sạch bởi importWord) → Tiptap JSON của `ExamPassage.contentJson`.
 *
 * Làm trong core-lms vì cần chạy ở máy chủ, không có DOM (`htmlToPassageDoc` của apps/web dựng Tiptap Editor nên cần trình duyệt).
 * Chỉ nhận tập thẻ mà importWord sinh ra: p, h2, h3, ul, ol, li, strong, em, u, s, sup, sub, br, img; mọi thứ khác bị bỏ.
 * Nút tạo ra nằm trong tập mà `PassageView` vẽ được (xem SUPPORTED_NODES ở apps/web/src/lib/passageDoc.ts). sup/sub không có dấu tương
 * ứng trong trình soạn Đoạn văn nên chỉ giữ chữ.
 */

type Mark = { type: "bold" | "italic" | "underline" | "strike" };
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: Mark[] };

const MARK_OF: Record<string, Mark["type"]> = { strong: "bold", em: "italic", u: "underline", s: "strike" };

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Nội dung nội dòng → các nút (văn bản, hardBreak) và ảnh tách riêng (ảnh là nút khối nên đứng ngoài đoạn). */
function inlineSegments(html: string, srcOf: (index: number) => string | null): Array<{ kind: "inline"; nodes: Node[] } | { kind: "image"; node: Node }> {
  const out: Array<{ kind: "inline"; nodes: Node[] } | { kind: "image"; node: Node }> = [];
  let cur: Node[] = [];
  const flush = () => {
    if (cur.length > 0) out.push({ kind: "inline", nodes: cur });
    cur = [];
  };
  const active: Array<Mark["type"]> = [];
  const re = /<(\/?)([a-z][a-z0-9]*)\b([^>]*)>|([^<]+)/gi;
  for (const m of html.matchAll(re)) {
    if (m[4] !== undefined) {
      const text = decode(m[4]);
      if (text === "") continue;
      const node: Node = { type: "text", text };
      if (active.length > 0) node.marks = [...new Set(active)].map((t) => ({ type: t }));
      cur.push(node);
      continue;
    }
    const closing = m[1] === "/";
    const tag = m[2]!.toLowerCase();
    if (tag in MARK_OF) {
      if (closing) {
        const i = active.lastIndexOf(MARK_OF[tag]!);
        if (i >= 0) active.splice(i, 1);
      } else active.push(MARK_OF[tag]!);
    } else if (tag === "br" && !closing) {
      cur.push({ type: "hardBreak" });
    } else if (tag === "img" && !closing) {
      const idx = /\bsrc="embedded:(\d+)"/i.exec(m[3] ?? "")?.[1];
      const src = idx === undefined ? null : srcOf(Number(idx));
      if (src) {
        flush();
        const alt = decode(/\balt="([^"]*)"/i.exec(m[3] ?? "")?.[1] ?? "");
        out.push({ kind: "image", node: { type: "image", attrs: { src, alt } } });
      }
    }
  }
  flush();
  return out;
}

function paragraphs(html: string, srcOf: (index: number) => string | null): Node[] {
  const nodes: Node[] = [];
  for (const seg of inlineSegments(html, srcOf)) {
    if (seg.kind === "image") nodes.push(seg.node);
    else nodes.push({ type: "paragraph", content: seg.nodes });
  }
  return nodes;
}

/** Tách các khối cấp cao nhất (p, h2, h3, ul, ol) theo thứ tự; importWord không sinh khối lồng nhau ngoài ul/ol > li. */
export function wordHtmlToPassageDoc(
  html: string,
  srcOf: (index: number) => string | null,
): { type: "doc"; content: unknown[] } {
  const content: Node[] = [];
  const re = /<(p|h2|h3|ul|ol)>([\s\S]*?)<\/\1>/gi;
  for (const m of html.matchAll(re)) {
    const tag = m[1]!.toLowerCase();
    const inner = m[2]!;
    if (tag === "p") {
      content.push(...paragraphs(inner, srcOf));
    } else if (tag === "h2" || tag === "h3") {
      const segs = inlineSegments(inner, srcOf);
      const nodes = segs.flatMap((s) => (s.kind === "inline" ? s.nodes : []));
      if (nodes.length > 0) content.push({ type: "heading", attrs: { level: Number(tag[1]) }, content: nodes });
      for (const s of segs) if (s.kind === "image") content.push(s.node);
    } else {
      const items: Node[] = [];
      for (const li of inner.matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
        const ps = paragraphs(li[1]!, srcOf).filter((n) => n.type === "paragraph");
        if (ps.length > 0) items.push({ type: "listItem", content: ps });
      }
      if (items.length > 0) content.push({ type: tag === "ul" ? "bulletList" : "orderedList", content: items });
    }
  }
  return { type: "doc", content };
}

/** Thay `embedded:N` trong HTML đề bài bằng đường dẫn thật; ảnh không có đường dẫn thì bỏ thẻ. */
export function replaceEmbeddedImages(html: string, srcOf: (index: number) => string | null): string {
  return html.replace(/<img src="embedded:(\d+)" alt="([^"]*)">/g, (_m, i: string, alt: string) => {
    const src = srcOf(Number(i));
    return src ? `<img src="${src}" alt="${alt}">` : "";
  });
}
