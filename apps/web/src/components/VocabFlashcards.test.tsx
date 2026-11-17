// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import VocabFlashcards from "./VocabFlashcards";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md — AC3. */
const items = [
  {
    id: "w1",
    term: "take over",
    reading: "/teɪk ˈəʊvə/",
    meaning: "start being responsible for a job that someone else was doing before you",
    example: "I took over the family’s law business ten years ago.",
    note: "separable? no",
  },
];

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

async function render() {
  await act(async () => {
    root.render(<VocabFlashcards items={items} showReading playingId={null} onToggleAudio={() => undefined} />);
  });
}
const faces = () => {
  const all = [...host.querySelectorAll<HTMLElement>(".flip-face")];
  return { front: all[0]!.textContent ?? "", back: all[1]!.textContent ?? "" };
};
async function reverse() {
  const btn = [...host.querySelectorAll("button")].find((b) => /Mặt trước/.test(b.textContent ?? ""))!;
  await act(async () => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("VocabFlashcards — ví dụ không lộ đáp án", () => {
  it("chiều mặc định (mặt trước là từ): mặt trước chỉ có từ và phiên âm; mặt sau có nghĩa, ghi chú và ví dụ", async () => {
    await render();
    const { front, back } = faces();
    expect(front).toContain("take over");
    expect(front).not.toContain("I took over");
    for (const s of ["start being responsible", "separable? no", "I took over the family"]) expect(back).toContain(s);
  });

  it("mặt trước là nghĩa: không có ví dụ và không có ghi chú ở mặt trước", async () => {
    await render();
    await reverse();
    const { front } = faces();
    expect(front).toContain("start being responsible");
    expect(front).not.toContain("I took over the family");
    expect(front).not.toContain("separable? no");
    expect(front).not.toContain("take over");
  });

  it("mặt trước là nghĩa: mặt sau có từ, phiên âm, ví dụ và ghi chú để xem cách dùng", async () => {
    await render();
    await reverse();
    const { back } = faces();
    for (const s of ["take over", "/teɪk ˈəʊvə/", "I took over the family", "separable? no"]) expect(back).toContain(s);
  });
});

describe("VocabFlashcards — che phiên âm bằng cách làm mờ", () => {
  it("showReading=false: phiên âm vẫn có trong thẻ nhưng bị làm mờ; bật thì hết mờ", () => {
    act(() => root.render(<VocabFlashcards items={items} showReading={false} playingId={null} onToggleAudio={() => undefined} />));
    const el = host.querySelector('[data-masked="true"]');
    expect(el?.textContent).toBe("/teɪk ˈəʊvə/");
    expect(el?.className).toContain("blur-sm");
    act(() => root.render(<VocabFlashcards items={items} showReading playingId={null} onToggleAudio={() => undefined} />));
    expect(host.querySelector('[data-masked="true"]')).toBeNull();
  });
});
