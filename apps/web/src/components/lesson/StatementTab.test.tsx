import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/SafeHtml", () => ({
  default: ({ html, className }: { html: string; className?: string }) => <div className={className} dangerouslySetInnerHTML={{ __html: html }} />,
}));

import StatementTab from "./StatementTab";

/** docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md — AC6: tab chỉ có câu yêu cầu cùng khuôn với khối đề bài của bài luyện (tiêu đề + câu yêu cầu). */
describe("StatementTab", () => {
  it("có tiêu đề là số exercise, rồi câu yêu cầu; cùng dấu hiệu data-testid với khối đề bài của bài luyện", () => {
    const html = renderToStaticMarkup(<StatementTab code="7A" html="<p>Can you think of any reasons?</p>" />);
    expect(html).toContain('data-testid="lp-instruction"');
    expect(html).toMatch(/<h3[^>]*>7A<\/h3>/);
    expect(html.indexOf("7A")).toBeLessThan(html.indexOf("Can you think of any reasons?"));
  });

  it("giữ danh sách đi kèm câu yêu cầu", () => {
    const html = renderToStaticMarkup(<StatementTab code="8B" html="<p>Write your listicle.</p><ol><li>one</li></ol>" />);
    expect(html).toContain("<li>one</li>");
  });
});
