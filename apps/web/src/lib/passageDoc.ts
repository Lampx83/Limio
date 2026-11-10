import { Editor, Node, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
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
    strike: false,
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
  PassageAudio,
  PassageVideo,
];


/** Tập nút/dấu mà `PassageView` vẽ được. Cái gì ngoài tập này là "chưa hỗ trợ". */
const SUPPORTED_NODES = new Set(["doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "hardBreak", "image", "audio", "video"]);
const SUPPORTED_MARKS = new Set(["bold", "italic", "underline", "highlight", "textStyle"]);

/** Tên các nút/dấu trong `doc` mà trình soạn không biểu diễn được (rỗng = soạn được, không mất gì). */
export function findUnsupported(doc: unknown): string[] {
  const found = new Set<string>();
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: unknown; marks?: unknown; content?: unknown };
    if (typeof node.type === "string" && !SUPPORTED_NODES.has(node.type)) found.add(node.type);
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
  table: "bảng", tableRow: "bảng", tableCell: "bảng", tableHeader: "bảng",
  blockquote: "khối trích dẫn", codeBlock: "khối mã", horizontalRule: "đường kẻ ngang",
  "dấu link": "liên kết", "dấu strike": "gạch ngang", "dấu code": "chữ mã",
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

/** HTML của ô soạn → Tiptap JSON đúng tập nút mà `PassageView` vẽ (nút lạ bị bỏ). Cần DOM. */
export function htmlToPassageDoc(html: string): { type: "doc"; content: unknown[] } {
  const ed = new Editor({ extensions: PASSAGE_EXTENSIONS, content: html });
  const json = ed.getJSON();
  ed.destroy();
  return { type: "doc", content: (json.content ?? []).map(keepOnlyPresets) };
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
