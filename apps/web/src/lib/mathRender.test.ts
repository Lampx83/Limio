// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hasMath, renderMath } from "./mathRender";

describe("công thức toán", () => {
  it("bài không có công thức thì trả nguyên, không tải KaTeX", async () => {
    const html = "<p>Không có gì</p>";
    expect(hasMath(html)).toBe(false);
    expect(await renderMath(html)).toBe(html);
  });

  it("dựng span data-latex thành công thức KaTeX, giữ chữ nguồn trong thẻ MathML", async () => {
    const out = await renderMath('<p>Ta có <span class="math-inline" data-latex="x^2-5x+6=0">x^2-5x+6=0</span>.</p>');
    expect(out).toContain('class="katex"');
    expect(out).toContain('data-math-rendered="1"');
    expect(out).toContain("<annotation");
    expect(out).toContain("x^2-5x+6=0"); // annotation giữ nguồn cho trình đọc màn hình / sao chép
  });

  it("math-block dựng ở chế độ display", async () => {
    const out = await renderMath('<div class="math-block" data-latex="\\frac{a}{b}">\\frac{a}{b}</div>');
    expect(out).toContain("katex-display");
    expect(out).toContain("mfrac");
  });

  it("LaTeX hỏng không làm vỡ trang: hiện lỗi dạng chữ, không ném", async () => {
    const out = await renderMath('<span class="math-inline" data-latex="\\frac{">\\frac{</span>');
    expect(out).toContain("katex-error");
  });

  it("không cho lệnh nguy hiểm (\\href / \\url) chạy: trust=false", async () => {
    const out = await renderMath('<span class="math-inline" data-latex="\\href{javascript:alert(1)}{x}">x</span>');
    // Nguồn vẫn nằm trong thuộc tính data-latex và <annotation>, nhưng không thành liên kết bấm được.
    expect(out).not.toMatch(/<a[\s>]/);
    expect(out).not.toMatch(/\shref=/);
  });
});
