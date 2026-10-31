import { describe, expect, it } from "vitest";
import { plainToRichHtml } from "./richText";

describe("plainToRichHtml — công thức trong đề và phương án", () => {
  it("$…$ thành span data-latex, phần chữ còn lại vẫn được escape", () => {
    const html = plainToRichHtml('Giải $x^2-5x+6=0$ với a<b & "c".');
    expect(html).toContain('<span class="math-inline" data-latex="x^2-5x+6=0">x^2-5x+6=0</span>');
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;c&quot;");
  });

  it("tiền tệ không bị bắt nhầm; chữ thường không có $ giữ như cũ", () => {
    expect(plainToRichHtml("Giá $5 và $10.")).toBe("<p>Giá $5 và $10.</p>");
    expect(plainToRichHtml("Hai\n\nđoạn")).toBe("<p>Hai</p><p>đoạn</p>");
  });

  it("nguồn LaTeX có ký tự đặc biệt được escape trong thuộc tính", () => {
    expect(plainToRichHtml('$\\text{"a"}&b$')).toContain('data-latex="\\text{&quot;a&quot;}&amp;b"');
  });

  it("giá trị đã là HTML thì trả nguyên", () => {
    expect(plainToRichHtml("<p>$x$</p>")).toBe("<p>$x$</p>");
  });
});
