import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { LessonBoxKind, LessonLayoutKey } from "@feedbackme/shared-types";

/**
 * Thao tác trên khối bài học (mục, phần, hộp, ảnh có chú thích). Mọi thao tác đi
 * qua một transaction duy nhất nên Ctrl+Z hoàn tác được trọn vẹn, và kiểm hợp lệ
 * với schema trước khi áp — không bao giờ dựng ra một bài sai cấu trúc.
 */

export interface NodeRef {
  node: PMNode;
  pos: number;
}

export interface LessonContext {
  section: NodeRef | null;
  part: NodeRef | null;
  box: NodeRef | null;
}

/** Mục / phần / hộp gần nhất bao quanh con trỏ. */
export function lessonContext(state: EditorState): LessonContext {
  const $from = state.selection.$from;
  const ctx: LessonContext = { section: null, part: null, box: null };
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    const ref = { node, pos: $from.before(d) };
    if (node.type.name === "lessonBox" && !ctx.box) ctx.box = ref;
    else if (node.type.name === "lessonPart" && !ctx.part) ctx.part = ref;
    else if (node.type.name === "lessonSection" && !ctx.section) ctx.section = ref;
  }
  return ctx;
}

/* ---------- Dựng nội dung mẫu ---------- */

/** Loại node theo tên — các node này luôn có trong EXTENSIONS, thiếu là lỗi lập trình. */
function T(schema: Schema, name: string) {
  const t = schema.nodes[name];
  if (!t) throw new Error(`schema thiếu node ${name}`);
  return t;
}

function p(schema: Schema, text: string): PMNode {
  return T(schema, "paragraph").create(null, text ? schema.text(text) : null);
}
function h(schema: Schema, level: number, text: string): PMNode {
  return T(schema, "heading").create({ level }, text ? schema.text(text) : null);
}
function ul(schema: Schema, items: string[]): PMNode {
  return T(schema, "bulletList").create(
    null,
    items.map((t) => T(schema, "listItem").create(null, p(schema, t))),
  );
}
function part(schema: Schema, title: string, body: string): PMNode {
  return T(schema, "lessonPart").create(null, [h(schema, 3, title), p(schema, body)]);
}

/** Chữ mẫu cho từng bố cục — giảng viên gõ đè lên. */
const LAYOUT_SAMPLE: Record<LessonLayoutKey, { intro: string; parts: Array<[string, string]> }> = {
  text: { intro: "Nội dung của mục.", parts: [] },
  image: { intro: "Nội dung của mục. Chèn một ảnh có chú thích vào mục này, ảnh sẽ nằm bên phải.", parts: [] },
  cards: {
    intro: "Câu dẫn cho các khái niệm.",
    parts: [
      ["Khái niệm thứ nhất", "Mô tả ngắn gọn khái niệm."],
      ["Khái niệm thứ hai", "Mô tả ngắn gọn khái niệm."],
      ["Khái niệm thứ ba", "Mô tả ngắn gọn khái niệm."],
    ],
  },
  compare: {
    intro: "Câu dẫn cho phần so sánh.",
    parts: [
      ["Phương án thứ nhất", "Đặc điểm của phương án này."],
      ["Phương án thứ hai", "Đặc điểm của phương án này."],
    ],
  },
  steps: {
    intro: "Câu dẫn cho quy trình.",
    parts: [
      ["Bước thứ nhất", "Mô tả việc cần làm."],
      ["Bước thứ hai", "Mô tả việc cần làm."],
      ["Bước thứ ba", "Mô tả việc cần làm."],
    ],
  },
  faq: {
    intro: "",
    parts: [
      ["Câu hỏi thứ nhất?", "Câu trả lời."],
      ["Câu hỏi thứ hai?", "Câu trả lời."],
    ],
  },
  stats: {
    intro: "Câu dẫn cho các con số. Chỉ dùng số có trong tài liệu.",
    parts: [
      ["0", "Chú thích cho con số."],
      ["0", "Chú thích cho con số."],
      ["0", "Chú thích cho con số."],
    ],
  },
};

