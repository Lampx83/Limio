// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Collapse, { COLLAPSE_MS } from "./Collapse";
import { usePresence } from "./usePresence";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});
const render = (el: React.ReactElement) => act(async () => root.render(el));
const box = () => host.querySelector<HTMLElement>(".collapse")!;

describe("Collapse — mở/thu mượt", () => {
  it("đóng: ẩn khỏi trình đọc màn hình và bàn phím (aria-hidden, inert) nhưng nội dung vẫn trong trang", async () => {
    await render(<Collapse open={false}><p id="x">nội dung</p></Collapse>);
    expect(box().hasAttribute("data-open")).toBe(false);
    expect(box().getAttribute("aria-hidden")).toBe("true");
    expect(box().hasAttribute("inert")).toBe(true);
    expect(host.querySelector("#x")).not.toBeNull();
  });

  it("mở: bỏ aria-hidden và inert; mở xong thì bỏ overflow-hidden để bóng/popover không bị cắt", async () => {
    await render(<Collapse open><p id="x">nội dung</p></Collapse>);
    expect(box().hasAttribute("data-open")).toBe(true);
    expect(box().getAttribute("aria-hidden")).toBeNull();
    expect(box().hasAttribute("inert")).toBe(false);
    expect(box().firstElementChild!.className).not.toContain("overflow-hidden");
    await render(<Collapse open={false}><p id="x">nội dung</p></Collapse>);
    expect(box().firstElementChild!.className).toContain("overflow-hidden");
  });

  it("lazy: đóng thì không dựng nội dung; mở thì dựng ngay; đóng lại thì giữ hết thời gian thu rồi gỡ", async () => {
    await render(<Collapse open={false} lazy><p id="x">nội dung</p></Collapse>);
    expect(host.querySelector("#x")).toBeNull();
    await render(<Collapse open lazy><p id="x">nội dung</p></Collapse>);
    expect(host.querySelector("#x")).not.toBeNull();
    await render(<Collapse open={false} lazy><p id="x">nội dung</p></Collapse>);
    expect(host.querySelector("#x")).not.toBeNull();
    await act(async () => void vi.advanceTimersByTime(COLLAPSE_MS + 100));
    expect(host.querySelector("#x")).toBeNull();
  });
});

describe("usePresence", () => {
  function Probe({ open }: { open: boolean }) {
    const { mounted, leaving } = usePresence(open, 180);
    return <p data-m={mounted ? "1" : "0"} data-l={leaving ? "1" : "0"} />;
  }
  const state = () => {
    const p = host.querySelector("p")!;
    return [p.dataset.m, p.dataset.l];
  };
  it("đóng thì còn dựng thêm một lúc (đang thoát), rồi gỡ; mở lại thì dựng ngay", async () => {
    await render(<Probe open />);
    expect(state()).toEqual(["1", "0"]);
    await render(<Probe open={false} />);
    expect(state()).toEqual(["1", "1"]);
    await act(async () => void vi.advanceTimersByTime(200));
    expect(state()).toEqual(["0", "0"]);
    await render(<Probe open />);
    expect(state()).toEqual(["1", "0"]);
  });
});
