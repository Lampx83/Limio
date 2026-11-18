// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRACTICE_COMPLETE_EVENT } from "@/lib/practiceTabMeta";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import NextLessonLink from "./NextLessonLink";
import { AiOpenButton, LessonFrameActionsProvider } from "./LessonFrameContext";

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
const link = () => host.querySelector("a")!;
const fire = (done: boolean) => act(async () => void window.dispatchEvent(new CustomEvent(PRACTICE_COMPLETE_EVENT, { detail: { done } })));

describe("NextLessonLink — mức nhấn theo tiến độ bài luyện", () => {
  it("quiet ban đầu là nút viền; khi khu bài luyện báo đã kiểm hết thì thành nút đặc ngay, và ngược lại", async () => {
    await act(async () => root.render(<NextLessonLink href="/n" headline="Bài tiếp theo" sub="Bài khoá 2" quiet />));
    expect(link().getAttribute("data-tone")).toBe("quiet");
    await fire(true);
    expect(link().getAttribute("data-tone")).toBe("primary");
    await fire(false);
    expect(link().getAttribute("data-tone")).toBe("quiet");
  });
  it("hai dòng: dòng trên là việc/chủ đề kế, dòng dưới là tên bài", async () => {
    await act(async () => root.render(<NextLessonLink href="/n" headline="Chủ đề 2" sub="Khởi động" quiet={false} />));
    expect(link().textContent).toBe("Chủ đề 2 →Khởi động");
    expect(link().getAttribute("href")).toBe("/n");
  });
});

describe("AiOpenButton — nút AI ở thanh đáy", () => {
  it("trong khung bài: bấm gọi mở panel; chỉ hiện dưới lg", async () => {
    const openPanel = vi.fn();
    await act(async () => root.render(<LessonFrameActionsProvider value={{ openPanel }}><AiOpenButton /></LessonFrameActionsProvider>));
    const b = host.querySelector<HTMLButtonElement>('[data-testid="bar-ai-button"]')!;
    expect(b.className).toContain("lg:hidden");
    await act(async () => void b.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(openPanel).toHaveBeenCalledTimes(1);
  });
  it("ngoài khung bài: không hiện gì", async () => {
    await act(async () => root.render(<AiOpenButton />));
    expect(host.querySelector('[data-testid="bar-ai-button"]')).toBeNull();
  });
});
