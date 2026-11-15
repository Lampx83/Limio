// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import PracticeTabs from "./PracticeTabs";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md — AC5. */
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

const tabs = [
  { id: "a", label: "7 · Multi-word verbs", content: <input data-testid="ans-a" defaultValue="" /> },
  { id: "b", label: "8B · Talk with a virtual partner", content: <p>Nội dung B</p> },
];
const render = (t = tabs) => act(async () => root.render(<PracticeTabs tabs={t} />));
const tabEls = () => [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
const panels = () => [...host.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
const click = (el: Element) => act(async () => void el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

describe("PracticeTabs — mỗi khối bài luyện một tab", () => {
  it("nhiều khối: có thanh tab theo tên khối, mở sẵn tab đầu, tab khác ẩn", async () => {
    await render();
    expect(tabEls().map((t) => t.textContent)).toEqual(["7 · Multi-word verbs", "8B · Talk with a virtual partner"]);
    expect(tabEls()[0]!.getAttribute("aria-selected")).toBe("true");
    expect(tabEls()[1]!.getAttribute("aria-selected")).toBe("false");
    expect(panels()[0]!.hidden).toBe(false);
    expect(panels()[1]!.hidden).toBe(true);
    expect(host.querySelector('[role="tablist"]')!.getAttribute("aria-label")).toBe("Bài luyện của bài học");
  });

  it("bấm tab: đổi tab, và nội dung tab cũ vẫn còn trong cây (không mất bài đang làm)", async () => {
    await render();
    const input = host.querySelector<HTMLInputElement>('[data-testid="ans-a"]')!;
    input.value = "đáp án đang gõ";
    await click(tabEls()[1]!);
    expect(tabEls()[1]!.getAttribute("aria-selected")).toBe("true");
    expect(panels()[0]!.hidden).toBe(true);
    expect(panels()[1]!.hidden).toBe(false);
    await click(tabEls()[0]!);
    expect(host.querySelector<HTMLInputElement>('[data-testid="ans-a"]')).toBe(input);
    expect(input.value).toBe("đáp án đang gõ");
  });

  it("mũi tên trái/phải chuyển tab", async () => {
    await render();
    await act(async () => void tabEls()[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(tabEls()[1]!.getAttribute("aria-selected")).toBe("true");
    await act(async () => void tabEls()[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(tabEls()[0]!.getAttribute("aria-selected")).toBe("true");
  });

  it("chỉ một khối: không có thanh tab, nội dung hiện thẳng", async () => {
    await render([tabs[1]!]);
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(host.textContent).toContain("Nội dung B");
  });

  it("không có khối: không vẽ gì", async () => {
    await render([]);
    expect(host.innerHTML).toBe("");
  });
});
