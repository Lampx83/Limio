import { Editor, Node, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { PASSAGE_FONT_SIZE_VALUES } from "./passageFontSizes";
import { passageHighlightColor, passageTextColor } from "./passageColors";

/**
 * Trình soạn Đoạn văn của đề thi và Bài luyện (docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md, mục D).
 *
 * Đoạn lưu dạng Tiptap JSON (`contentJson`) và `PassageView` chỉ vẽ một tập nút: đoạn văn, tiêu đề, danh sách chấm/số, ảnh, audio,
 * video, ngắt dòng, và chữ đậm/nghiêng/gạch chân/tô nổi. Trình soạn chỉ cho tạo đúng tập đó — soạn ra thứ học viên không thấy thì vô ích.
 * Audio và video là hai nút khối riêng (không có trong Tiptap mặc định); trong ô soạn hiện thành thẻ có biểu tượng và mô tả.
 */

function mediaNode(name: "audio" | "video", icon: string, fallback: string) {
  return Node.create({
    name,
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
      return { src: { default: "" }, alt: { default: "" } };
    },
    parseHTML() {
      return [
        {
          tag: `div[data-passage-media="${name}"]`,
          getAttrs: (el) => ({
            src: (el as HTMLElement).getAttribute("data-src") ?? "",
            alt: (el as HTMLElement).getAttribute("data-alt") ?? "",
          }),
        },
      ];
    },
    renderHTML({ node }) {
      const alt = String(node.attrs.alt ?? "");
      return [
        "div",
        { "data-passage-media": name, "data-src": String(node.attrs.src ?? ""), "data-alt": alt, class: "passage-media-chip" },
        `${icon} ${alt || fallback}`,
      ];
    },
  });
}

export const PassageAudio = mediaNode("audio", "🔊", "Audio");
export const PassageVideo = mediaNode("video", "🎬", "Video");

export const PASSAGE_EXTENSIONS = [
  StarterKit.configure({
    // Tiêu đề cỡ 2 và 3 trên thanh công cụ; cỡ 1 vẫn đọc được từ đoạn cũ.
    heading: { levels: [1, 2, 3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    // StarterKit v3 kèm Link/Underline: tắt Link (bài đọc chưa có liên kết), dùng Underline khai báo riêng bên dưới.
    link: false,
    underline: false,
  }),
  Underline,
  Highlight.configure({ multicolor: true }),
  Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "max-w-full h-auto rounded-md" } }),
  TextStyle,
  FontSize,
  Color,
  // Bảng: ô chỉ chứa đoạn văn (không ảnh/danh sách/audio/video trong ô) cho gọn và đọc được trên điện thoại; không kéo đổi độ rộng cột.
  Table.configure({ resizable: false, HTMLAttributes: { class: "passage-table" } }),
  TableRow,
  TableHeader.extend({ content: "paragraph+" }),
  TableCell.extend({ content: "paragraph+" }),
  PassageAudio,
  PassageVideo,
];


/** Tập nút/dấu mà `PassageView` vẽ được. Cái gì ngoài tập này là "chưa hỗ trợ". */
const SUPPORTED_NODES = new Set([
  "doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "hardBreak", "image", "audio", "video",
  "table", "tableRow", "tableHeader", "tableCell",
]);
const SUPPORTED_MARKS = new Set(["bold", "italic", "underline", "strike", "highlight", "textStyle"]);

/** Tên các nút/dấu trong `doc` mà trình soạn không biểu diễn được (rỗng = soạn được, không mất gì). */
export function findUnsupported(doc: unknown): string[] {
  const found = new Set<string>();
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: unknown; marks?: unknown; content?: unknown };
    if (typeof node.type === "string" && !SUPPORTED_NODES.has(node.type)) found.add(node.type);
    // Ô bảng chỉ chứa đoạn văn: ảnh/danh sách/khối khác trong ô sẽ mất khi sửa nên báo trước.
    if ((node.type === "tableCell" || node.type === "tableHeader") && Array.isArray(node.content)) {
      if (node.content.some((c) => (c as { type?: unknown })?.type !== "paragraph")) found.add("nội dung ngoài chữ trong ô bảng");
    }
    if (Array.isArray(node.marks)) {
      for (const m of node.marks) {
        const t = (m as { type?: unknown })?.type;
        if (typeof t === "string" && !SUPPORTED_MARKS.has(t)) found.add(`dấu ${t}`);
      }
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return [...found];
}

const UNSUPPORTED_LABEL: Record<string, string> = {
  blockquote: "khối trích dẫn", codeBlock: "khối mã", horizontalRule: "đường kẻ ngang",
  "dấu link": "liên kết", "dấu code": "chữ mã",
  figure: "ảnh có chú thích", figcaption: "ảnh có chú thích",
};

/** Tên dễ hiểu (tiếng Việt, không trùng) của các phần chưa hỗ trợ, để báo cho giảng viên. Phần lạ giữ nguyên tên kỹ thuật. */
export function unsupportedLabels(names: string[]): string[] {
  return [...new Set(names.map((n) => UNSUPPORTED_LABEL[n] ?? n))];
}

/** Tiptap JSON → HTML cho ô soạn. Cần DOM (chạy ở trình duyệt). */
export function passageDocToHtml(doc: unknown): string {
  const ed = new Editor({ extensions: PASSAGE_EXTENSIONS, content: (doc ?? { type: "doc", content: [] }) as JSONContent });
  const html = ed.getHTML();
  ed.destroy();
  return html === "<p></p>" ? "" : html;
}

