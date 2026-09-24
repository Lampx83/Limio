import { describe, expect, it } from "vitest";
import { htmlToLines, lessonToSlides, markdownToLines } from "../importFromCourse";

describe("nhập bài học vào deck dạy trực tiếp", () => {
  it("tách html richtext thành dòng chữ", () => {
    expect(htmlToLines("<h2>Mục A</h2><p>Xin &amp; chào</p><ul><li>một</li><li>hai</li></ul>")).toEqual([
      "Mục A",
      "Xin & chào",
      "một",
      "hai",
    ]);
  });

  it("bỏ ký hiệu markdown", () => {
    expect(markdownToLines("# Tiêu đề\n- **ý** một\n![a](b.png)\n---")).toEqual(["Tiêu đề", "ý một"]);
  });

  it("cắt thành nhiều slide, bỏ qua khối không phải chữ", () => {
    const html = "<p>" + Array.from({ length: 8 }, (_, i) => `d${i}`).join("</p><p>") + "</p>";
    const slides = lessonToSlides("Bài 1", "Chương 1", [
      { type: "video", payload: { url: "x" } },
      { type: "richtext", payload: { html } },
    ]);
    expect(slides).toHaveLength(2);
    expect((slides[0].config as { bullets: string[] }).bullets).toHaveLength(6);
    expect((slides[1].config as { title: string }).title).toBe("Bài 1 (tiếp)");
  });

  it("bài không có chữ vẫn ra 1 slide tiêu đề", () => {
    expect(lessonToSlides("Bài 2", "C", [])).toHaveLength(1);
  });
});
