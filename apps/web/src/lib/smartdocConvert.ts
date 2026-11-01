import { JSDOM } from "jsdom";

/**
 * Chuyển một bài của SmartDoc (slide HTML tương tác + lời giảng theo bước) sang định dạng nhập khoá của Limio
 * (`packages/core-lms/scripts/import-course.ts`): mỗi slide thành một mục `##` của bài, lời giảng của slide thành một đoạn
 * "Nghe giảng" có `anchor` là tiêu đề mục. Chỉ đi qua đường nhập sẵn có, không thêm loại nội dung mới.
 *
 * Mất khi chuyển (nói rõ ở báo cáo của script): tương tác trên slide (nút, ô nhập, tab, mô phỏng), hình vẽ SVG, và
 * phần gia sư 1-1 (`giaSu`). Câu trắc nghiệm trên slide được giữ dạng tĩnh kèm đáp án.
 */

export interface SmartdocSlide {
  id: string;
  html: string;
  ghiChu?: string;
  loiGiang?: { buoc?: string[] };
}

export interface Persona {
  /** "thầy" | "cô": xưng hô của giảng viên với học sinh. */
  xung: string;
  /** Tên giảng viên, thay cho {{gv}}. */
  ten: string;
}

export interface ConvertedSlide {
  title: string;
  markdown: string;
  figures: number;
  isCover: boolean;
  isSummary: boolean;
  narration: string;
}

const INLINE = new Set(["span", "b", "strong", "i", "em", "br", "a", "code", "sub", "sup", "u", "small", "mark"]);
const QUOTE_CLASSES = ["dinh-nghia", "dinh-li", "luu-y", "meo", "canh-bao", "go-y", "giai-thich", "ghi-nho"];
const SKIP_TAGS = new Set(["button", "script", "style", "input", "textarea", "select"]);

/** `\(x\)` → `$x$`, `\[x\]` → `$$x$$` (importer nhận luật pandoc). */
export function mathToDollars(text: string): string {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, g: string) => `$$${g.trim()}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, g: string) => `$${g.trim()}$`);
}

/** Chữ thuần của tiêu đề: bỏ ký hiệu markdown và dấu bao công thức, vì `anchor` so với tiêu đề đã bỏ định dạng. */
export function plainTitle(raw: string): string {
  return raw
    .replace(/\\[()[\]]/g, "")
    .replace(/[*_`#$]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type El = Element;
const cls = (el: El, c: string) => el.classList.contains(c);

function inline(node: Node): string {
  if (node.nodeType === 3) return (node.textContent ?? "").replace(/\s+/g, " ");
  if (node.nodeType !== 1) return "";
  const el = node as El;
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag) || tag === "svg") return "";
  const inner = Array.from(el.childNodes).map(inline).join("");
  if (tag === "br") return "  \n";
  if (tag === "b" || tag === "strong") return inner.trim() ? `**${inner.trim()}** ` : "";
  if (tag === "i" || tag === "em") return inner.trim() ? `*${inner.trim()}* ` : "";
  return inner;
}

function listMd(el: El, ordered: boolean): string {
  return Array.from(el.children)
    .filter((c) => c.tagName.toLowerCase() === "li")
    .map((li, i) => `${ordered ? `${i + 1}.` : "-"} ${tidy(inline(li))}`)
    .join("\n");
}

function tableMd(el: El): string {
  const rows = Array.from(el.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.children).map((c) => tidy(inline(c)).replace(/\|/g, "\\|") || " "),
  );
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill(" ")];
  const [head, ...rest] = rows.map(pad);
  return [`| ${head!.join(" | ")} |`, `| ${head!.map(() => "---").join(" | ")} |`, ...rest.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

/** Câu trắc nghiệm trên slide → câu hỏi + phương án + đáp án tĩnh (không còn bấm chọn). */
function quizMd(el: El): string {
  const question = tidy(inline(el.querySelector(".cau") ?? el));
  const buttons = Array.from(el.querySelectorAll("button.lc"));
  const options = buttons.map((b) => `- ${tidy(inline(b)) || tidy(b.textContent ?? "")}`);
  const right = buttons.filter((b) => cls(b, "dung")).map((b) => tidy(b.textContent ?? ""));
  const why = el.querySelector(".giai-thich");
  const lines = [`**${question}**`, ...options];
  if (right.length) lines.push("", `> **Đáp án:** ${right.join(", ")}${why ? ` — ${tidy(inline(why))}` : ""}`);
  return lines.join("\n");
}

const tidy = (s: string): string =>
  mathToDollars(s.replace(/[ \t]+/g, " ").replace(/ +\n/g, "\n").replace(/(\*\*|\*) +([:;,.!?)])/g, "$1$2").trim());