/**
 * HTML của ô soạn → Tiptap JSON đúng tập nút mà `PassageView` vẽ (nút lạ bị bỏ), kèm cờ `clipped` nếu một bảng bị cắt về 20 × 8.
 * Cần DOM.
 */
export function htmlToPassageDocChecked(html: string): { doc: { type: "doc"; content: unknown[] }; clipped: boolean } {
  const ed = new Editor({ extensions: PASSAGE_EXTENSIONS, content: html });
  const json = ed.getJSON();
  ed.destroy();
  const state = { clipped: false };
  const content = (json.content ?? []).map((n) => normalizeTables(keepOnlyPresets(n), state));
  return { doc: { type: "doc", content }, clipped: state.clipped };
}

export function htmlToPassageDoc(html: string): { type: "doc"; content: unknown[] } {
  return htmlToPassageDocChecked(html).doc;
}

/**
 * Giữ lại cỡ chữ (bốn mức), màu chữ và màu tô nổi (trong bảng màu) của một nút và nút con; giá trị ngoài bảng (dán từ Word: 12pt,
 * màu tuỳ ý) bị bỏ, dấu `textStyle` không còn thuộc tính nào thì bỏ hẳn. Màu về dạng `#rrggbb` (trình duyệt trả `rgb(…)`).
 */
function keepOnlyPresets(node: JSONContent): JSONContent {
  const out: JSONContent = { ...node };
  if (Array.isArray(node.marks)) {
    const marks = node.marks
      .map((m) => {
        const attrs = (m.attrs ?? {}) as { fontSize?: unknown; color?: unknown };
        if (m.type === "textStyle") {
          const kept: Record<string, string> = {};
          if (typeof attrs.fontSize === "string" && PASSAGE_FONT_SIZE_VALUES.has(attrs.fontSize)) kept.fontSize = attrs.fontSize;
          const color = passageTextColor(attrs.color);
          if (color) kept.color = color;
          return Object.keys(kept).length > 0 ? { type: "textStyle", attrs: kept } : null;
        }
        if (m.type === "highlight") {
          const color = passageHighlightColor(attrs.color);
          return color ? { type: "highlight", attrs: { color } } : { type: "highlight" };
        }
        return m;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
    if (marks.length > 0) out.marks = marks;
    else delete out.marks;
  }
  if (Array.isArray(node.content)) out.content = node.content.map(keepOnlyPresets);
  return out;
}

/**
 * HTML dán vào: trong ô bảng (td/th) đổi danh sách thành các đoạn chữ và bỏ ảnh/video/audio, để nội dung ở lại TRONG ô (ô chỉ chứa đoạn
 * văn; nếu để nguyên, trình phân tích đẩy danh sách ra ngoài bảng). Cần DOM; không có DOM hoặc không có bảng thì trả nguyên văn.
 */
export function flattenTableCellsHtml(html: string): string {
  if (typeof DOMParser === "undefined" || !/<t[dh][\s>]/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("td, th").forEach((cell) => {
    cell.querySelectorAll("img, video, audio, figure, iframe").forEach((el) => el.remove());
    cell.querySelectorAll("li").forEach((li) => {
      const p = doc.createElement("p");
      p.innerHTML = li.innerHTML;
      li.replaceWith(p);
    });
    cell.querySelectorAll("ul, ol").forEach((list) => list.replaceWith(...Array.from(list.childNodes)));
  });
  return doc.body.innerHTML;
}

/** Cỡ bảng tối đa: 20 hàng × 8 cột (đủ cho bài đọc; bảng lớn hơn khó đọc trên điện thoại). */
export const PASSAGE_TABLE_MAX_ROWS = 20;
export const PASSAGE_TABLE_MAX_COLS = 8;

/**
 * Bảng trong `node`: cắt về tối đa 20 hàng × 8 cột và tách ô gộp (colspan/rowspan) thành ô thường. Trả cờ `clipped` khi có cắt bớt hàng/cột
 * (để báo người soạn). Ô gộp không tính là cắt: nội dung ô vẫn còn.
 */
function normalizeTables(node: JSONContent, state: { clipped: boolean }): JSONContent {
  if (node.type === "table" && Array.isArray(node.content)) {
    if (node.content.length > PASSAGE_TABLE_MAX_ROWS) state.clipped = true;
    const rows = node.content.slice(0, PASSAGE_TABLE_MAX_ROWS).map((row) => {
      const cells = Array.isArray(row.content) ? row.content : [];
      if (cells.length > PASSAGE_TABLE_MAX_COLS) state.clipped = true;
      return {
        ...row,
        content: cells.slice(0, PASSAGE_TABLE_MAX_COLS).map((cell) => ({
          ...cell,
          attrs: { ...(cell.attrs ?? {}), colspan: 1, rowspan: 1, colwidth: null },
          content: (cell.content ?? []).map((c) => normalizeTables(c, state)),
        })),
      };
    });
    return { ...node, content: rows };
  }
  if (Array.isArray(node.content)) return { ...node, content: node.content.map((c) => normalizeTables(c, state)) };
  return node;
}

/** Đoạn không có chữ, ảnh, audio hay video nào. */
export function passageDocIsEmpty(doc: unknown): boolean {
  let has = false;
  const walk = (n: unknown) => {
    if (has || !n || typeof n !== "object") return;
    const node = n as { type?: unknown; text?: unknown; content?: unknown };
    if (typeof node.text === "string" && node.text.trim() !== "") has = true;
    if (node.type === "image" || node.type === "audio" || node.type === "video") has = true;
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return !has;
}
