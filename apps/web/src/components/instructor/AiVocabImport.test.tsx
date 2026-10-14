import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AiVocabItem } from "@/lib/aiVocabImport";
import AiVocabPreview from "./AiVocabPreview";
import AiVocabImportPanel from "./AiVocabImportPanel";

/**
 * LANG G2.5 / G2.5.4 — khung "Nhập bằng AI" trong bộ soạn từ vựng: ô dán, tuỳ chọn điền
 * phần còn thiếu, và bản xem trước để chọn dòng.
 */

const text = (out: string) => out.replace(/<[^>]+>/g, "");
const noop = () => {};

const items: AiVocabItem[] = [
  { term: "你好", reading: "nǐ hǎo", meaning: "xin chào", filled: [] },
  { term: "谢谢", reading: "xièxie", meaning: "cảm ơn", filled: ["reading", "meaning"] },
  { term: "再见", meaning: "tạm biệt", filled: [] },
];

const preview = (over: Partial<React.ComponentProps<typeof AiVocabPreview>> = {}) =>
  renderToStaticMarkup(
    <AiVocabPreview
      items={items}
      skipped={[{ reason: "Thiếu nghĩa", term: "朋友" }, { reason: "Trùng từ", term: "你好" }]}
      selected={new Set([0, 1, 2])}
      onToggle={noop}
      onSelectAll={noop}
      onSelectNone={noop}
      onAdd={noop}
      {...over}
    />,
  );

describe("AiVocabPreview — G2.5.4.2", () => {
  it("đếm số dòng nhận được và số dòng bị bỏ qua", () => {
    const t = text(preview());
    expect(t).toContain("3 dòng");
    expect(t).toContain("2 dòng bị bỏ qua");
  });

  it("mỗi dòng có hộp chọn đặt tên theo từ; mặc định chọn hết; bỏ chọn thì bỏ thuộc tính checked", () => {
    const all = preview();
    for (const it of items) expect(all).toContain(`aria-label="Chọn từ ${it.term}"`);
    expect([...all.matchAll(/<input[^>]*type="checkbox"[^>]*checked=""/g)]).toHaveLength(3);
    const two = preview({ selected: new Set([0, 2]) });
    expect([...two.matchAll(/<input[^>]*type="checkbox"[^>]*checked=""/g)]).toHaveLength(2);
  });

  it("hiện từ, phiên âm, nghĩa của từng dòng", () => {
    const t = text(preview());
    for (const s of ["你好", "nǐ hǎo", "xin chào", "谢谢", "xièxie", "cảm ơn", "再见", "tạm biệt"]) expect(t).toContain(s);
  });

  it("dòng có trường do AI điền được đánh dấu rõ kèm tên trường; dòng không có thì không", () => {
    const out = preview();
    expect(text(out)).toContain("AI điền: phiên âm, nghĩa");
    expect(text(out)).toContain("hãy kiểm tra");
    expect([...text(out).matchAll(/AI điền/g)]).toHaveLength(1);
  });

  it("liệt kê dòng bị bỏ qua kèm lý do và từ", () => {
    const t = text(preview());
    expect(t).toContain("Thiếu nghĩa");
    expect(t).toContain("朋友");
    expect(t).toContain("Trùng từ");
  });

  it("nút thêm ghi đúng số dòng đã chọn và bị khoá khi không chọn dòng nào", () => {
    expect(text(preview())).toContain("Thêm 3 dòng đã chọn");
    expect(text(preview({ selected: new Set([1]) }))).toContain("Thêm 1 dòng đã chọn");
    const none = preview({ selected: new Set() });
    expect(none).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Thêm 0 dòng/);
  });

  it("có nút chọn tất cả / bỏ chọn tất cả", () => {
    const t = text(preview());
    expect(t).toContain("Chọn tất cả");
    expect(t).toContain("Bỏ chọn tất cả");
  });

  it("không có dòng nào: báo rõ và không hiện nút thêm", () => {
    const out = preview({ items: [], selected: new Set(), skipped: [] });
    expect(text(out)).toContain("Không tìm thấy từ vựng nào");
    expect(text(out)).not.toContain("Thêm 0 dòng");
  });

  it("chữ do AI trả về hiện nguyên là chữ, không thành phần tử HTML", () => {
    const out = preview({ items: [{ term: "<img src=x onerror=alert(1)>", meaning: "<b>đậm</b>", filled: [] }], selected: new Set([0]) });
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<b>");
  });
});

describe("AiVocabImportPanel — G2.5.4.1", () => {
  const render = () => renderToStaticMarkup(<AiVocabImportPanel onAdd={noop} />);

  it("có ô dán, tuỳ chọn điền phần còn thiếu (tắt mặc định) và nút Phân tích bằng AI", () => {
    const out = render();
    expect(out).toContain('aria-label="Dán văn bản từ vựng"');
    expect(text(out)).toContain("Điền phiên âm và nghĩa còn thiếu");
    expect(out).toMatch(/<input[^>]*type="checkbox"(?![^>]*checked)/);
    expect(text(out)).toContain("Phân tích bằng AI");
  });

  it("nút Phân tích bị khoá khi ô dán còn trống", () => {
    expect(render()).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Phân tích bằng AI/);
  });

  it("nói rõ văn bản dán sẽ được gửi tới dịch vụ AI, và AI không tự lưu", () => {
    const t = text(render());
    expect(t).toContain("OpenAI");
    expect(t).toMatch(/xem trước|kiểm tra/i);
  });
});
