import { afterEach, describe, expect, it } from "vitest";
import { markdownToHtml, setBookStyle } from "../import-course";

/**
 * Phong cách sách giáo trình của importer (`course.bookStyle`): dải kỹ năng, nhãn bài tập, hộp TIP, một màu nhấn, không mục lục tự sinh.
 * Khoá không bật bookStyle phải giữ nguyên cách dựng cũ.
 */
afterEach(() => setBookStyle(null));

describe("markdownToHtml — phong cách sách", () => {
  it("tiêu đề cấp 2 thành dải màu có tên kỹ năng (chữ hoa) và dòng phụ in hoa bên dưới", () => {
    setBookStyle("229,0,92");
    const html = markdownToHtml("## Grammar · Present tenses: simple vs continuous\n\ntext");
    expect(html).toContain("linear-gradient(90deg,rgb(229,0,92)");
    expect(html).toContain("text-transform:uppercase");
    expect(html).toContain("Grammar");
    expect(html).toContain("Present tenses: simple vs continuous");
    expect(html).not.toContain("<nav"); // không mục lục tự sinh
  });

  it("'Vocabulary Plus' viết 'plus' nghiêng như dải của sách", () => {
    setBookStyle("229,0,92");
    expect(markdownToHtml("## Vocabulary Plus · Multi-word verbs\n\nx")).toContain("<i");
  });

  it("nhãn bài tập: số lớn + chữ cái màu nhấn; chỉ chữ cái thì thụt vào; chỉ số cũng được", () => {
    setBookStyle("229,0,92");
    const a = markdownToHtml("**3 C** Look at the verbs.");
    expect(a).toContain("font-size:1.6em");
    expect(a).toContain(">3</span>");
    expect(a).toContain(">C</span>");
    expect(a).toContain("Look at the verbs.");
    const b = markdownToHtml("**B** Listen and check.");
    expect(b).toContain("padding-left:1.4rem");
    expect(b).not.toContain("1.6em");
    const c = markdownToHtml("**5** Complete the sentences.");
    expect(c).toContain(">5</span>");
  });

  it("hộp TIP kẻ hai đầu bằng màu nhấn", () => {
    setBookStyle("229,0,92");
    const html = markdownToHtml(":::tip TIP\nWhen you learn new words, write example sentences.\n:::");
    expect(html).toContain("border-top:2px solid rgb(229,0,92)");
    expect(html).toContain("border-bottom:2px solid rgb(229,0,92)");
    expect(html).toContain("write example sentences.");
  });

  it("chữ và dãn dòng gọn: cỡ 1.0625rem, dãn dòng 1.6 (không còn 1.7–1.8)", () => {
    setBookStyle("229,0,92");
    const html = markdownToHtml("Một đoạn văn.\n\n- một\n- hai");
    expect(html).toContain("font-size:1.0625rem");
    expect(html).not.toMatch(/line-height:1\.[78]\b/);
  });

  it("không bật bookStyle: giữ cách dựng cũ (nhãn là chữ đậm thường, không dải, cỡ 1.25rem)", () => {
    const html = markdownToHtml("## Grammar · Tenses\n\n**3 C** Look.");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("1.6em");
    expect(html).toContain("font-size:1.25rem");
  });

  it("hộp RULES có nhãn dọc; hộp thường có tiêu đề; hộp từ có viền màu nhấn", () => {
    setBookStyle("229,0,92");
    const rules = markdownToHtml(":::rules\n**present simple**\n\n- a) for habits\n:::");
    expect(rules).toContain("writing-mode:vertical-rl");
    expect(rules).toContain(">RULES<");
    expect(rules).toContain("for habits");
    const box = markdownToHtml(":::box KEY PHRASES\nI spent eight years as a lawyer.\n:::");
    expect(box).toContain("border:1.5px solid rgba(229,0,92");
    expect(box).toContain("KEY PHRASES");
  });

  it("dải đầu bài: số bài, tên chữ hoa, các dòng G/P/V có vòng chữ cái; bài không có G/P/V vẫn dựng dải", () => {
    setBookStyle("229,0,92");
    const html = markdownToHtml(":::lessonbar 1.2 | Life is busy\nG present tenses\nP connected speech\nV verb + preposition\n:::");
    expect(html).toContain("1.2");
    expect(html).toContain("Life is busy");
    expect((html.match(/border-radius:50%/g) ?? []).length).toBe(3);
    expect(markdownToHtml(":::lessonbar 1.4 | Fair Isle\n:::")).toContain("Fair Isle");
  });

  it("dòng chỉ dẫn 'page 104 LANGUAGEBANK' một dòng, không cần đóng :::", () => {
    setBookStyle("229,0,92");
    const html = markdownToHtml(":::ref page 104 LANGUAGEBANK\n\nSau đó là đoạn văn.");
    expect(html).toContain("page 104");
    expect(html).toContain("LANGUAGEBANK");
    expect(html).toContain("Sau đó là đoạn văn.");
  });

  it("không bật bookStyle thì các chỉ thị hộp không có tác dụng đặc biệt (không dựng hộp sách)", () => {
    expect(markdownToHtml(":::rules\nx\n:::")).not.toContain("writing-mode");
  });
});
