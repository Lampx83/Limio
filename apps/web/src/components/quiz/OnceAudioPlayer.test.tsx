// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnceAudioPlayer from "./OnceAudioPlayer";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let play: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  window.sessionStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  play.mockRestore();
});

const state = () => host.querySelector('[data-testid="once-audio"]')!.getAttribute("data-state");
const mount = (key = "att1:q1") => act(async () => root.render(<OnceAudioPlayer url="/api/lesson-media/audio/a.mp3" storageKey={key} />));
const click = (el: Element) => act(async () => void el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const ended = () => act(async () => void host.querySelector("audio")!.dispatchEvent(new Event("ended")));

describe("OnceAudioPlayer — câu nghe phát một lần", () => {
  it("bắt đầu ở trạng thái chờ, chỉ có nút Phát (không thanh tua, tốc độ, lặp lại)", async () => {
    await mount();
    expect(state()).toBe("idle");
    expect(host.querySelector('[data-testid="once-audio-play"]')).not.toBeNull();
    expect(host.querySelector('input[type="range"]')).toBeNull();
    expect(host.textContent).not.toMatch(/0\.75|Lặp lại/);
  });

  it("bấm Phát thì đang phát và nút biến mất; phát xong thì khoá", async () => {
    await mount();
    await click(host.querySelector('[data-testid="once-audio-play"]')!);
    expect(play).toHaveBeenCalledTimes(1);
    expect(state()).toBe("playing");
    expect(host.querySelector('[data-testid="once-audio-play"]')).toBeNull();
    await ended();
    expect(state()).toBe("done");
    expect(host.querySelector('[data-testid="once-audio-done"]')).not.toBeNull();
  });

  it("đã nghe rồi thì mở lại (cùng khoá) vẫn khoá; câu khác thì chưa", async () => {
    await mount("att1:q1");
    await click(host.querySelector('[data-testid="once-audio-play"]')!);
    await ended();
    act(() => root.unmount());
    root = createRoot(host);
    await mount("att1:q1");
    expect(state()).toBe("done");
    act(() => root.unmount());
    root = createRoot(host);
    await mount("att1:q2");
    expect(state()).toBe("idle");
  });

  it("rời câu khi đang phát thì tính là đã nghe", async () => {
    await mount("att1:q3");
    await click(host.querySelector('[data-testid="once-audio-play"]')!);
    act(() => root.unmount());
    root = createRoot(host);
    await mount("att1:q3");
    expect(state()).toBe("done");
  });

  it("trình duyệt chặn phát thì quay về chờ và cho bấm lại", async () => {
    play.mockImplementationOnce(() => Promise.reject(new Error("blocked")));
    await mount("att1:q4");
    await click(host.querySelector('[data-testid="once-audio-play"]')!);
    await act(async () => {});
    expect(state()).toBe("idle");
    expect(window.sessionStorage.getItem("fbm:once-audio:att1:q4")).toBeNull();
  });
});
