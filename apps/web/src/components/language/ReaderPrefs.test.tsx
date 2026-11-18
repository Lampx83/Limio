// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReaderPrefsMenu, ReaderPrefsProvider, useReaderPrefsState, useTapReveal } from "./ReaderPrefs";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function Harness({ slug, pinyinAvailable = true }: { slug: string; pinyinAvailable?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const r = useReaderPrefsState(slug);
  useTapReveal(ref, r.prefs.pinyin);
  return (
    <ReaderPrefsProvider value={{ prefs: r.prefs, setPrefs: r.setPrefs, pinyinAvailable }}>
      <div ref={ref} data-rd-pinyin={r.prefs.pinyin} data-rd-size={r.prefs.size} data-testid="root">
        <ReaderPrefsMenu />
        <p id="line">
          <ruby className="ruby-han">
            你<rt id="rt">nǐ</rt>
          </ruby>
        </p>
        <button id="btn">nghe</button>
      </div>
    </ReaderPrefsProvider>
  );
}
const click = (el: Element) => act(async () => void el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const rootEl = () => host.querySelector<HTMLElement>('[data-testid="root"]')!;
const open = async () => click(host.querySelector('[data-testid="reader-prefs-button"]')!);
const doc = () => host.ownerDocument;
const radio = (name: string) => [...host.ownerDocument.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.getAttribute("aria-label") === name)!;

describe("ReaderPrefsMenu — tuỳ chọn đọc Aa", () => {
  it("mặc định: pinyin luôn hiện, cỡ vừa; bảng đóng cho tới khi bấm Aa", async () => {
    await act(async () => root.render(<Harness slug="k" />));
    expect(rootEl().dataset.rdPinyin).toBe("show");
    expect(rootEl().dataset.rdSize).toBe("m");
    expect(doc().querySelector('[data-testid="reader-prefs"]')).toBeNull();
    await open();
    expect(doc().querySelector('[data-testid="reader-prefs"]')).not.toBeNull();
  });

  it("chọn Ẩn và Lớn đổi thuộc tính của khung và được nhớ theo khoá", async () => {
    await act(async () => root.render(<Harness slug="hsk" />));
    await open();
    await click(radio("Ẩn"));
    await click(radio("Lớn"));
    expect(rootEl().dataset.rdPinyin).toBe("off");
    expect(rootEl().dataset.rdSize).toBe("l");
    expect(JSON.parse(window.localStorage.getItem("limio:reader:hsk")!)).toEqual({ pinyin: "off", size: "l" });
  });

  it("lần mở lại (dựng mới) đọc lại lựa chọn đã nhớ", async () => {
    window.localStorage.setItem("limio:reader:hsk", JSON.stringify({ pinyin: "tap", size: "xl" }));
    await act(async () => root.render(<Harness slug="hsk" />));
    expect(rootEl().dataset.rdPinyin).toBe("tap");
    expect(rootEl().dataset.rdSize).toBe("xl");
  });

  it("khoá không có pinyin: bảng không có nhóm Pinyin", async () => {
    await act(async () => root.render(<Harness slug="k" pinyinAvailable={false} />));
    await open();
    expect(doc().body.textContent).not.toContain("Luôn hiện");
    expect(doc().body.textContent).toContain("Cỡ chữ");
  });

  it("chạm để xem: chạm vào khối thì pinyin của khối hiện (dấu data-rd-shown), chạm lần nữa thì ẩn; chạm nút thì không", async () => {
    window.localStorage.setItem("limio:reader:k", JSON.stringify({ pinyin: "tap", size: "m" }));
    await act(async () => root.render(<Harness slug="k" />));
    const rt = host.querySelector("#rt")!;
    expect(rt.hasAttribute("data-rd-shown")).toBe(false);
    await click(host.querySelector("#btn")!);
    expect(rt.hasAttribute("data-rd-shown")).toBe(false);
    await click(host.querySelector("#line")!);
    expect(rt.hasAttribute("data-rd-shown")).toBe(true);
    await click(host.querySelector("#line")!);
    expect(rt.hasAttribute("data-rd-shown")).toBe(false);
  });

  it("đổi khỏi chế độ chạm thì xoá hết dấu hiện đã đặt", async () => {
    window.localStorage.setItem("limio:reader:k", JSON.stringify({ pinyin: "tap", size: "m" }));
    await act(async () => root.render(<Harness slug="k" />));
    await click(host.querySelector("#line")!);
    expect(host.querySelector("#rt")!.hasAttribute("data-rd-shown")).toBe(true);
    await open();
    await click(radio("Luôn hiện"));
    expect(host.querySelector("#rt")!.hasAttribute("data-rd-shown")).toBe(false);
  });
});
