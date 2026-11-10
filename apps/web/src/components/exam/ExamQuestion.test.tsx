import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
// SafeHtml làm sạch HTML ở trình duyệt (SSR không ra chữ); thay bằng bản chèn thẳng để kiểm chữ hiển thị.
vi.mock("@/components/SafeHtml", () => ({
  default: ({ html, className }: { html: string; className?: string }) => <span className={className} dangerouslySetInnerHTML={{ __html: html }} />,
}));

import ExamQuestion, { isAnswerValueAnswered, type AnswerValue } from "./ExamQuestion";
import AnswerReview from "./AnswerReview";
import { publicToken } from "@feedbackme/core-lms";

// docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md — mục C: Sắp xếp, Ghép cặp, Kéo thả điền, Số làm được trong đề thi.

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const render = (type: string, config: Record<string, unknown>, value: AnswerValue = null, prompt = "Đề câu hỏi") =>
  renderToStaticMarkup(<ExamQuestion question={{ id: "q1", type, prompt, points: 1, config }} value={value} onChange={() => {}} />);

describe("ExamQuestion — loại câu mới", () => {
  it("ordering: vẽ các thẻ theo thứ tự máy chủ gửi (đã xáo), không còn dòng báo chưa hỗ trợ", () => {
    const html = render("ordering", { items: [{ id: "t2", label: "Bước hai" }, { id: "t1", label: "Bước một" }] });
    expect(html).not.toContain("Unsupported");
    expect(html).not.toContain("chưa hiển thị được");
    expect(text(html).indexOf("Bước hai")).toBeGreaterThan(-1);
    expect(text(html).indexOf("Bước hai")).toBeLessThan(text(html).indexOf("Bước một"));
  });

  it("ordering: đã có thứ tự lưu thì hiện theo thứ tự đã xếp", () => {
    const html = render(
      "ordering",
      { items: [{ id: "t2", label: "Bước hai" }, { id: "t1", label: "Bước một" }] },
      { order: ["t1", "t2"] },
    );
    expect(text(html).indexOf("Bước một")).toBeLessThan(text(html).indexOf("Bước hai"));
  });

  it("matching: vẽ vế trái và các thẻ vế phải; ghép đã lưu hiện đúng ô", () => {
    const config = {
      lefts: [{ id: "p1", label: "Mèo" }, { id: "p2", label: "Chó" }],
      rights: [{ id: "tA", label: "Kêu meo" }, { id: "tB", label: "Sủa gâu" }],
    };
    const html = render("matching", config);
    expect(html).not.toContain("Unsupported");
    for (const w of ["Mèo", "Chó", "Kêu meo", "Sủa gâu"]) expect(text(html)).toContain(w);
    // Có ghép sẵn p1 → tA: điện thoại hiện ô chọn đã chọn đúng phương án.
    const withValue = render("matching", config, { matched: { p1: "tA" } });
    expect(withValue).toMatch(/<option value="tA" selected/);
  });

  it("drag_drop_fill: đề có [[N]] vẽ thành ô thả, không in ký hiệu thô; token xuống danh sách chờ", () => {
    const html = render(
      "drag_drop_fill",
      { tokens: [{ id: "k1", label: "went" }, { id: "k2", label: "mồi nhử" }] },
      null,
      "I [[1]] to school.",
    );
    expect(html).not.toContain("Unsupported");
    expect(html).not.toContain("[[1]]");
    expect(text(html)).toContain("Ô 1");
    expect(text(html)).toContain("went");
    expect(text(html)).toContain("mồi nhử");
  });

  it("drag_drop_fill: đề là HTML từ trình soạn vẫn nhận ra ô [[N]]", () => {
    const html = render("drag_drop_fill", { tokens: [{ id: "k1", label: "went" }] }, null, "<p>I [[1]] to school.</p>");
    expect(text(html)).toContain("Ô 1");
  });

  it("drag_drop_fill: token đã đặt vào ô thì không còn ở danh sách chờ (hiện trong ô)", () => {
    const html = render("drag_drop_fill", { tokens: [{ id: "k1", label: "went" }] }, { placed: { "1": "k1" } }, "I [[1]] there.");
    expect(html).toContain("Bỏ chọn token này");
    expect(text(html)).toContain("Đã đặt hết token");
  });

  it("numerical: ô nhập số, hiện giá trị đã nhập", () => {
    const html = render("numerical", {}, { value: "3.14" });
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('value="3.14"');
  });

  it("loại lạ: câu tiếng Việt cho học viên, không phải dòng tiếng Anh", () => {
    const html = render("matching_heading", {});
    expect(text(html)).toContain("Câu này chưa hiển thị được. Báo giảng viên.");
  });
});

