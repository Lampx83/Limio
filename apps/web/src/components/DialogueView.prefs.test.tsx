// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import DialogueView from "./DialogueView";
import { ReaderPrefsProvider } from "./language/ReaderPrefs";
import { DEFAULT_READER_PREFS } from "@/lib/readerPrefs";

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

const turns = [{ id: "t1", speaker: "A", text: "你好", reading: "nǐ hǎo", translation: "Xin chào" }];

describe("DialogueView — pinyin và bản dịch do bảng Aa điều khiển trong khung bài", () => {
  const pinyinSwitches = () => [...host.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")];
  const trBtn = () => [...host.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")].find((b) => /bản dịch/i.test(b.textContent ?? ""));

  it("ngoài khung bài: có công tắc Pinyin và nút 'Ẩn bản dịch' (bản dịch bật sẵn)", async () => {
    await act(async () => root.render(<DialogueView turns={turns} />));
    expect(pinyinSwitches()).toHaveLength(1);
    expect(trBtn()!.textContent).toContain("Ẩn bản dịch");
    expect(trBtn()!.getAttribute("aria-expanded")).toBe("true");
  });

  it("trong khung bài: không có nút Pinyin lẫn nút bản dịch riêng; đoạn dịch mang dấu data-rd-tr để Aa điều khiển", async () => {
    await act(async () =>
      root.render(
        <ReaderPrefsProvider value={{ prefs: DEFAULT_READER_PREFS, setPrefs: () => undefined, pinyinAvailable: true }}>
          <DialogueView turns={turns} />
        </ReaderPrefsProvider>,
      ),
    );
    expect(pinyinSwitches()).toHaveLength(0);
    expect(trBtn()).toBeUndefined();
    expect(host.querySelector("[data-rd-tr]")!.textContent).toBe("Xin chào");
    // không bị che bằng data-masked: việc ẩn do CSS theo tuỳ chọn Aa
    expect(host.querySelector('[data-masked="true"]')).toBeNull();
  });
});
