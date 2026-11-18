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
  useTapReveal(ref, { pinyin: r.prefs.pinyin, translation: r.prefs.translation });
  return (
    <ReaderPrefsProvider value={{ prefs: r.prefs, setPrefs: r.setPrefs, pinyinAvailable }}>
      <div ref={ref} data-rd-pinyin={r.prefs.pinyin} data-rd-translation={r.prefs.translation} data-rd-size={r.prefs.size} data-testid="root">
        <ReaderPrefsMenu />
        <p id="line">
          <ruby className="ruby-han">
            你<rt id="rt">nǐ</rt>
          </ruby>
        </p>
        <p id="turn">
          <span id="han">你好</span>
          <span id="tr" data-rd-tr="">Xin chào</span>
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
    expect(JSON.parse(window.localStorage.getItem("limio:reader:hsk")!)).toEqual({ pinyin: "off", translation: "off", size: "l" });
  });

  it("lần mở lại (dựng mới) đọc lại lựa chọn đã nhớ", async () => {
    window.localStorage.setItem("limio:reader:hsk", JSON.stringify({ pinyin: "tap", translation: "off", size: "xl" }));
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
    window.localStorage.setItem("limio:reader:k", JSON.stringify({ pinyin: "tap", translation: "off", size: "m" }));
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

  it("mặc định bản dịch ẩn; bảng có nhóm Bản dịch khi bài có đoạn bản dịch, chọn Luôn hiện đổi thuộc tính khung", async () => {
    await act(async () => root.render(<Harness slug="k" />));
    expect(rootEl().dataset.rdTranslation).toBe("off");
    document.body.insertAdjacentHTML("beforeend", '<div id="lesson-content"><p data-rd-tr="">dịch</p></div>');
    await open();
    const group = [...doc().querySelectorAll<HTMLElement>('[data-testid="reader-prefs"] [role="radiogroup"]')].find((g) => g.getAttribute("aria-label") === "Bản dịch")!;
    await click(group.querySelector('[aria-label="Luôn hiện"]')!);
    expect(rootEl().dataset.rdTranslation).toBe("show");
    doc().getElementById("lesson-content")!.remove();
  });

  it("bài không có bản dịch thì bảng không có nhóm Bản dịch", async () => {
    await act(async () => root.render(<Harness slug="k" />));
    await open();
    expect(doc().querySelector('[data-testid="reader-prefs"] [role="radiogroup"][aria-label="Bản dịch"]')).toBeNull();
  });

  it("chạm để xem bản dịch: chạm vào khối thì dòng dịch hiện, chạm lần nữa thì ẩn", async () => {
    window.localStorage.setItem("limio:reader:k", JSON.stringify({ pinyin: "show", translation: "tap", size: "m" }));
    await act(async () => root.render(<Harness slug="k" />));
    const tr = host.querySelector("#tr")!;
    expect(tr.hasAttribute("data-rd-shown")).toBe(false);
    await click(host.querySelector("#han")!);
    expect(tr.hasAttribute("data-rd-shown")).toBe(true);
    await click(host.querySelector("#han")!);
    expect(tr.hasAttribute("data-rd-shown")).toBe(false);
  });

  it("đổi khỏi chế độ chạm thì xoá hết dấu hiện đã đặt", async () => {
    window.localStorage.setItem("limio:reader:k", JSON.stringify({ pinyin: "tap", translation: "off", size: "m" }));
    await act(async () => root.render(<Harness slug="k" />));
    await click(host.querySelector("#line")!);
    expect(host.querySelector("#rt")!.hasAttribute("data-rd-shown")).toBe(true);
    await open();
    await click(radio("Luôn hiện"));
    expect(host.querySelector("#rt")!.hasAttribute("data-rd-shown")).toBe(false);
  });
});
