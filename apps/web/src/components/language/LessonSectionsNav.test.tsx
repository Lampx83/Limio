// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LessonSectionsNav from "./LessonSectionsNav";
import { RAIL_SECTIONS_TOGGLE_EVENT, SECTIONS_COLLAPSED_KEY } from "@/lib/railSections";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

function content(heads: Array<[string, string, string]>) {
  const c = document.createElement("div");
  c.id = "lesson-content";
  c.innerHTML = heads
    .map(([no, zh, vi2]) => `<div class="hsk-sh"><span class="hsk-sn">${no}</span><h2><span class="zh">${zh}</span>${vi2}</h2></div>`)
    .join("");
  document.body.appendChild(c);
  return c;
}
const mount = () => act(async () => root.render(<LessonSectionsNav />));

describe("LessonSectionsNav — mục lục phần trong thanh bài", () => {
  it("đọc các mục có số từ nội dung bài: số + tên Việt (bỏ tên chữ Hán)", async () => {
    content([["01", "情景", "Tình huống"], ["02", "对话", "Hội thoại"], ["03", "生词", "Từ mới"]]);
    await mount();
    const buttons = [...host.querySelectorAll("ol button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["01Tình huống", "02Hội thoại", "03Từ mới"]);
    expect(host.querySelector('[data-testid="lesson-sections-nav"]')!.closest(".lg\\:block")).not.toBeNull();
  });

  it("bài không có mục có số thì không hiện gì", async () => {
    content([]);
    await mount();
    expect(host.querySelector('[data-testid="lesson-sections-nav"]')).toBeNull();
  });

  it("bấm một mục thì cuộn tới đầu mục đó", async () => {
    const c = content([["01", "情景", "Tình huống"], ["02", "对话", "Hội thoại"]]);
    const target = c.querySelectorAll<HTMLElement>(".hsk-sh")[1]!;
    const spy = vi.fn();
    target.scrollIntoView = spy;
    await mount();
    await act(async () => void host.querySelectorAll("ol button")[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(spy).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
  });

  it("mục đầu là mục đang đọc khi chưa cuộn (aria-current)", async () => {
    content([["01", "情景", "Tình huống"], ["02", "对话", "Hội thoại"]]);
    await mount();
    const [first, second] = [...host.querySelectorAll("ol button")];
    expect(first!.getAttribute("aria-current")).toBe("location");
    expect(second!.getAttribute("aria-current")).toBeNull();
  });

  it("mũi tên thu gọn/mở danh sách mục (aria-expanded) và nhớ lựa chọn", async () => {
    content([["01", "情景", "Tình huống"], ["02", "对话", "Hội thoại"]]);
    await mount();
    const toggle = () => host.querySelector<HTMLButtonElement>('[data-testid="lesson-sections-toggle"]')!;
    const list = () => host.querySelector<HTMLElement>('[data-testid="lesson-sections-collapse"]')!;
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(list().hasAttribute("data-open")).toBe(true);
    await act(async () => void toggle().dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(list().hasAttribute("data-open")).toBe(false);
    expect(localStorage.getItem(SECTIONS_COLLAPSED_KEY)).toBe("1");
    await act(async () => void toggle().dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(list().hasAttribute("data-open")).toBe(true);
    expect(localStorage.getItem(SECTIONS_COLLAPSED_KEY)).toBe("0");
  });

  it("sự kiện bấm vào dòng bài hiện tại cũng thu gọn/mở danh sách", async () => {
    content([["01", "情景", "Tình huống"]]);
    await mount();
    const list = () => host.querySelector<HTMLElement>('[data-testid="lesson-sections-collapse"]')!;
    await act(async () => void window.dispatchEvent(new Event(RAIL_SECTIONS_TOGGLE_EVENT)));
    expect(list().hasAttribute("data-open")).toBe(false);
    await act(async () => void window.dispatchEvent(new Event(RAIL_SECTIONS_TOGGLE_EVENT)));
    expect(list().hasAttribute("data-open")).toBe(true);
  });

  it("đã thu gọn từ lần trước thì vào trang là thu gọn sẵn", async () => {
    localStorage.setItem(SECTIONS_COLLAPSED_KEY, "1");
    content([["01", "情景", "Tình huống"]]);
    await mount();
    expect(host.querySelector('[data-testid="lesson-sections-collapse"]')!.hasAttribute("data-open")).toBe(false);
    expect(host.querySelector('[data-testid="lesson-sections-toggle"]')!.getAttribute("aria-expanded")).toBe("false");
  });

  it("bài không có mục thì không có cả mũi tên", async () => {
    content([]);
    await mount();
    expect(host.querySelector('[data-testid="lesson-sections-toggle"]')).toBeNull();
  });
});
