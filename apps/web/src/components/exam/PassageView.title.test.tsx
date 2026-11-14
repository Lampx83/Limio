import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// PassageView kéo trình phát audio (dùng API): thay bằng khung rỗng, chỉ kiểm tiêu đề.
vi.mock("./ExamAudioPlayer", () => ({ default: () => null, ExamAudioContext: { Provider: ({ children }: { children: React.ReactNode }) => <>{children}</> } }));

import PassageView from "./PassageView";

const passage = (title: string) => ({ id: "p1", title, contentJson: { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: "Nội dung." }] }] } });

describe("PassageView — tiêu đề", () => {
  it("có tiêu đề: vẽ tiêu đề và đúng MỘT vạch nhấn bên dưới", () => {
    const html = renderToStaticMarkup(<PassageView passage={passage("Bài đọc")} attemptId="a" />);
    expect(html).toContain("Bài đọc");
    expect(html.match(/bg-brand-gradient/g)).toHaveLength(1);
  });
  it("tiêu đề rỗng hoặc chỉ khoảng trắng (phiếu bài tập đã có tên bài ở trên): không vẽ tiêu đề và không để lại vạch nhấn mồ côi", () => {
    for (const title of ["", "   "]) {
      const html = renderToStaticMarkup(<PassageView passage={passage(title)} attemptId="a" />);
      expect(html, JSON.stringify(title)).not.toContain("bg-brand-gradient");
      expect(html).not.toContain("<h2");
      expect(html).toContain("Nội dung.");
    }
  });
});
