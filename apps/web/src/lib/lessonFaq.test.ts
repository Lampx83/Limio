// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildFaqDetails } from "./lessonFaq";

const text = (html: string) => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent;
};

describe("Hỏi và đáp ở trang học viên", () => {
  const faq =
    '<section class="lesson-section" data-layout="faq"><h2>Câu hỏi thường gặp</h2>' +
    '<div class="lesson-part"><h3>Câu <strong>một</strong>?</h3><p>Trả lời một.</p></div>' +
    '<div class="lesson-part"><h3>Câu hai?</h3><p>Trả lời hai.</p><ul><li>Ý phụ</li></ul></div>' +
    "</section>";

  it("mỗi phần thành <details>, câu hỏi thành <summary>, câu đầu mở sẵn", () => {
    const out = buildFaqDetails(faq);
    expect(out).toContain('<details class="lesson-part" open=""><summary>Câu <strong>một</strong>?</summary><p>Trả lời một.</p></details>');
    expect(out).toContain('<details class="lesson-part"><summary>Câu hai?</summary><p>Trả lời hai.</p><ul><li>Ý phụ</li></ul></details>');
  });

  it("chữ giữ nguyên thứ tự — ghi chú của học viên neo theo chữ không bị lệch", () => {
    expect(text(buildFaqDetails(faq))).toBe(text(faq));
  });

  it("không đụng tới mục có bố cục khác", () => {
    const cards = faq.replace('data-layout="faq"', 'data-layout="cards"');
    expect(buildFaqDetails(cards)).toBe(cards);
  });
});