const BOX_SAMPLE: Record<LessonBoxKind, (s: Schema) => PMNode[]> = {
  objectives: (s) => [ul(s, ["Trình bày được …", "Phân biệt được …", "Áp dụng được …"])],
  summary: (s) => [ul(s, ["Ý chính thứ nhất.", "Ý chính thứ hai."])],
  note: (s) => [p(s, "Nội dung cần lưu ý.")],
  example: (s) => [p(s, "Nội dung ví dụ.")],
  definition: (s) => [p(s, "Nội dung định nghĩa.")],
};

/* ---------- Tìm chỗ chèn ---------- */

/**
 * Vị trí ngay sau khối đang chứa con trỏ, ở tầng sâu nhất mà `node` được phép
 * đứng (vd. hộp chèn trong phần thì nằm trong phần; mục mới luôn ở tầng ngoài).
 */
function insertPosFor(state: EditorState, node: PMNode): number | null {
  const $from = state.selection.$from;
  for (let d = $from.depth - 1; d >= 0; d--) {
    const parent = $from.node(d);
    const index = $from.index(d) + 1;
    if (parent.canReplaceWith(index, index, node.type)) return $from.after(d + 1);
  }
  return null;
}

function insertAndFocus(editor: Editor, node: PMNode, focusOffset = 1): boolean {
  const { state, view } = editor;
  const pos = insertPosFor(state, node);
  if (pos === null) return false;
  const tr = state.tr.insert(pos, node);
  tr.setSelection(TextSelection.near(tr.doc.resolve(pos + focusOffset)));
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/* ---------- Mục ---------- */

export function insertSection(editor: Editor, layout: LessonLayoutKey): boolean {
  const s = editor.schema;
  const sample = LAYOUT_SAMPLE[layout];
  const children: PMNode[] = [h(s, 2, "Tiêu đề mục")];
  if (sample.intro) children.push(p(s, sample.intro));
  for (const [t, b] of sample.parts) children.push(part(s, t, b));
  const node = T(s, "lessonSection").create({ layout }, children);
  // Mục chỉ đứng ở tầng ngoài cùng: chèn sau khối ngoài cùng đang chứa con trỏ.
  const { state, view } = editor;
  const $from = state.selection.$from;
  const pos = $from.depth >= 1 ? $from.after(1) : state.doc.content.size;
  const tr = state.tr.insert(pos, node);
  // Bôi đen "Tiêu đề mục" để gõ đè ngay.
  tr.setSelection(TextSelection.create(tr.doc, pos + 2, pos + 2 + "Tiêu đề mục".length));
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

export function setSectionLayout(editor: Editor, section: NodeRef, layout: LessonLayoutKey): void {
  const { state, view } = editor;
  view.dispatch(state.tr.setNodeMarkup(section.pos, undefined, { ...section.node.attrs, layout }));
}

/** Thêm một phần ngay sau phần đang đứng, hoặc cuối mục. */
export function addPart(editor: Editor, ctx: LessonContext): boolean {
  if (!ctx.section) return false;
  const s = editor.schema;
  const layout = ctx.section.node.attrs.layout as LessonLayoutKey;
  const [title, body] =
    layout === "faq"
      ? ["Câu hỏi?", "Câu trả lời."]
      : layout === "stats"
        ? ["0", "Chú thích cho con số."]
        : ["Tiêu đề phần", "Nội dung phần."];
  const node = part(s, title, body);
  const pos = ctx.part
    ? ctx.part.pos + ctx.part.node.nodeSize
    : ctx.section.pos + ctx.section.node.nodeSize - 1;
  const { state, view } = editor;
  const tr = state.tr.insert(pos, node);
  // Bôi đen tiêu đề phần mới.
  tr.setSelection(TextSelection.create(tr.doc, pos + 2, pos + 2 + title.length));
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/* ---------- Hộp ---------- */

export function insertBox(editor: Editor, kind: LessonBoxKind): boolean {
  const s = editor.schema;
  const node = T(s, "lessonBox").create({ kind, title: null }, BOX_SAMPLE[kind](s));
  return insertAndFocus(editor, node, 2);
}

export function setBoxAttrs(
  editor: Editor,
  box: NodeRef,
  attrs: { kind?: LessonBoxKind; title?: string | null },
): void {
  const { state, view } = editor;
  view.dispatch(state.tr.setNodeMarkup(box.pos, undefined, { ...box.node.attrs, ...attrs }));
}

/* ---------- Ảnh có chú thích ---------- */

export const FIGURE_CAPTION_SAMPLE = "Hình . Chú thích ảnh. Nguồn: …";

export function insertFigure(editor: Editor, src: string, alt: string): boolean {
  const s = editor.schema;
  const node = T(s, "lessonFigure").create({ src, alt }, s.text(FIGURE_CAPTION_SAMPLE));
  return insertAndFocus(editor, node, 1);
}

/* ---------- Di chuyển, xoá ---------- */

function swapped(parent: PMNode, i: number, j: number): PMNode[] {
  const children: PMNode[] = [];
  parent.forEach((c) => children.push(c));
  const a = children[i]!;
  children[i] = children[j]!;
  children[j] = a;
  return children;
}

/**
 * Đổi chỗ khối với khối liền trước/sau trong cùng cha. Không làm nếu kết quả
 * sai cấu trúc (vd. đưa một phần lên trên tiêu đề mục).
 */
export function moveNode(editor: Editor, ref: NodeRef, dir: -1 | 1): boolean {
  const { state, view } = editor;
  const $pos = state.doc.resolve(ref.pos);
  const parent = $pos.parent;
  const index = $pos.index();
  const other = index + dir;
  if (other < 0 || other >= parent.childCount) return false;

  const children = swapped(parent, index, other);
  if (!parent.type.validContent(Fragment.from(children))) return false;

  const sibling = parent.child(other);
  const tr = state.tr.delete(ref.pos, ref.pos + ref.node.nodeSize);
  const target = dir < 0 ? ref.pos - sibling.nodeSize : ref.pos + sibling.nodeSize;
  tr.insert(target, ref.node);
  tr.setSelection(TextSelection.near(tr.doc.resolve(target + 1)));
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

export function canMove(state: EditorState, ref: NodeRef, dir: -1 | 1): boolean {
  const $pos = state.doc.resolve(ref.pos);
  const parent = $pos.parent;
  const index = $pos.index();
  const other = index + dir;
  if (other < 0 || other >= parent.childCount) return false;
  const children = swapped(parent, index, other);
  return parent.type.validContent(Fragment.from(children));
}

export function deleteNode(editor: Editor, ref: NodeRef): boolean {
  const { state, view } = editor;
  const tr = state.tr.delete(ref.pos, ref.pos + ref.node.nodeSize);
  // Tài liệu không được rỗng: xoá khối cuối cùng thì để lại một đoạn trống.
  if (tr.doc.childCount === 0) tr.insert(0, T(state.schema, "paragraph").create());
  if (!tr.doc.type.validContent(tr.doc.content)) return false;
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/* ---------- Viền mục/phần/hộp đang đứng (chỉ trong trình soạn) ---------- */

const activeKey = new PluginKey("lessonActive");

export const LessonActive = Extension.create({
  name: "lessonActive",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: activeKey,
        props: {
          decorations(state) {
            const ctx = lessonContext(state);
            const decos: Decoration[] = [];
            const add = (ref: NodeRef | null, cls: string) => {
              if (ref) decos.push(Decoration.node(ref.pos, ref.pos + ref.node.nodeSize, { class: cls }));
            };
            add(ctx.section, "lk-active");
            add(ctx.part, "lk-active-part");
            add(ctx.box, "lk-active");
            return decos.length ? DecorationSet.create(state.doc, decos) : null;
          },
        },
      }),
    ];
  },
});
