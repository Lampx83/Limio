// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("hanzi-writer", () => ({ default: { create: () => ({ animateCharacter: () => undefined, quiz: () => undefined, cancelQuiz: () => undefined }) } }));

import HanziStrokeDialog from "./HanziStrokeDialog";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  // Dữ liệu nét chữ: cho treo vô hạn, để test không phụ thuộc mạng và không sinh lỗi nền.
  vi.stubGlobal("fetch", () => new Promise(() => undefined));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const click = (el: Element) => act(async () => void el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

describe("HanziStrokeDialog — cửa sổ Cách viết", () => {
  it("đầu cửa sổ dính trên cùng và chứa nút đóng (luôn thấy dù cuộn xuống cuối); bấm nút thì đóng", async () => {
    const onClose = vi.fn();
    await act(async () => root.render(<HanziStrokeDialog term="考虑" lang="vi" onClose={onClose} foot={<p style={{ height: 3000 }}>dài</p>} />));
    const head = document.querySelector<HTMLElement>('[data-testid="hanzi-dialog-head"]')!;
    expect(head.className).toContain("sticky");
    expect(head.className).toContain("top-0");
    const close = head.querySelector<HTMLButtonElement>("button")!;
    expect(close.className).toContain("h-10"); // vùng chạm đủ lớn trên điện thoại
    await click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("bấm vùng tối ngoài cửa sổ thì đóng; bấm trong cửa sổ thì không", async () => {
    const onClose = vi.fn();
    await act(async () => root.render(<HanziStrokeDialog term="考" lang="vi" onClose={onClose} />));
    await click(document.querySelector('[role="dialog"]')!);
    expect(onClose).not.toHaveBeenCalled();
    await click(document.querySelector('[data-testid="hanzi-dialog"]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("phím Esc đóng", async () => {
    const onClose = vi.fn();
    await act(async () => root.render(<HanziStrokeDialog term="考" lang="vi" onClose={onClose} />));
    await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(onClose).toHaveBeenCalled();
  });

  it("điện thoại: ngăn kéo từ đáy; khung viết co theo chiều cao màn hình (thấp thì nhỏ, tối thiểu 150, tối đa 240)", async () => {
    const setH = (h: number) => Object.defineProperty(window, "innerHeight", { value: h, configurable: true, writable: true });
    setH(700);
    await act(async () => root.render(<HanziStrokeDialog term="考" lang="vi" onClose={() => undefined} />));
    expect(document.querySelector('[data-testid="hanzi-dialog"]')!.className).toContain("items-end");
    expect(document.querySelector<HTMLElement>('[data-testid="hanzi-box"]')!.style.width).toBe("182px");
    await act(async () => root.render(<div />));
    setH(400);
    await act(async () => root.render(<HanziStrokeDialog term="考" lang="vi" onClose={() => undefined} />));
    expect(document.querySelector<HTMLElement>('[data-testid="hanzi-box"]')!.style.width).toBe("150px");
    await act(async () => root.render(<div />));
    setH(1200);
    await act(async () => root.render(<HanziStrokeDialog term="考" lang="vi" onClose={() => undefined} />));
    expect(document.querySelector<HTMLElement>('[data-testid="hanzi-box"]')!.style.width).toBe("240px");
  });

  it("gắn ra ngoài vùng nội dung bài (nơi cỡ chữ lớn dùng zoom) nhưng vẫn trong .lesson-hsk để giữ style ví dụ", async () => {
    const lesson = document.createElement("div");
    lesson.className = "lesson-hsk";
    const content = document.createElement("div");
    content.id = "lesson-content";
    lesson.appendChild(content);
    document.body.appendChild(lesson);
    const inner = createRoot(content);
    await act(async () => inner.render(<HanziStrokeDialog term="考" lang="vi" onClose={() => undefined} />));
    const dlg = document.querySelector('[data-testid="hanzi-dialog"]')!;
    expect(dlg.parentElement).toBe(lesson);
    expect(content.contains(dlg)).toBe(false);
    await act(async () => inner.unmount());
    lesson.remove();
  });
  it("không có .lesson-hsk thì gắn vào <body>", async () => {
    await act(async () => root.render(<HanziStrokeDialog term="考" lang="vi" onClose={() => undefined} />));
    expect(document.querySelector('[data-testid="hanzi-dialog"]')!.parentElement).toBe(document.body);
  });

  it("cửa sổ cao theo vùng nhìn thấy thật (dvh), không theo vh của thanh địa chỉ", async () => {
    await act(async () => root.render(<HanziStrokeDialog term="考" lang="vi" onClose={() => undefined} />));
    expect((document.querySelector('[data-testid="hanzi-dialog"]') as HTMLElement).style.height).toBe("100dvh");
  });
});
