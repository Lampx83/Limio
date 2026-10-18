// Bộ đọc XML tối giản cho tệp Office Open XML (pptx): không DTD, không namespace-aware. Chạy được cả trên
// trình duyệt lẫn Node (không dựa vào DOMParser) để cùng một bộ đọc .pptx dùng ở hai phía.
// So khớp theo tên cục bộ (sau dấu hai chấm) vì tiền tố namespace không bắt buộc phải là "p:", "a:".

export interface XmlEl {
  name: string;
  attrs: Record<string, string>;
  children: Array<XmlEl | string>;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENT[e] ?? m;
  });
}

const ATTR_RE = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

/** Đọc một tài liệu XML thành cây phần tử. Ném lỗi khi thẻ đóng không khớp (tệp hỏng). */
export function parseXml(xml: string): XmlEl {
  const root: XmlEl = { name: "#root", attrs: {}, children: [] };
  const stack: XmlEl[] = [root];
  let i = 0;
  const n = xml.length;
  while (i < n) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) {
      pushText(stack[stack.length - 1]!, xml.slice(i));
      break;
    }
    if (lt > i) pushText(stack[stack.length - 1]!, xml.slice(i, lt));
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      const raw = xml.slice(lt + 9, end < 0 ? n : end);
      stack[stack.length - 1]!.children.push(raw);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (xml[lt + 1] === "?" || xml[lt + 1] === "!") {
      const end = xml.indexOf(">", lt);
      i = end < 0 ? n : end + 1;
      continue;
    }
    const gt = findTagEnd(xml, lt);
    if (gt < 0) throw new Error("xml_unterminated_tag");
    const body = xml.slice(lt + 1, gt);
    i = gt + 1;
    if (body[0] === "/") {
      const name = body.slice(1).trim();
      const top = stack.pop();
      if (!top || top.name !== name || stack.length === 0) throw new Error("xml_mismatched_tag");
      continue;
    }
    const selfClose = body.endsWith("/");
    const inner = selfClose ? body.slice(0, -1) : body;
    const sp = inner.search(/\s/);
    const name = sp < 0 ? inner : inner.slice(0, sp);
    const attrs: Record<string, string> = {};
    if (sp >= 0) {
      ATTR_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      const rest = inner.slice(sp);
      while ((m = ATTR_RE.exec(rest))) attrs[m[1]!] = decodeEntities(m[3] ?? m[4] ?? "");
    }
    const el: XmlEl = { name, attrs, children: [] };
    stack[stack.length - 1]!.children.push(el);
    if (!selfClose) stack.push(el);
  }
  if (stack.length !== 1) throw new Error("xml_unclosed_tag");
  const top = root.children.find((c): c is XmlEl => typeof c !== "string");
  if (!top) throw new Error("xml_empty");
  return top;
}

/** Vị trí ">" kết thúc thẻ, bỏ qua ">" nằm trong giá trị thuộc tính. */
function findTagEnd(xml: string, from: number): number {
  let q: string | null = null;
  for (let k = from + 1; k < xml.length; k++) {
    const ch = xml[k];
    if (q) {
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") q = ch;
    else if (ch === ">") return k;
  }
  return -1;
}

function pushText(el: XmlEl, raw: string) {
  if (!raw) return;
  el.children.push(decodeEntities(raw));
}

/** Tên cục bộ: "a:t" → "t". */
export const localName = (name: string) => {
  const c = name.indexOf(":");
  return c < 0 ? name : name.slice(c + 1);
};

export function elements(el: XmlEl | null | undefined): XmlEl[] {
  return el ? el.children.filter((c): c is XmlEl => typeof c !== "string") : [];
}

/** Con trực tiếp có tên cục bộ `name`. */
export function child(el: XmlEl | null | undefined, name: string): XmlEl | null {
  for (const c of elements(el)) if (localName(c.name) === name) return c;
  return null;
}

export function childrenNamed(el: XmlEl | null | undefined, name: string): XmlEl[] {
  return elements(el).filter((c) => localName(c.name) === name);
}

/** Đi theo đường con trực tiếp: path(el, "nvSpPr", "nvPr", "ph"). */
export function path(el: XmlEl | null | undefined, ...names: string[]): XmlEl | null {
  let cur: XmlEl | null | undefined = el;
  for (const n of names) {
    cur = child(cur, n);
    if (!cur) return null;
  }
  return cur ?? null;
}

/** Mọi hậu duệ có tên cục bộ `name`, theo thứ tự tài liệu. */
export function descendants(el: XmlEl | null | undefined, name: string): XmlEl[] {
  const out: XmlEl[] = [];
  const walk = (e: XmlEl) => {
    for (const c of elements(e)) {
      if (localName(c.name) === name) out.push(c);
      walk(c);
    }
  };
  if (el) walk(el);
  return out;
}

export function firstDescendant(el: XmlEl | null | undefined, name: string): XmlEl | null {
  if (!el) return null;
  for (const c of elements(el)) {
    if (localName(c.name) === name) return c;
    const d = firstDescendant(c, name);
    if (d) return d;
  }
  return null;
}

/** Thuộc tính theo tên cục bộ ("r:embed" khớp "embed"). */
export function attr(el: XmlEl | null | undefined, name: string): string | undefined {
  if (!el) return undefined;
  if (name in el.attrs) return el.attrs[name];
  for (const [k, v] of Object.entries(el.attrs)) if (localName(k) === name) return v;
  return undefined;
}

/** Thuộc tính có tiền tố namespace ("r:id"), không lẫn với thuộc tính "id" không tiền tố cùng phần tử. */
export function prefixedAttr(el: XmlEl | null | undefined, name: string): string | undefined {
  if (!el) return undefined;
  for (const [k, v] of Object.entries(el.attrs)) if (k.includes(":") && localName(k) === name) return v;
  return undefined;
}

/** Ghép mọi đoạn chữ trực tiếp và lồng nhau. */
export function textOf(el: XmlEl | null | undefined): string {
  if (!el) return "";
  return el.children.map((c) => (typeof c === "string" ? c : textOf(c))).join("");
}
