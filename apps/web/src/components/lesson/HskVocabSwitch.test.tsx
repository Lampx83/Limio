// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import HskVocabSwitch from "./HskVocabSwitch";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const html =
  "<table><tr><th>词</th><th>Pinyin</th><th>词性</th><th>Tiếng Việt</th></tr>" +
  "<tr><td>以为</td><td>yǐwéi</td><td>đg.</td><td>nghĩ rằng</td></tr>" +
  "<tr><td>像</td><td>xiàng</td><td>đg.</td><td>giống</td></tr></table>";

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

const btn = (label: RegExp) => [...host.querySelectorAll("button")].find((b) => label.test(b.textContent ?? ""))!;

describe("HskVocabSwitch — flashcard che/hiện pinyin", () => {
  it("chuyển sang Flashcard thì có nút Pinyin; bấm để che, bấm lại để hiện", async () => {
    await act(async () => {
      root.render(
        <HskVocabSwitch html={html}>
          <p data-testid="cards">lưới thẻ</p>
        </HskVocabSwitch>,
      );
    });
    expect(host.querySelector('[data-testid="cards"]')).not.toBeNull(); // mặc định: lưới thẻ
    expect(btn(/^Pinyin$/)).toBeUndefined(); // nút che pinyin chỉ có ở chế độ flashcard
    await act(async () => btn(/Flashcard/).click());
    expect(host.textContent).toContain("yǐwéi"); // mặt trước: từ + pinyin
    const toggle = btn(/^Pinyin$/);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    await act(async () => toggle.click());
    // Che = làm mờ, không gỡ: chữ Hán giữ nguyên vị trí, phiên âm vẫn nằm đó nhưng mờ và không bôi đen được.
    const masked = host.querySelector('[data-masked="true"]')!;
    expect(masked.textContent).toBe("yǐwéi");
    expect(masked.className).toContain("blur-sm");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(host.textContent).toContain("以为");
    await act(async () => toggle.click());
    expect(host.querySelector('[data-masked="true"]')).toBeNull();
    expect(host.textContent).toContain("yǐwéi");
  });
});