interface Acc {
  blocks: string[];
  figures: number;
}

function walk(parent: El, acc: Acc, skipFirstHeading: { done: boolean }): void {
  let buf = "";
  const flush = () => {
    const t = tidy(buf);
    if (t) acc.blocks.push(t);
    buf = "";
  };
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === 3) {
      buf += inline(node);
      continue;
    }
    if (node.nodeType !== 1) continue;
    const el = node as El;
    const tag = el.tagName.toLowerCase();
    if (tag === "svg") {
      flush();
      acc.figures++;
      continue;
    }
    if (SKIP_TAGS.has(tag)) continue;
    if (INLINE.has(tag)) {
      buf += inline(el);
      continue;
    }
    flush();
    if (/^h[1-3]$/.test(tag)) {
      // Tiêu đề đầu tiên là tên mục (do người gọi lấy); các tiêu đề sau là tiêu đề con.
      if (!skipFirstHeading.done) skipFirstHeading.done = true;
      else acc.blocks.push(`### ${plainTitle(inline(el))}`);
    } else if (tag === "p") acc.blocks.push(tidy(inline(el)));
    else if (tag === "ul" || tag === "ol") acc.blocks.push(listMd(el, tag === "ol"));
    else if (tag === "table") acc.blocks.push(tableMd(el));
    else if (cls(el, "trac-nghiem")) acc.blocks.push(quizMd(el));
    else if (QUOTE_CLASSES.some((c) => cls(el, c))) {
      const inner: Acc = { blocks: [], figures: 0 };
      walk(el, inner, { done: true });
      acc.figures += inner.figures;
      acc.blocks.push(inner.blocks.join("\n\n").split("\n").map((l) => `> ${l}`).join("\n"));
    } else walk(el, acc, skipFirstHeading);
  }
  flush();
}

/** Lời giảng của một slide thành chữ đọc được: bỏ thẻ nhịp, thay xưng hô, gộp các bước. */
export function cleanNarration(steps: readonly string[], persona: Persona): string {
  const text = steps
    .join(" ")
    .replace(/\[(?:dừng|nghĩ|chỉ)[^\]]*\]/gi, " ")
    .replace(/\{\{Tx\}\}/g, capitalize(persona.xung))
    .replace(/\{\{tx\}\}/g, persona.xung)
    .replace(/\{\{gv\}\}/g, persona.ten)
    .replace(/\{\{ten\}\}/g, "em")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return mathToDollars(text).replace(/\$([^$]*)\$/g, "$1");
}

const capitalize = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export function convertSlide(slide: SmartdocSlide, persona: Persona, fallbackTitle: string): ConvertedSlide {
  const doc = new JSDOM(`<body>${slide.html}</body>`).window.document;
  const root = doc.body;
  const section = root.querySelector("section") ?? root;
  const heading = section.querySelector("h1, h2, h3");
  const title = plainTitle(heading ? inline(heading) : slide.ghiChu || fallbackTitle) || fallbackTitle;
  const acc: Acc = { blocks: [], figures: 0 };
  walk(section, acc, { done: !heading });
  if (acc.figures > 0) acc.blocks.push("*(Hình vẽ của slide này có trong bản tương tác trên SmartDoc; bản demo chưa có hình.)*");
  return {
    title,
    markdown: acc.blocks.join("\n\n"),
    figures: acc.figures,
    isCover: cls(section, "bia"),
    isSummary: cls(section, "tong-ket"),
    narration: cleanNarration(slide.loiGiang?.buoc ?? [], persona),
  };
}
