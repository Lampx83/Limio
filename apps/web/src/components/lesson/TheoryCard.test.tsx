import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/SafeHtml", () => ({
  default: ({ html, className }: { html: string; className?: string }) => <div className={className} dangerouslySetInnerHTML={{ __html: html }} />,
}));

import TheoryCard from "./TheoryCard";

/** docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md — AC8: phần lý thuyết là MỘT thẻ. */
describe("TheoryCard", () => {
  it("chữ và bài đọc nằm trong cùng một thẻ: chỉ một khung viền ngoài, không thẻ con có viền", () => {
    const html = renderToStaticMarkup(
      <TheoryCard html="<h2>READING</h2><p>Read the article.</p>">
        <section>Bài đọc dài</section>
      </TheoryCard>,
    );
    expect(html).toContain("READING");
    expect(html).toContain("Read the article.");
    expect(html).toContain("Bài đọc dài");
    // một thẻ ngoài duy nhất; khối chữ bên trong bị gỡ viền/bo/nền/đệm của thẻ riêng
    expect(html.match(/data-testid="lesson-theory"/g)).toHaveLength(1);
    expect(html).toContain("!border-0");
    expect(html).toContain("!p-0");
  });

  it("không có bài đọc đi kèm: không có vạch ngăn thừa", () => {
    const html = renderToStaticMarkup(<TheoryCard html="<p>Chỉ chữ.</p>" />);
    expect(html).not.toContain("pt-6");
    expect(html).toContain("Chỉ chữ.");
  });

  it("đầu thẻ gọn: khoảng cách trên của banner và đoạn chữ bị rút (đè lề inline 2rem của banner), đệm thẻ nhỏ", () => {
    const html = renderToStaticMarkup(<TheoryCard html="<p>Student’s Book · page 8</p><h2>READING</h2>" />);
    expect(html).toContain("[&amp;_h2]:!mt-2");
    expect(html).toContain("[&amp;_p]:!mt-1");
    expect(html).toContain("p-4 sm:p-5");
  });

  it("có dòng tên bài: nằm ở ĐẦU thẻ, trước nội dung, ngăn bằng một đường kẻ; vẫn chỉ một thẻ", () => {
    const html = renderToStaticMarkup(<TheoryCard title={<h1>1.1 Reading · The world&apos;s favourite drug</h1>} html="<h2>READING</h2>" />);
    expect(html.indexOf("1.1 Reading")).toBeGreaterThan(-1);
    expect(html.indexOf("1.1 Reading")).toBeLessThan(html.indexOf("READING"));
    expect(html.match(/data-testid="lesson-theory"/g)).toHaveLength(1);
    expect(html).toContain("border-b border-token");
  });
});
