import { describe, expect, it } from "vitest";
import { cleanImportedHtml, htmlImageCount, htmlWordCount, keepFormatDraftParts, markdownToHtml } from "./lessonKeepFormat";
import { normalizeLessonOutline } from "./lessonOutline";

describe("markdownToHtml", () => {
  it("giữ tiêu đề, đoạn, danh sách, bảng, đậm/nghiêng", () => {
    const html = markdownToHtml(
      [
        "# Tên",
        "",
        "## 1. Mở đầu",
        "Đoạn có **đậm** và *nghiêng*.",
        "Dòng nối tiếp.",
        "",
        "- ý một",
        "- ý hai",
        "",
        "1. bước một",
        "2. bước hai",
        "",
        "| A | B |",
        "|---|---|",
        "| 1 | 2 |",
      ].join("\n"),
    );
    expect(html).toContain("<h1>Tên</h1>");
    expect(html).toContain("<h2>1. Mở đầu</h2>");
    expect(html).toContain("<p>Đoạn có <strong>đậm</strong> và <em>nghiêng</em>. Dòng nối tiếp.</p>");
    expect(html).toContain("<ul><li><p>ý một</p></li><li><p>ý hai</p></li></ul>");
    expect(html).toContain("<ol><li><p>bước một</p></li><li><p>bước hai</p></li></ol>");
    expect(html).toContain("<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>");
  });

  it("thoát HTML và chặn liên kết nguy hiểm", () => {
    const html = markdownToHtml("<script>x</script> [bấm](javascript:alert(1)) [ok](https://a.vn)");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('<a href="https://a.vn">ok</a>');
  });
});

describe("cleanImportedHtml", () => {
  it("bỏ tiêu đề cấp 1 mở đầu khi còn tiêu đề khác, lấy làm tên", () => {
    const r = cleanImportedHtml("<h1>Tên tài liệu</h1><p></p><h2>Mục 1</h2><p>Nội dung</p>", "file");
    expect(r.title).toBe("Tên tài liệu");
    expect(r.html).toBe("<h2>Mục 1</h2><p>Nội dung</p>");
  });

  it("tên tài liệu và các mục đều là cấp 1: chỉ bỏ tên (liền sau là tiêu đề khác)", () => {
    const r = cleanImportedHtml("<h1>Tên</h1><h1>1. Mục</h1><p>a</p><h2>1.1</h2><p>b</p>", "file");
    expect(r.html).toBe("<h1>1. Mục</h1><p>a</p><h2>1.1</h2><p>b</p>");
  });

  it("mục cấp 1 đứng đầu (liền sau là đoạn chữ) thì giữ", () => {
    const r = cleanImportedHtml("<h1>1. Mục</h1><p>a</p><h1>2. Mục</h1><h2>2.1</h2>", "file");
    expect(r.html).toContain("<h1>1. Mục</h1>");
  });

  it("tài liệu chỉ có một tiêu đề thì giữ nguyên", () => {
    const r = cleanImportedHtml("<h1>Chỉ một</h1><p>Nội dung</p>", "file");
    expect(r.html).toContain("<h1>Chỉ một</h1>");
  });

  it("đếm từ và ảnh", () => {
    const h = '<p>một hai&nbsp;ba</p><img src="/a.png" alt="x"><table><tr><td>bốn</td></tr></table>';
    expect(htmlWordCount(h)).toBe(4);
    expect(htmlImageCount(h)).toBe(1);
  });
});

describe("keepFormatDraftParts", () => {
  it("một bài, bài đã sẵn, cờ giữ định dạng", () => {
    const p = keepFormatDraftParts("<p>a b c</p>", "Tên");
    expect(p.outline.keepFormat).toBe(true);
    expect(p.outline.lessons).toHaveLength(1);
    expect(p.result.lessons).toEqual([{ title: "Tên", html: "<p>a b c</p>" }]);
    expect(p.words).toBe(3);
  });
});

describe("normalizeLessonOutline — một bài, không bắt gán đoạn", () => {
  const paras = [{ t: "a" }, { t: "b" }, { t: "c" }, { t: "d" }, { t: "e" }];
  const sec = (title: string, ps: number[]) => ({ title, layout: "text", points: ["x"], boxes: [], paras: ps });

  it("mô hình đề xuất nhiều bài thì gộp mục vào một bài", () => {
    const o = normalizeLessonOutline(
      { lessons: [{ title: "B1", objectives: [], sections: [sec("M1", [0, 1])] }, { title: "B2", objectives: [], sections: [sec("M2", [2, 3, 4])] }] },
      paras,
    );
    expect(o.lessons).toHaveLength(1);
    expect(o.lessons[0]!.sections.map((s) => s.title)).toEqual(["M1", "M2"]);
  });

  it("đoạn bị bỏ sót tự nối vào mục đứng trước", () => {
    const o = normalizeLessonOutline({ lessons: [{ title: "B", objectives: [], sections: [sec("M1", [1]), sec("M2", [3])] }] }, paras);
    const [m1, m2] = o.lessons[0]!.sections;
    expect(m1!.paras).toEqual([0, 1, 2]);
    expect(m2!.paras).toEqual([3, 4]);
  });
});
