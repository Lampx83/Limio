import { Node, mergeAttributes } from "@tiptap/core";
import {
  LESSON_BOX_LABELS,
  isLessonBoxKind,
  isLessonLayoutKey,
  type LessonBoxKind,
} from "@feedbackme/shared-types";

/**
 * Các khối của bài học văn bản, dạy cho TipTap. Chỉ khai báo cấu trúc (schema),
 * không có giao diện — nên dùng được cả trong editor thật lẫn trong hàm dò mất
 * mát (lossProbe) chạy không gắn DOM.
 *
 * HTML sinh ra chỉ mang TÊN (class, data-layout, data-kind), không mang màu:
 *   <section class="lesson-section" data-layout="cards">
 *     <h2>…</h2> <p>…</p>
 *     <div class="lesson-part"><h3>…</h3><p>…</p></div>
 *   </section>
 *   <div class="lesson-box" data-kind="note" data-title="Lưu ý">…</div>
 *   <figure class="lesson-figure"><img src alt><figcaption>…</figcaption></figure>
 * Hình thức do lessonLook.css + bảng màu quyết định lúc hiển thị, vì vậy sửa
 * chữ thoải mái mà khối không bao giờ vỡ.
 *
 * Quan hệ chứa nhau (để không lồng lung tung):
 *   tài liệu  ⊃ khối thường | hộp | mục
 *   mục       ⊃ tiêu đề (bắt buộc, đứng đầu), rồi khối thường | hộp | phần
 *   phần      ⊃ khối thường | hộp
 *   hộp       ⊃ khối thường (không hộp trong hộp)
 * "Khối thường" = nhóm `block` của TipTap (đoạn, tiêu đề, danh sách, bảng, ảnh…).
 */

export const LessonDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "(block | lkBox | lkSection)+",
});

export const LessonSection = Node.create({
  name: "lessonSection",
  group: "lkSection",
  content: "heading (block | lkBox | lkPart)*",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      layout: {
        default: "text",
        parseHTML: (el) => {
          const v = el.getAttribute("data-layout");
          return isLessonLayoutKey(v) ? v : "text";
        },
        renderHTML: (attrs) => ({ "data-layout": attrs.layout }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "section.lesson-section" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes({ class: "lesson-section" }, HTMLAttributes), 0];
  },
});

export const LessonPart = Node.create({
  name: "lessonPart",
  group: "lkPart",
  content: "(block | lkBox)+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "div.lesson-part" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ class: "lesson-part" }, HTMLAttributes), 0];
  },
});

export const LessonBox = Node.create({
  name: "lessonBox",
  group: "lkBox",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      kind: {
        default: "note",
        parseHTML: (el) => {
          const v = el.getAttribute("data-kind");
          return isLessonBoxKind(v) ? v : "note";
        },
        renderHTML: (attrs) => ({ "data-kind": attrs.kind }),
      },
      // null = dùng tên mặc định của loại hộp (đổi loại thì tên đổi theo).
      title: {
        default: null,
        parseHTML: (el) => {
          const kind = el.getAttribute("data-kind");
          const t = (el.getAttribute("data-title") ?? "").trim();
          if (!t) return null;
          if (isLessonBoxKind(kind) && t === LESSON_BOX_LABELS[kind]) return null;
          return t;
        },
        // Ghi ở renderHTML của node (cần biết cả kind).
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.lesson-box" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = node.attrs.kind as LessonBoxKind;
    const title = (node.attrs.title as string | null) || LESSON_BOX_LABELS[kind];
    return [
      "div",
      mergeAttributes({ class: "lesson-box" }, HTMLAttributes, { "data-title": title }),
      0,
    ];
  },
});

export const LessonFigure = Node.create({
  name: "lessonFigure",
  group: "block",
  content: "inline*",
  draggable: false,
  isolating: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        // Không có <figcaption> thì vẫn nhận ảnh, chú thích để trống.
        contentElement: (dom: HTMLElement) =>
          dom.querySelector("figcaption") ?? dom.ownerDocument.createElement("figcaption"),
        getAttrs: (dom: HTMLElement) => {
          const img = dom.querySelector("img");
          if (!img?.getAttribute("src")) return false;
          return { src: img.getAttribute("src"), alt: img.getAttribute("alt") ?? "" };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      "figure",
      { class: "lesson-figure" },
      ["img", { src: node.attrs.src, alt: node.attrs.alt }],
      ["figcaption", 0],
    ];
  },
});

export const LESSON_NODES = [LessonDocument, LessonSection, LessonPart, LessonBox, LessonFigure];