describe("isAnswerValueAnswered", () => {
  it("mọi dạng đáp án: rỗng là chưa trả lời, có nội dung là đã trả lời", () => {
    expect(isAnswerValueAnswered(null)).toBe(false);
    expect(isAnswerValueAnswered({ optionIds: [] })).toBe(false);
    expect(isAnswerValueAnswered({ optionIds: ["a"] })).toBe(true);
    expect(isAnswerValueAnswered({ order: [] })).toBe(false);
    expect(isAnswerValueAnswered({ order: ["a", "b"] })).toBe(true);
    expect(isAnswerValueAnswered({ matched: {} })).toBe(false);
    expect(isAnswerValueAnswered({ matched: { p1: "" } })).toBe(false);
    expect(isAnswerValueAnswered({ matched: { p1: "tA" } })).toBe(true);
    expect(isAnswerValueAnswered({ placed: {} })).toBe(false);
    expect(isAnswerValueAnswered({ placed: { "1": "k1" } })).toBe(true);
    expect(isAnswerValueAnswered({ value: "  " })).toBe(false);
    expect(isAnswerValueAnswered({ value: "0" })).toBe(true);
    expect(isAnswerValueAnswered({ value: 0 })).toBe(true);
    expect(isAnswerValueAnswered({ value: Number.NaN })).toBe(false);
  });
});

describe("AnswerReview — xem lại 4 loại câu (đáp án học viên là mã công khai)", () => {
  const review = (type: string, config: unknown, answerJson: unknown, prompt = "Đề") =>
    text(
      renderToStaticMarkup(
        <AnswerReview
          questions={[
            {
              id: "q1", orderInExam: 1, type, prompt, points: 1, config, explanation: null,
              answer: { answerJson, score: 0, needsGrading: false, comment: null },
            } as never,
          ]}
        />,
      ),
    );

  it("ordering: hiện thứ tự đúng và thứ tự học viên xếp, đổi mã công khai về mã gốc", () => {
    const items = [{ id: "i1", label: "Một" }, { id: "i2", label: "Hai" }, { id: "i3", label: "Ba" }];
    const cfg = { items, reviewTokens: Object.fromEntries(items.map((i) => [i.id, publicToken(i.id)])) };
    const out = review("ordering", cfg, { order: [publicToken("i2"), publicToken("i1"), publicToken("i3")] });
    expect(out).toContain("Thứ tự đúng");
    expect(out).toContain("Bạn xếp");
    expect(out).toContain("✗"); // hai vị trí đầu sai
    expect(out).toContain("✓"); // vị trí cuối đúng
  });

  it("matching: dòng ghép đúng và dòng ghép sai kèm 'Bạn chọn'", () => {
    const pairs = [{ id: "p1", left: "Mèo", right: "Meo" }, { id: "p2", left: "Chó", right: "Gâu" }];
    const cfg = { pairs, reviewTokens: Object.fromEntries(pairs.map((p) => [p.id, publicToken(p.id)])) };
    const out = review("matching", cfg, { matched: { p1: publicToken("p1"), p2: publicToken("p1") } });
    expect(out).toContain("Mèo → Meo");
    expect(out).toContain("Bạn chọn: Meo");
  });

  it("drag_drop_fill: từng ô đúng/sai và token học viên đặt", () => {
    const tokens = [{ id: "k1", label: "went", blankIndex: 1 }, { id: "k2", label: "been", blankIndex: 2 }, { id: "k3", label: "mồi", blankIndex: null }];
    const cfg = { tokens, reviewTokens: Object.fromEntries(tokens.map((t) => [t.id, publicToken(t.id)])) };
    const out = review("drag_drop_fill", cfg, { placed: { "1": publicToken("k1"), "2": publicToken("k3") } });
    expect(out).toContain("Ô 1");
    expect(out).toContain("Bạn đặt: mồi");
  });

  it("drag_drop_fill: đề trong phần xem lại đổi [[N]] thành (Ô N)", () => {
    const out = review("drag_drop_fill", { tokens: [{ id: "k1", label: "went", blankIndex: 1 }], reviewTokens: {} }, { placed: { "1": "k1" } }, "I [[1]] home.");
    expect(out).not.toContain("[[");
    expect(out).toContain("I (Ô 1) home.");
  });

  it("numerical: đáp án đúng kèm sai số và số học viên nhập", () => {
    const out = review("numerical", { expected: 42, tolerance: 0.5 }, { value: "41" });
    expect(out).toContain("Đáp án đúng: 42");
    expect(out).toContain("±0.5");
    expect(out).toContain("Bạn nhập: 41");
  });

  it("chưa trả lời: báo chưa trả lời", () => {
    const out = review("ordering", { items: [{ id: "i1", label: "Một" }, { id: "i2", label: "Hai" }] }, null);
    expect(out).toContain("Bạn chưa trả lời câu này.");
  });
});
