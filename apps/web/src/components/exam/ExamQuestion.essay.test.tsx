// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/SafeHtml", () => ({
  default: ({ html, className }: { html: string; className?: string }) => <span className={className} dangerouslySetInnerHTML={{ __html: html }} />,
}));

import ExamQuestion from "./ExamQuestion";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Ô viết của câu tự luận ở chế độ gọn không bao giờ bị ép thấp hơn 3 dòng, kể cả khi dựng trong tab đang ẩn (scrollHeight = 0). */
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("EssayInput gọn — chiều cao tối thiểu", () => {
  it("dựng trong vùng đang ẩn (scrollHeight 0): chiều cao vẫn từ 3 dòng trở lên, không co về 0", async () => {
    host.hidden = true;
    await act(async () => {
      root.render(<ExamQuestion question={{ id: "q1", type: "essay", prompt: "Đề", points: 1, config: {} }} value={null} onChange={() => {}} compact />);
    });
    const ta = host.querySelector("textarea")!;
    expect(parseInt(ta.style.height, 10)).toBeGreaterThanOrEqual(72);
  });
});

describe("câu tự luận có một chỗ trống trong đề — gõ thẳng vào chỗ trống", () => {
  const q = (prompt: string) => ({ id: "q2", type: "essay", prompt, points: 1, config: {} });
  it("phiếu bài tập (gọn): có ô gõ tại chỗ trống, không có ô soạn thảo riêng; gõ thì đáp án là chữ điền vào", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<ExamQuestion question={q("你______，好好休息一下吧。")} value={{ text: "看上去很累" }} onChange={onChange} compact />);
    });
    expect(host.querySelector("textarea")).toBeNull();
    const input = host.querySelector<HTMLInputElement>('[data-testid="inline-blank"] input')!;
    expect(input.value).toBe("看上去很累");
    expect(host.querySelector('[data-testid="inline-blank"]')!.textContent).toBe("你，好好休息一下吧。"); // chữ đề giữ nguyên, ô nằm giữa
  });
  it("không gọn (đề thi) hoặc nhiều chỗ trống: vẫn là ô soạn thảo", async () => {
    await act(async () => {
      root.render(<ExamQuestion question={q("你______，好好休息一下吧。")} value={null} onChange={() => {}} />);
    });
    expect(host.querySelector("textarea")).not.toBeNull();
    expect(host.querySelector('[data-testid="inline-blank"]')).toBeNull();
    await act(async () => {
      root.render(<ExamQuestion question={q("A ______ B ______ C")} value={null} onChange={() => {}} compact />);
    });
    expect(host.querySelector("textarea")).not.toBeNull();
  });
});
