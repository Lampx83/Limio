import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DialogueTimingPanel from "./DialogueTimingPanel";
import type { TurnEditorItem } from "@/lib/langBlockEditor";

const turn = (id: string, speaker: string, text: string, startSec?: number): TurnEditorItem => ({
  id, speaker, text, reading: "", translation: "", audioUrl: "", ...(startSec === undefined ? {} : { startSec }),
});
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const render = (turns: TurnEditorItem[]) =>
  renderToStaticMarkup(<DialogueTimingPanel audioUrl="/api/lesson-media/audio/a.mp3" turns={turns} onTurns={() => undefined} />);

describe("DialogueTimingPanel (K2c)", () => {
  it("K2c.1: nút 'Đánh dấu lượt kế' kèm phím M, và luôn nói rõ sắp đánh dấu lượt nào", () => {
    const t = text(render([turn("1", "A", "你好！今天怎么样？"), turn("2", "B", "很好。")]));
    expect(t).toContain("Đánh dấu lượt kế");
    expect(t).toMatch(/phím\s*M/i);
    expect(t).toContain("Sắp đánh dấu: lượt 1");
    expect(t).toContain("A");
    expect(t).toContain("你好！");
  });
  it("sau khi đã có mốc đầu: sắp đánh dấu lượt kế; hiện mốc dạng m:ss,d", () => {
    const html = render([turn("1", "A", "xin chào", 2.5), turn("2", "B", "chào bạn")]);
    expect(text(html)).toContain("Sắp đánh dấu: lượt 2");
    expect(html).toContain('value="0:02,5"');
  });
  it("đủ mốc: nói đã đánh dấu hết, nút đánh dấu bị khoá", () => {
    const html = render([turn("1", "A", "x", 1), turn("2", "B", "y", 4)]);
    expect(text(html)).toContain("Đã đánh dấu hết");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*(<[^>]+>\s*)*Đánh dấu lượt kế/);
  });
  it("K2c.2: có Hoàn tác, Xoá hết mốc, Nghe từ mốc này", () => {
    const t = text(render([turn("1", "A", "x", 1), turn("2", "B", "y")]));
    for (const s of ["Hoàn tác", "Xoá hết mốc", "Nghe từ mốc này"]) expect(t).toContain(s);
  });
  it("K2a.3: mốc không còn tăng dần (do đổi thứ tự) → báo ngay, nêu số lượt", () => {
    const t = text(render([turn("1", "A", "x", 9), turn("2", "B", "y", 2)]));
    expect(t).toMatch(/Lượt 2 bắt đầu trước lượt 1/);
  });
  it("lượt trống (chưa điền người nói/lời) bị bỏ qua khi đếm lượt", () => {
    const t = text(render([turn("1", "A", "x"), turn("2", "", "")]));
    expect(t).toContain("Sắp đánh dấu: lượt 1");
    expect(t).not.toContain("lượt 2");
  });
  it("không có lượt nào đủ nội dung: nhắc điền lượt trước", () => {
    expect(text(render([turn("1", "", "")]))).toMatch(/điền.*lượt/i);
  });
});
