// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { EXTENSIONS } from "./extensions";
import {
  addPart,
  canMove,
  deleteNode,
  insertBox,
  insertSection,
  lessonContext,
  moveNode,
  setBoxAttrs,
  setSectionLayout,
} from "./lessonCommands";
import { probeEditorLoss } from "./lossProbe";

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function make(html: string): Editor {
  editor = new Editor({ element: document.createElement("div"), extensions: EXTENSIONS, content: html });
  return editor;
}

/** Đặt con trỏ vào đầu đoạn chữ có nội dung `text`. */
function cursorAt(ed: Editor, text: string) {
  let at = -1;
  ed.state.doc.descendants((n, pos) => {
    if (at < 0 && n.isText && n.text?.includes(text)) at = pos;
  });
  if (at < 0) throw new Error(`không thấy "${text}"`);
  ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, at)));
}

const SECTION =
  '<section class="lesson-section" data-layout="cards"><h2>Mục</h2><p>Mở đầu</p>' +
  '<div class="lesson-part"><h3>A</h3><p>Nội dung A</p></div>' +
  '<div class="lesson-part"><h3>B</h3><p>Nội dung B</p></div></section>';

describe("thao tác trên khối bài học", () => {
  it("chèn mục mới: nằm ở tầng ngoài, đúng bố cục, có chữ mẫu, bài vẫn hợp lệ", () => {
    const ed = make("<p>Đoạn đầu</p>" + SECTION);
    cursorAt(ed, "Nội dung A");
    insertSection(ed, "steps");
    const html = ed.getHTML();
    // Mục mới chèn SAU mục đang đứng, không lồng vào trong.
    expect(html.indexOf('data-layout="steps"')).toBeGreaterThan(html.indexOf("Nội dung B"));
    expect(html).not.toMatch(/<section[^>]*cards[^>]*>(?:(?!<\/section>).)*<section/);
    expect(html.match(/class="lesson-part"/g)?.length).toBe(2 + 3);
    expect(probeEditorLoss(html, EXTENSIONS)).toBeNull();
  });

  it("đổi bố cục giữ nguyên chữ (K3)", () => {
    const ed = make(SECTION);
    cursorAt(ed, "Nội dung A");
    const before = ed.state.doc.textContent;
    setSectionLayout(ed, lessonContext(ed.state).section!, "faq");
    expect(ed.getHTML()).toContain('data-layout="faq"');
    expect(ed.state.doc.textContent).toBe(before);
  });

  it("thêm phần chèn ngay sau phần đang đứng", () => {
    const ed = make(SECTION);
    cursorAt(ed, "Nội dung A");
    addPart(ed, lessonContext(ed.state));
    const html = ed.getHTML();
    expect(html.indexOf("Tiêu đề phần")).toBeGreaterThan(html.indexOf("Nội dung A"));
    expect(html.indexOf("Tiêu đề phần")).toBeLessThan(html.indexOf("Nội dung B"));
  });

  it("di chuyển phần đổi chỗ với phần kế bên; không đưa phần lên trên tiêu đề mục", () => {
    const ed = make(SECTION);
    cursorAt(ed, "Nội dung B");
    const partB = lessonContext(ed.state).part!;
    expect(moveNode(ed, partB, -1)).toBe(true);
    const html = ed.getHTML();
    expect(html.indexOf("Nội dung B")).toBeLessThan(html.indexOf("Nội dung A"));
    // Giờ B đứng đầu: phía trước là đoạn "Mở đầu" — đổi chỗ vẫn hợp lệ.
    cursorAt(ed, "Mở đầu");
    cursorAt(ed, "Nội dung B");
    const b2 = lessonContext(ed.state).part!;
    expect(canMove(ed.state, b2, -1)).toBe(true);
    moveNode(ed, b2, -1);
    // Phía trước bây giờ là tiêu đề mục: không cho đổi.
    cursorAt(ed, "Nội dung B");
    expect(canMove(ed.state, lessonContext(ed.state).part!, -1)).toBe(false);
    expect(ed.getHTML()).toMatch(/<section[^>]*><h2[^>]*>Mục<\/h2>/);
  });

  it("xoá phần chỉ xoá phần đó", () => {
    const ed = make(SECTION);
    cursorAt(ed, "Nội dung A");
    deleteNode(ed, lessonContext(ed.state).part!);
    expect(ed.getHTML()).not.toContain("Nội dung A");
    expect(ed.getHTML()).toContain("Nội dung B");
  });

  it("chèn hộp trong phần thì nằm trong phần; đổi loại và tên hộp", () => {
    const ed = make(SECTION);
    cursorAt(ed, "Nội dung A");
    insertBox(ed, "note");
    let html = ed.getHTML();
    expect(html).toMatch(/<div class="lesson-part"><h3[^>]*>A<\/h3><p>Nội dung A<\/p><div class="lesson-box" data-kind="note"/);
    cursorAt(ed, "Nội dung cần lưu ý");
    setBoxAttrs(ed, lessonContext(ed.state).box!, { kind: "definition" });
    expect(ed.getHTML()).toContain('data-title="Định nghĩa"');
    setBoxAttrs(ed, lessonContext(ed.state).box!, { title: "Khái niệm then chốt" });
    html = ed.getHTML();
    expect(html).toContain('data-kind="definition" data-title="Khái niệm then chốt"');
  });

  it("xoá khối cuối cùng của bài vẫn để lại một đoạn trống", () => {
    const ed = make(SECTION);
    cursorAt(ed, "Nội dung A");
    deleteNode(ed, lessonContext(ed.state).section!);
    expect(ed.getHTML()).toBe("<p></p>");
  });
});
