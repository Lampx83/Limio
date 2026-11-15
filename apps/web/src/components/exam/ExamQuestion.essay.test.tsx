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
