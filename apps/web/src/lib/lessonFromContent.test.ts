import { describe, expect, it } from "vitest";
import { orphanParas, outlineProblems } from "./lessonOutline";
import { outlineFromLessonHtml } from "./lessonFromContent";

/** S4 — "Làm lại từ dàn ý": dàn ý dựng từ chính bài hiện có, không gọi AI. */
describe("dàn ý từ bài hiện có", () => {
  it("bài dạng khối: giữ tiêu đề, bố cục, hộp, mục tiêu; mỗi đoạn thuộc đúng mục của nó; bỏ Tổng kết cũ", () => {
    const html =
      '<div class="lesson-box" data-kind="objectives" data-title="Mục tiêu học tập"><ul><li><p>Trình bày được A.</p></li></ul></div>' +
      '<section class="lesson-section" data-layout="cards"><h2 id="muc-a">Khái niệm &amp; ví dụ</h2><p>Mở đầu của mục một khá dài để làm ý chính.</p>' +
      '<div class="lesson-part"><h3>Thẻ</h3><p>Nội dung thẻ.</p></div></section>' +
      '<section class="lesson-section" data-layout="steps"><h2>Các bước</h2><p>Bước một.</p>' +
      '<div class="lesson-box" data-kind="note" data-title="Lưu ý"><p>Cẩn thận.</p></div>' +
      '<figure class="lesson-figure"><img src="/a.png" alt="Hình"><figcaption>Hình 1.</figcaption></figure></section>' +
      '<div class="lesson-box" data-kind="summary" data-title="Tổng kết"><ul><li><p>Tổng kết cũ.</p></li></ul></div>';
    const { paras, outline } = outlineFromLessonHtml(html, "Bài 2.3");
    const l = outline.lessons[0]!;
    expect(l.title).toBe("Bài 2.3");
    expect(l.objectives).toEqual(["Trình bày được A."]);
    expect(l.sections.map((s) => [s.title, s.layout])).toEqual([
      ["Khái niệm & ví dụ", "cards"],
      ["Các bước", "steps"],
    ]);
    expect(l.sections[1]!.boxes).toEqual(["note"]);
    expect(paras.some((p) => "img" in p && p.img === "/a.png")).toBe(true);
    expect(paras.some((p) => "t" in p && p.t.includes("Tổng kết cũ"))).toBe(false);
    expect(l.sections[0]!.points[0]).toContain("Mở đầu của mục một");
    // Mọi đoạn đều đã thuộc một mục — chốt được ngay.
    expect(orphanParas(outline, paras)).toEqual([]);
    expect(outlineProblems(outline, paras)).toEqual([]);
  });

  it("bài cũ chưa chia mục: chia theo <h2>, phần trước <h2> đầu tiên vào mục đầu", () => {
    const { paras, outline } = outlineFromLessonHtml("<p>Lời mở.</p><h2>Một</h2><p>A.</p><h2>Hai</h2><p>B.</p>", "Bài");
    expect(outline.lessons[0]!.sections.map((s) => s.title)).toEqual(["Một", "Hai"]);
    expect(outline.lessons[0]!.sections[0]!.paras).toEqual([0, 1]);
    expect(orphanParas(outline, paras)).toEqual([]);
  });

  it("bài không có tiêu đề mục nào: một mục mang tên bài", () => {
    const { outline } = outlineFromLessonHtml("<p>Chỉ có đoạn văn.</p>", "Bài lẻ");
    expect(outline.lessons[0]!.sections.map((s) => s.title)).toEqual(["Bài lẻ"]);
  });
});
