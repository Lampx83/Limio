import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import WritingFeedbackView, { type WritingFeedbackBody } from "./WritingFeedbackView";

const body: WritingFeedbackBody = {
  summary: "Bài ngắn, đúng ý.",
  criteria: [
    { key: "task", level: "good", comment: "Đủ ý." },
    { key: "grammar", level: "needs_work", comment: "Hoà hợp chủ vị." },
  ],
  errors: [{ id: "e1", category: "grammar", quote: "The weather are nice", correction: "The weather is nice", explanation: "weather không đếm được." }],
  nextSteps: ["Ôn hoà hợp chủ vị."],
};
const text = (h: string) => h.replace(/<[^>]+>/g, "");

describe("WritingFeedbackView", () => {
  it("G6c.2: bản chưa duyệt hiện nhãn rõ 'Chưa được giảng viên duyệt' và cảnh báo AI có thể sai", () => {
    const t = text(renderToStaticMarkup(<WritingFeedbackView body={body} review="unreviewed" />));
    expect(t).toContain("Chưa được giảng viên duyệt");
    expect(t).toMatch(/AI|có thể sai/);
  });
  it("bản đã duyệt: nhãn 'Giảng viên đã duyệt', không còn nhãn chưa duyệt, hiện ghi chú của giảng viên", () => {
    const t = text(renderToStaticMarkup(<WritingFeedbackView body={body} review="approved" reviewerNote="Chú ý chia động từ." />));
    expect(t).toContain("Giảng viên đã duyệt");
    expect(t).not.toContain("Chưa được giảng viên duyệt");
    expect(t).toContain("Chú ý chia động từ.");
  });
  it("hiện từng lỗi: trích đoạn → bản sửa → giải thích, nhãn danh mục tiếng Việt, ba mức tiêu chí (không số điểm)", () => {
    const t = text(renderToStaticMarkup(<WritingFeedbackView body={body} review="approved" />));
    for (const s of ["The weather are nice", "The weather is nice", "weather không đếm được.", "Ngữ pháp", "Cần cải thiện", "Tốt", "Ôn hoà hợp chủ vị."]) {
      expect(t).toContain(s);
    }
    expect(t).not.toMatch(/\d+\s*\/\s*\d+|điểm số/i);
  });
  it("chữ do AI/giảng viên là text thuần: thẻ HTML hiện nguyên chữ, không thành phần tử", () => {
    const evil: WritingFeedbackBody = { ...body, summary: "<img src=x onerror=alert(1)>", errors: [{ ...body.errors[0]!, quote: "<script>x</script>" }] };
    const out = renderToStaticMarkup(<WritingFeedbackView body={evil} review="unreviewed" />);
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<script");
    expect(out).toContain("&lt;img");
  });
  it("không có lỗi nào: nói rõ không tìm thấy lỗi cần sửa (không để trống khó hiểu)", () => {
    const t = text(renderToStaticMarkup(<WritingFeedbackView body={{ ...body, errors: [] }} review="approved" />));
    expect(t).toMatch(/không (tìm )?thấy lỗi/i);
  });
});
