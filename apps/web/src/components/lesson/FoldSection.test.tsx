// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import FoldSection from "./FoldSection";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
const click = (el: Element) => act(async () => void el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

describe("FoldSection — mục phụ gập sẵn", () => {
  it("gập sẵn: hiện dòng tóm tắt và nút 'Xem chi tiết'; nội dung vẫn ở trong trang nhưng ẩn", async () => {
    await act(async () => root.render(<FoldSection summary={["1. 一 + 屋子"]}><p id="in">Chi tiết</p></FoldSection>));
    const btn = host.querySelector("button")!;
    expect(btn.textContent).toBe("Xem chi tiết");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector('[data-testid="fold-summary"]')!.textContent).toBe("1. 一 + 屋子");
    const content = host.querySelector("#in")!.parentElement!;
    expect(content.hidden).toBe(true);
    expect(host.querySelector("#in")).not.toBeNull();
  });

  it("bấm nút mở nội dung, bỏ dòng tóm tắt, đổi nhãn thành 'Thu gọn'; bấm lại thì gập", async () => {
    await act(async () => root.render(<FoldSection summary={["a"]}><p id="in">Chi tiết</p></FoldSection>));
    const btn = host.querySelector("button")!;
    await click(btn);
    expect(btn.textContent).toBe("Thu gọn");
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector("#in")!.parentElement!.hidden).toBe(false);
    expect(host.querySelector('[data-testid="fold-summary"]')).toBeNull();
    await click(btn);
    expect(btn.textContent).toBe("Xem chi tiết");
    expect(host.querySelector('[data-testid="fold-summary"]')).not.toBeNull();
  });

  it("token pinyin trong dòng tóm tắt thành ruby: pinyin dưới từng chữ Hán", async () => {
    await act(async () => root.render(<FoldSection summary={["{{一屋子^yì wū zi}}"]}><p>x</p></FoldSection>));
    expect(host.querySelectorAll('[data-testid="fold-summary"] rt').length).toBe(3);
  });

  it("không có tóm tắt thì chỉ có nút", async () => {
    await act(async () => root.render(<FoldSection summary={[]}><p>x</p></FoldSection>));
    expect(host.querySelector('[data-testid="fold-summary"]')).toBeNull();
    expect(host.querySelector("button")).not.toBeNull();
  });
});
