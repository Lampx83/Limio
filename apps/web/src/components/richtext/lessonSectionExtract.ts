import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Tách một mục (node lessonSection) trong trình soạn thành dạng có cấu trúc để
 * gửi "Nhờ AI" sửa (S2): tiêu đề, đoạn mở đầu, các phần, các hộp. Chữ đậm/nghiêng
 * giữ bằng **…** / *…*. Ảnh có chú thích được giữ riêng để đặt lại nguyên vẹn —
 * AI không nhìn thấy ảnh. Mục có thứ AI không xử lý được (bảng, trích dẫn, khối mã,
 * ảnh rời) thì không cho nhờ AI, để không có gì bị mất âm thầm.
 */

export interface ExtractedSection {
  title: string;
  layout: string;
  intro: string[];
  parts: Array<{ title: string; paragraphs: string[]; bullets: string[] }>;
  boxes: Array<{ kind: string; title: string; paragraphs: string[] }>;
  figures: Array<{ src: string; alt: string; caption: string }>;
}

const UNSUPPORTED = new Set(["table", "blockquote", "codeBlock", "image", "horizontalRule"]);

/** Chữ của một khối trong dòng, đậm/nghiêng ghi bằng ** và *. */
function inlineText(node: PMNode): string {
  let out = "";
  node.forEach((child) => {
    if (child.isText) {
      let t = child.text ?? "";
      const marks = child.marks.map((m) => m.type.name);
      if (marks.includes("italic")) t = `*${t}*`;
      if (marks.includes("bold")) t = `**${t}**`;
      out += t;
    } else if (child.type.name === "hardBreak") {
      out += " ";
    } else {
      out += inlineText(child);
    }
  });
  return out.replace(/\s+/g, " ").trim();
}

function listItems(list: PMNode): string[] {
  const items: string[] = [];
  list.forEach((li) => {
    const t: string[] = [];
    li.forEach((b) => {
      if (b.type.name === "paragraph" || b.type.name === "heading") t.push(inlineText(b));
      else if (b.type.name === "bulletList" || b.type.name === "orderedList") items.push(...listItems(b));
    });
    const s = t.filter(Boolean).join(" ");
    if (s) items.push(s);
  });
  return items;
}

/** Có node nào (ở mọi tầng) mà AI không xử lý được không. */
export function sectionUnsupported(section: PMNode): string | null {
  let found: string | null = null;
  section.descendants((n) => {
    if (found) return false;
    if (UNSUPPORTED.has(n.type.name)) found = n.type.name;
    return true;
  });
  return found;
}

export function extractSection(section: PMNode): ExtractedSection {
  const out: ExtractedSection = {
    title: "",
    layout: String(section.attrs.layout ?? "text"),
    intro: [],
    parts: [],
    boxes: [],
    figures: [],
  };
  const boxOf = (b: PMNode) => {
    const paragraphs: string[] = [];
    b.forEach((c) => {
      if (c.type.name === "bulletList" || c.type.name === "orderedList") paragraphs.push(...listItems(c));
      else {
        const t = inlineText(c);
        if (t) paragraphs.push(t);
      }
    });
    return { kind: String(b.attrs.kind ?? "note"), title: (b.attrs.title as string | null) ?? "", paragraphs };
  };
  section.forEach((child, _offset, index) => {
    const name = child.type.name;
    if (index === 0 && name === "heading") {
      out.title = inlineText(child);
    } else if (name === "paragraph" || name === "heading") {
      const t = inlineText(child);
      if (t) out.intro.push(t);
    } else if (name === "bulletList" || name === "orderedList") {
      out.parts.push({ title: "", paragraphs: [], bullets: listItems(child) });
    } else if (name === "lessonFigure") {
      out.figures.push({ src: String(child.attrs.src ?? ""), alt: String(child.attrs.alt ?? ""), caption: inlineText(child) });
    } else if (name === "lessonBox") {
      out.boxes.push(boxOf(child));
    } else if (name === "lessonPart") {
      const part = { title: "", paragraphs: [] as string[], bullets: [] as string[] };
      child.forEach((c, _o, i) => {
        if (i === 0 && c.type.name === "heading") part.title = inlineText(c);
        else if (c.type.name === "bulletList" || c.type.name === "orderedList") part.bullets.push(...listItems(c));
        else if (c.type.name === "lessonBox") out.boxes.push(boxOf(c));
        else if (c.type.name === "lessonFigure") out.figures.push({ src: String(c.attrs.src ?? ""), alt: String(c.attrs.alt ?? ""), caption: inlineText(c) });
        else {
          const t = inlineText(c);
          if (t) part.paragraphs.push(t);
        }
      });
      out.parts.push(part);
    }
  });
  return out;
}
