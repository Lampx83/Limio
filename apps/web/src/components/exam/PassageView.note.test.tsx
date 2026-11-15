import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PassageView from "./PassageView";

/** docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md — AC2/AC4: mặc định giữ nguyên, chỉ bài luyện nhúng tắt ghi chú và tiêu đề. */
const passage = {
  id: "p1",
  title: "7B · Multi-word verbs",
  contentJson: { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: "Nội dung." }] }] },
};

describe("PassageView — ghi chú cá nhân và tiêu đề", () => {
  it("mặc định (phòng thi, luyện đề): có tiêu đề và ô ghi chú cá nhân", () => {
    const html = renderToStaticMarkup(<PassageView passage={passage} attemptId="a" />);
    expect(html).toContain("7B · Multi-word verbs");
    expect(html).toContain("Ghi chú cá nhân");
  });

  it("hideNote: không có ô ghi chú; hideTitle: không lặp tiêu đề; nội dung vẫn còn", () => {
    const html = renderToStaticMarkup(<PassageView passage={passage} attemptId="a" hideNote hideTitle />);
    expect(html).not.toContain("Ghi chú cá nhân");
    expect(html).not.toContain("7B · Multi-word verbs");
    expect(html).toContain("Nội dung.");
  });
});

describe("PassageView — chữ in đậm của sách (từ vựng mục tiêu) được bôi màu trong bài luyện nhúng", () => {
  const bold = {
    id: "p2",
    title: "1A · Lifestyle questions",
    contentJson: {
      type: "doc" as const,
      content: [{ type: "paragraph", content: [{ type: "text", text: "I'm an " }, { type: "text", text: "early bird", marks: [{ type: "bold" }] }, { type: "text", text: "." }] }],
    },
  };
  it("emphasizeBold: vùng nội dung có lớp bôi màu cho chữ đậm", () => {
    const html = renderToStaticMarkup(<PassageView passage={bold} attemptId="a" emphasizeBold />);
    expect(html).toContain("pv-hl-bold");
    expect(html).toContain("<strong>early bird</strong>");
  });
  it("mặc định (phòng thi, luyện đề): không đổi", () => {
    expect(renderToStaticMarkup(<PassageView passage={bold} attemptId="a" />)).not.toContain("pv-hl-bold");
  });
});
