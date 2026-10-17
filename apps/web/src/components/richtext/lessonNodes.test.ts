// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { LESSON_LAYOUT_KEYS } from "@feedbackme/shared-types";
import { EXTENSIONS } from "./extensions";
import { probeEditorLoss } from "./lossProbe";

/** Một bài đủ mọi loại khối, đúng dạng HTML mà trình soạn thảo sinh ra. */
const SAMPLE = [
  '<div class="lesson-box" data-kind="objectives" data-title="Mục tiêu học tập"><ul><li><p>Giải thích được nguyên tắc gần nhau.</p></li></ul></div>',
  ...LESSON_LAYOUT_KEYS.map(
    (layout) =>
      `<section class="lesson-section" data-layout="${layout}"><h2 id="muc-${layout}">Mục ${layout}</h2><p>Mở đầu của mục.</p>` +
      '<div class="lesson-part"><h3 id="muc-a-' + layout + '">Phần A</h3><p>Nội dung <strong>đậm</strong> và <span style="color: rgb(220, 38, 38);">màu</span>.</p></div>' +
      '<div class="lesson-part"><h3 id="muc-b-' + layout + '">Phần B</h3><p>Nội dung B.</p>' +
      '<div class="lesson-box" data-kind="example" data-title="Ví dụ">' +
      "<p>Một ví dụ trong phần.</p></div></div>" +
      '<figure class="lesson-figure"><img src="/uploads/a.png" alt="Hình A"><figcaption>Hình 1. Nguồn: tự vẽ.</figcaption></figure>' +
      "</section>",
  ),
  '<div class="lesson-box" data-kind="note" data-title="Lưu ý quan trọng"><p>Đọc kỹ trước khi làm.</p></div>',
  '<div class="lesson-box" data-kind="summary" data-title="Tổng kết"><ul><li><p>Ý chính.</p></li></ul></div>',
].join("");

function roundTrip(html: string): string {
  const ed = new Editor({ extensions: EXTENSIONS, content: html });
  const out = ed.getHTML();
  ed.destroy();
  return out;
}

describe("khối bài học trong trình soạn thảo", () => {
  it("bài đủ 7 bố cục, hộp, phần, ảnh có chú thích đi qua trình soạn thảo không mất gì (K5)", () => {
    expect(probeEditorLoss(SAMPLE, EXTENSIONS)).toBeNull();
  });

  it("sinh lại đúng từng byte — mở ra rồi lưu không làm bài thay đổi", () => {
    expect(roundTrip(SAMPLE)).toBe(SAMPLE);
  });

  it("hộp không đặt tên riêng thì không lưu tên, đổi loại là tên đổi theo", () => {
    const html = roundTrip('<div class="lesson-box" data-kind="definition"><p>x</p></div>');
    expect(html).toContain('data-title="Định nghĩa"');
    const ed = new Editor({ extensions: EXTENSIONS, content: html });
    let boxPos = -1;
    ed.state.doc.descendants((n, pos) => {
      if (n.type.name === "lessonBox") boxPos = pos;
    });
    expect(ed.state.doc.nodeAt(boxPos)?.attrs.title).toBeNull();
    ed.destroy();
  });

  it("bố cục lạ rơi về Văn bản, mục thiếu tiêu đề được thêm tiêu đề rỗng (không mất chữ)", () => {
    const html = roundTrip('<section class="lesson-section" data-layout="xyz"><p>Chỉ có đoạn.</p></section>');
    expect(html).toContain('data-layout="text"');
    expect(html).toContain("Chỉ có đoạn.");
    expect(html).toMatch(/<section[^>]*><h1|<section[^>]*><h2|<section[^>]*><h3/);
  });

  it("hộp không lồng trong hộp — hộp con được tách ra, chữ vẫn còn", () => {
    const html = roundTrip(
      '<div class="lesson-box" data-kind="note"><p>Ngoài</p><div class="lesson-box" data-kind="example"><p>Trong</p></div></div>',
    );
    expect(html).toContain("Ngoài");
    expect(html).toContain("Trong");
    expect(html.match(/lesson-box/g)?.length ?? 0).toBeLessThanOrEqual(2);
    expect(html).not.toMatch(/<div class="lesson-box"[^>]*><p>Ngoài<\/p><div class="lesson-box"/);
  });

  it("bài cũ không có khối mới vẫn đi qua như trước", () => {
    const old = "<h2 id=\"muc-gioi-thieu\">Giới thiệu</h2><p>Đoạn văn.</p><ul><li><p>Một</p></li></ul>";
    expect(roundTrip(old)).toBe(old);
  });

  it("bài AI định dạng kiểu cũ (style viết thẳng vào thẻ) vẫn bị báo mất định dạng như trước", () => {
    const legacy =
      '<div class="lesson-objectives" style="background:#eef;padding:12px"><h3 style="color:#1d4ed8">Mục tiêu</h3><ul><li>Một</li></ul></div>';
    expect(probeEditorLoss(legacy, EXTENSIONS)?.lostStyles).toBeGreaterThan(0);
  });
});
