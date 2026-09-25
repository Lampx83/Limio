/**
 * Định dạng lại mã HTML cho dễ đọc: mỗi phần tử khối một dòng, thụt lề theo
 * cấp lồng nhau, phần tử chỉ chứa chữ/inline (vd. <li>, <p>) gọn trên một dòng.
 *
 * Không thêm/bớt nội dung hiển thị: chỉ gộp khoảng trắng thừa giữa các thẻ
 * (vô hại trong HTML) và giữ nguyên tuyệt đối ruột của <pre>/<script>/<style>/<textarea>.
 * Nếu parse thấy gì bất thường thì trả lại chuỗi gốc thay vì đoán mò.
 */

const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "source", "track", "wbr",
]);
const RAW = new Set(["pre", "script", "style", "textarea"]);
const INLINE = new Set([
  "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn", "em",
  "i", "img", "kbd", "label", "mark", "q", "s", "samp", "small", "span",
  "strong", "sub", "sup", "time", "u", "var", "wbr", "del", "ins", "input",
  "button", "select",
]);

type Node =
  | { kind: "text"; text: string }
  | { kind: "raw"; text: string } // comment / doctype
  | { kind: "el"; tag: string; open: string; close: string | null; children: Node[]; rawBody?: string };

const TOKEN_RE = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;

function parse(src: string): Node[] | null {
  const root: Node[] = [];
  const stack: { tag: string; children: Node[] }[] = [{ tag: "#root", children: root }];
  const top = () => stack[stack.length - 1]!;
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(src))) {
    if (m.index > last) top().children.push({ kind: "text", text: src.slice(last, m.index) });
    last = m.index + m[0].length;
    const [full, closeTag, openTag] = m;
    if (closeTag) {
      const tag = closeTag.toLowerCase();
      const idx = stack.map((s) => s.tag).lastIndexOf(tag);
      if (idx < 1) return null; // đóng thẻ chưa mở → HTML lạ, bỏ cuộc
      stack.length = idx + 1;
      stack.pop();
      // thẻ đã được đóng: gắn close vào node cha đã tạo (xử lý ở nơi push)
    } else if (openTag) {
      const tag = openTag.toLowerCase();
      const selfClosing = full.endsWith("/>") || VOID.has(tag);
      const el: Node = { kind: "el", tag, open: full, close: null, children: [] };
      top().children.push(el);
      if (selfClosing) continue;
      if (RAW.has(tag)) {
        const closeRe = new RegExp(`</${tag}\\s*>`, "i");
        const rest = src.slice(last);
        const cm = closeRe.exec(rest);
        if (!cm) return null;
        el.rawBody = rest.slice(0, cm.index);
        el.close = cm[0];
        last += cm.index + cm[0].length;
        TOKEN_RE.lastIndex = last;
        continue;
      }
      el.close = `</${tag}>`;
      stack.push({ tag, children: el.children });
    } else {
      top().children.push({ kind: "raw", text: full });
    }
  }
  if (last < src.length) top().children.push({ kind: "text", text: src.slice(last) });
  if (stack.length !== 1) return null; // còn thẻ chưa đóng
  return root;
}

const isInlineNode = (n: Node) =>
  n.kind === "text" || n.kind === "raw" || (n.kind === "el" && INLINE.has(n.tag));

/** Phần tử chỉ gồm chữ + inline (đệ quy) → in trên một dòng. */
function isInlineOnly(n: Node): boolean {
  if (n.kind !== "el") return true;
  if (n.rawBody !== undefined) return INLINE.has(n.tag);
  return n.children.every((c) => (c.kind === "el" ? INLINE.has(c.tag) && isInlineOnly(c) : true));
}

const squash = (s: string) => s.replace(/\s+/g, " ");

function inlineString(nodes: Node[]): string {
  return nodes
    .map((n) => {
      if (n.kind === "text") return squash(n.text);
      if (n.kind === "raw") return n.text;
      if (n.rawBody !== undefined) return n.open + n.rawBody + (n.close ?? "");
      return n.open + inlineString(n.children) + (n.close ?? "");
    })
    .join("");
}

function render(nodes: Node[], depth: number, out: string[]) {
  const pad = "  ".repeat(depth);
  let run: Node[] = [];
  const flush = () => {
    if (!run.length) return;
    const s = inlineString(run).trim();
    if (s) out.push(pad + s);
    run = [];
  };
  for (const n of nodes) {
    if (isInlineNode(n) && (n.kind !== "el" || isInlineOnly(n))) {
      run.push(n);
      continue;
    }
    flush();
    if (n.kind !== "el") continue;
    if (n.rawBody !== undefined) {
      out.push(pad + n.open + n.rawBody + (n.close ?? ""));
    } else if (n.children.length === 0) {
      out.push(pad + n.open + (n.close ?? ""));
    } else if (isInlineOnly(n)) {
      out.push(pad + n.open + inlineString(n.children).trim() + (n.close ?? ""));
    } else {
      out.push(pad + n.open);
      render(n.children, depth + 1, out);
      out.push(pad + (n.close ?? ""));
    }
  }
  flush();
}

export function formatHtml(src: string): string {
  if (!src.trim()) return src;
  try {
    const tree = parse(src);
    if (!tree) return src;
    const out: string[] = [];
    render(tree, 0, out);
    return out.join("\n") + "\n";
  } catch {
    return src;
  }
}
