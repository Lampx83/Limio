// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import HskVocabView from "./HskVocabView";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const items = [
  {
    id: "a",
    term: "租",
    reading: "zū",
    meaning: "đg. · thuê (nhà, xe…)",
    example: "我想租一间房子。",
    exampleReading: "Wǒ xiǎng zū yì jiān fángzi.",
    exampleMeaning: "Mình muốn thuê một căn nhà.",
    note: "Từ chủ động. Không nói 借房.",
  },
  { id: "b", term: "出租", meaning: "cho thuê" }, // thẻ cũ: không có reading, nghĩa không có từ loại
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
const btn = (label: RegExp) => [...host.querySelectorAll("button")].find((b) => label.test(b.textContent ?? ""))!;

describe("HskVocabView — mục Từ mới của bài HSK tác giả", () => {
  it("mặc định là lưới Thẻ từ: nhãn từ loại, chữ Hán có pinyin dưới từng chữ, nghĩa, dấu Chủ động; thẻ cũ vẫn hiện", async () => {
    await act(async () => root.render(<HskVocabView items={items} />));
    expect(host.querySelector(".hsk-fc")).toBeNull();
    const cards = host.querySelectorAll("li.hsk-wc");
    expect(cards.length).toBe(2);
    expect(cards[0]!.querySelector(".hsk-pos")?.textContent).toBe("đg.");
    expect(cards[0]!.querySelector("ruby rt")?.textContent).toBe("zū");
    expect(cards[0]!.querySelector(".hsk-wc-mean")?.textContent).toBe("thuê (nhà, xe…)");
    expect(cards[0]!.querySelector(".hsk-wc-tag-on")?.textContent).toBe("Chủ động");
    expect(cards[1]!.querySelector(".hsk-pos")).toBeNull();
    expect(cards[1]!.textContent).toContain("出租");
    expect(cards[1]!.querySelector(".hsk-wc-mean")?.textContent).toBe("cho thuê");
    // không có thanh audio rỗng khi thẻ không có audioUrl
    expect(host.querySelector("audio")).toBeNull();
    expect(host.querySelector(".hsk-wc-audio")).toBeNull();
    // công tắc đúng như HSK 3, không có nút Pinyin ở chế độ Thẻ từ
    expect(btn(/Thẻ từ/)).toBeTruthy();
    expect(btn(/Flashcard/)).toBeTruthy();
    expect(btn(/^Pinyin$/)).toBeUndefined();
  });
  it("bấm thẻ mở hộp Cách viết kèm pinyin, nghĩa, ví dụ", async () => {
    await act(async () => root.render(<HskVocabView items={items} />));
    await act(async () => (host.querySelector("li.hsk-wc") as HTMLElement).click());
    const dlg = document.querySelector('[data-testid="hanzi-dialog"]')!;
    expect(dlg).not.toBeNull();
    expect(dlg.querySelector(".hsk-wd-py")?.textContent).toBe("zū");
    expect(dlg.querySelector(".hsk-wd-mean")?.textContent).toContain("thuê (nhà, xe…)");
    expect(dlg.querySelector(".hsk-vex-vi")?.textContent).toBe("Mình muốn thuê một căn nhà.");
  });
  it("Flashcard: mặt trước chữ Hán + từ loại; mặt sau pinyin, nghĩa, ví dụ, ghi chú; tắt Pinyin thì làm mờ", async () => {
    await act(async () => root.render(<HskVocabView items={items} />));
    await act(async () => btn(/Flashcard/).click());
    expect(host.querySelector(".hsk-fc-front .hsk-pos")?.textContent).toBe("đg.");
    const back = host.querySelector(".hsk-fc-back")!;
    expect(back.querySelector(".hsk-fc-mean")?.textContent).toContain("thuê (nhà, xe…)");
    expect(back.querySelector(".hsk-fc-b-py")?.textContent).toBe("zū");
    expect(back.querySelector(".hsk-vtag-on")?.textContent).toBe("Từ chủ động");
    expect(back.querySelector(".hsk-fc-note")?.textContent).toContain("Không nói 借房");
    expect(back.querySelector(".hsk-vex ruby rt")?.textContent).toBe("wǒ");
    expect(back.querySelector(".hsk-vex-vi")?.textContent).toBe("Mình muốn thuê một căn nhà.");
    await act(async () => btn(/^Pinyin$/).click());
    expect(host.querySelector('.hsk-fc-b-py[data-masked="true"]')).not.toBeNull();
  });
  it("thẻ có audioUrl có nút nghe; thẻ lỗi (thiếu từ) bị bỏ, không vỡ", async () => {
    const withAudio = [{ id: "a", term: "租", reading: "zū", meaning: "đg. · thuê", audioUrl: "/x.mp3" }, { id: "z", term: "", meaning: "lỗi" }, { id: "n", term: "房子" }] as never;
    await act(async () => root.render(<HskVocabView items={withAudio} />));
    expect(host.querySelectorAll("li.hsk-wc").length).toBe(2);
    expect(host.querySelectorAll(".hsk-wc-audio").length).toBe(1);
  });
  it("không còn thẻ hợp lệ thì không vẽ gì", async () => {
    await act(async () => root.render(<HskVocabView items={[{ id: "z", term: " ", meaning: "x" }]} />));
    expect(host.innerHTML).toBe("");
  });

  it("audio tổng hợp: có thanh phát ở đầu khi payload có audioUrl, không có thì không hiện thanh nào", () => {
    act(() => root.render(<HskVocabView items={items} trackUrl="/api/lesson-media/audio/all.mp3" />));
    const a = host.querySelector(".hsk-vv-track audio") as HTMLAudioElement | null;
    expect(a?.getAttribute("src")).toBe("/api/lesson-media/audio/all.mp3");
    // Trình phát của Limio: có nút chọn tốc độ.
    expect(host.querySelector('.hsk-vv-track [aria-pressed]')).not.toBeNull();
    act(() => root.render(<HskVocabView items={items} />));
    expect(host.querySelector(".hsk-vv-track")).toBeNull();
    expect(host.querySelector("audio")).toBeNull();
  });
});

describe("currentTrackItem", () => {
  it("trả thẻ có mốc lớn nhất không vượt quá giây hiện tại; chưa có mốc thì null", async () => {
    const { currentTrackItem } = await import("./HskVocabView");
    const it = [{ id: "a", trackStartSec: 0 }, { id: "b", trackStartSec: 5.2 }, { id: "c", trackStartSec: 10.4 }, { id: "d" }];
    expect(currentTrackItem(it, 0)).toBe("a");
    expect(currentTrackItem(it, 5.1)).toBe("a");
    expect(currentTrackItem(it, 5.16)).toBe("b"); // sai số 0,05 s: sắp tới từ b
    expect(currentTrackItem(it, 7)).toBe("b");
    expect(currentTrackItem(it, 99)).toBe("c");
    expect(currentTrackItem([{ id: "x" }], 3)).toBeNull();
  });
});
