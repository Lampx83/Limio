import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SpeakingFeedbackView from "./SpeakingFeedbackView";
import type { WritingFeedbackBody } from "./WritingFeedbackView";

const body: WritingFeedbackBody = {
  summary: "Giới thiệu rõ ràng.",
  criteria: [
    { key: "task", level: "good", comment: "Đủ ý." },
    { key: "language", level: "fair", comment: "Còn lỗi cấu trúc." },
    { key: "fluency", level: "fair", comment: "Đo từ bản ghi: tốc độ nói vừa phải, ít khi ngừng lâu." },
    { key: "coherence", level: "fair", comment: "Ý nối tạm ổn." },
  ],
  errors: [{ id: "e1", category: "grammar", quote: "I like read books", correction: "I like reading books", explanation: "like + V-ing." }],
  nextSteps: ["Luyện like + V-ing."],
};
const text = (h: string) => h.replace(/<[^>]+>/g, "");

describe("SpeakingFeedbackView", () => {
  it("G7c.1: luôn có ghi chú giới hạn phát âm — cả bản chưa duyệt lẫn đã duyệt", () => {
    for (const review of ["unreviewed", "approved"] as const) {
      const t = text(renderToStaticMarkup(<SpeakingFeedbackView body={body} review={review} transcript="Hello" />));
      expect(t).toMatch(/không chấm được phát âm/i);
      expect(t).toMatch(/giảng viên nghe/i);
    }
  });
  it("G7c.2: hiện bản chữ máy nghe được kèm nhãn 'có thể nghe sai'", () => {
    const t = text(renderToStaticMarkup(<SpeakingFeedbackView body={body} review="unreviewed" transcript="Hello my name is Anna." />));
    expect(t).toContain("Hello my name is Anna.");
    expect(t).toMatch(/có thể nghe sai/i);
  });
  it("tiêu chí bài nói có nhãn tiếng Việt; Lưu loát ghi là do đo từ bản ghi; không có số điểm/phát âm", () => {
    const t = text(renderToStaticMarkup(<SpeakingFeedbackView body={body} review="approved" transcript="x" />));
    for (const s of ["Hoàn thành yêu cầu", "Từ vựng và ngữ pháp", "Lưu loát", "Mạch lạc", "I like reading books"]) {
      expect(t).toContain(s);
    }
    expect(t).not.toMatch(/\d+\s*\/\s*\d+|điểm số|từ\/phút/i);
    expect(t).not.toMatch(/tiêu chí phát âm|Phát âm:/i);
  });
  it("bản chữ là text thuần (thẻ HTML hiện nguyên chữ), giữ nhãn chưa duyệt của bản nháp", () => {
    const out = renderToStaticMarkup(<SpeakingFeedbackView body={body} review="unreviewed" transcript={"<img src=x onerror=alert(1)>"} />);
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(text(out)).toContain("Chưa được giảng viên duyệt");
  });
});
