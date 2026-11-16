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

  it("chỉ một khối mà tên là số exercise (\"6\", \"2A\"): vẫn hiện số bài tập (thanh tab một tab), nội dung bên dưới", async () => {
    await render([{ id: "x", label: "6", content: <p>Nội dung sáu</p> }]);
    const bar = host.querySelector('[role="tablist"]');
    expect(bar).not.toBeNull();
    expect([...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(["6"]);
    expect(host.textContent).toContain("Nội dung sáu");
  });

  it("chỉ một khối không có số exercise (tên chữ): không có thanh tab, nội dung hiện thẳng", async () => {
    await render([{ id: "y", label: "Fair Isle: fact file", content: <p>Nội dung B</p> }]);
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(host.textContent).toContain("Nội dung B");
  });

  it("không có khối: không vẽ gì", async () => {
    await render([]);
    expect(host.innerHTML).toBe("");
  });
});

describe("PracticeTabs — thẻ bài tập (loại bài, tên bài, tiến độ)", () => {
  const withMeta = [
    { id: "a", label: "5A", content: <p>A</p>, meta: { title: "Complete the phrases", kind: "write" as const, ids: ["q1", "q2", "q3"], answered: ["q1"], checked: [] } },
    { id: "b", label: "Free practice · Talk with a virtual partner", content: <p>B</p>, meta: { title: "Free practice", kind: "speak" as const, ids: ["q9"], answered: [], checked: [] } },
  ];
  const progress = (detail: { ids: string[]; answered: string[]; checked: string[] }) =>
    act(async () => void window.dispatchEvent(new CustomEvent("limio:practice-progress", { detail })));

  it("thẻ có nhãn Exercise, mã bài và tên bài", async () => {
    await render(withMeta);
    expect(tabEls()[0]!.textContent).toContain("Exercise");
    expect(tabEls()[0]!.textContent).toContain("5A");
    expect(tabEls()[0]!.textContent).toContain("Complete the phrases");
    expect(tabEls()[0]!.textContent).toContain("1/3 câu");
  });

  it("nhãn chữ không có mã bài tập: cả nhãn là tên bài, không có huy hiệu", async () => {
    await render(withMeta);
    const t = tabEls()[1]!.textContent!;
    expect(t).toContain("Activity");
    expect(t).toContain("Free practice: Talk with a virtual partner");
    expect(t).toContain("1 câu");
    expect(tabEls()[1]!.getAttribute("title")).toBe("Nói với bạn ảo");
  });

  it("khối luyện báo tiến độ: đếm câu đã làm cập nhật, kiểm tra hết thì hiện Xong", async () => {
    await render(withMeta);
    await progress({ ids: ["q1", "q2", "q3"], answered: ["q1", "q2"], checked: [] });
    expect(tabEls()[0]!.textContent).toContain("2/3 câu");
    await progress({ ids: ["q1", "q2", "q3"], answered: ["q1", "q2", "q3"], checked: ["q1", "q2", "q3"] });
    expect(tabEls()[0]!.textContent).toContain("Xong");
    expect(tabEls()[1]!.textContent).not.toContain("Xong");
  });

  it("tab không có thông tin bài tập (cũ): chỉ có nhãn, không có trạng thái", async () => {
    await render([{ id: "x", label: "7A", content: <p>x</p> }, { id: "y", label: "7B", content: <p>y</p> }]);
    expect(tabEls().map((t) => t.textContent)).toEqual(["7A", "7B"]);
  });
});

describe("PracticeTabs — nhiều thẻ: mũi tên và mờ mép", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, label: `${i + 1}A`, content: <p>{i}</p> }));
  const bar = () => host.querySelector<HTMLElement>('[role="tablist"]')!;
  const setScroll = async (scrollLeft: number) => {
    const el = bar();
    Object.defineProperty(el, "scrollWidth", { configurable: true, value: 1000 });
    Object.defineProperty(el, "clientWidth", { configurable: true, value: 300 });
    el.scrollLeft = scrollLeft;
    await act(async () => void el.dispatchEvent(new Event("scroll")));
  };
  const arrow = (side: "trái" | "phải") => host.querySelector(`button[aria-label="Cuộn hàng bài tập sang ${side}"]`);

  it("còn thẻ bị che ở bên phải: có nút sang phải, chưa có nút sang trái; cuộn tới cuối thì đảo lại", async () => {
    await render(many);
    await setScroll(0);
    expect(arrow("phải")).not.toBeNull();
    expect(arrow("trái")).toBeNull();
    await setScroll(700);
    expect(arrow("trái")).not.toBeNull();
    expect(arrow("phải")).toBeNull();
  });

  it("vừa một hàng thì không có mũi tên nào", async () => {
    await render(many.slice(0, 2));
    expect(arrow("phải")).toBeNull();
    expect(arrow("trái")).toBeNull();
  });
});
