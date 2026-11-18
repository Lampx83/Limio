// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/useAudioRecorder", () => ({
  useAudioRecorder: () => ({ state: "idle", seconds: 0, error: null, previewUrl: null, start: async () => undefined, stop: () => undefined }),
}));

import FreeChat from "./FreeChat";
import { parseFreeChatView } from "@/lib/freeChatView";

const view = parseFreeChatView({
  freechat: {
    scenario: "Nói về nơi bạn ở.",
    partnerRole: "一个中国同学",
    opening: "你好！你现在住在哪儿？",
    targets: ["住", "离学校"],
    maxTurns: 4,
    scaffold: {
      model: { text: "我现在一个人**住**，房子离学校不太远。" },
      ideas: ["Hỏi lại bạn ảo: 你呢？"],
      frames: [{ en: "我现在住在……", vi: "Bây giờ mình ở ..." }],
      phrases: [{ en: "很近", vi: "rất gần" }],
      vocab: [{ en: "租房子", vi: "thuê nhà" }],
    },
  },
})!;

let host: HTMLDivElement;
let root: Root;
async function mount(language: string | null) {
  await act(async () => {
    root.render(<FreeChat view={view} savedText="" preview={false} send={async () => "你呢？"} transcribe={async () => ""} onAnswer={() => undefined} animate={false} language={language} />);
  });
  // bộ tính pinyin nạp lười: chờ import động xong rồi vẽ lại
  await act(async () => {
    await import("@/lib/hanPinyin");
  });
  await act(async () => {});
}
const click = async (el: Element) => act(async () => void el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const rts = (el: ParentNode) => [...el.querySelectorAll("rt")].map((x) => x.textContent);
const btn = (re: RegExp) => [...document.querySelectorAll("button")].find((b) => re.test(b.textContent ?? ""))!;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  localStorage.clear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("Nói với bạn ảo — pinyin dưới chữ Hán (khoá tiếng Trung)", () => {
  it("khoá zh: tên vai và lời mở đầu (sau Bắt đầu) có pinyin; công tắc Pinyin tắt/bật", async () => {
    await mount("zh");
    expect(host.querySelector('[data-testid="fc-pinyin-toggle"]')).not.toBeNull();
    expect(rts(host.querySelector(".fc-chat-head")!)).toEqual(["yí", "gè", "zhōng", "guó", "tóng", "xué"]);
    await click(btn(/^\s*Bắt đầu\s*$/));
    expect(rts(host.querySelector(".fc-log")!)).toContain("zhù");
    await click(host.querySelector('[data-testid="fc-pinyin-toggle"]')!);
    expect(host.querySelectorAll("ruby")).toHaveLength(0);
    await click(host.querySelector('[data-testid="fc-pinyin-toggle"]')!);
    expect(host.querySelectorAll("ruby").length).toBeGreaterThan(0);
  });

  it("khung Chuẩn bị: bài mẫu, ý tưởng, mẫu câu, cụm từ, từ vựng có pinyin; chữ Việt, '……' không thành ruby", async () => {
    await mount("zh");
    await click(btn(/Chuẩn bị/));
    const d = document.querySelector('[data-testid="fc-prep-dialog"]')!;
    expect(rts(d.querySelector('[data-testid="fc-transcript"]')!)).toContain("lí");
    expect(rts(d.querySelector('[data-testid="fc-ideas"]')!)).toEqual(["nǐ", "ne"]);
    expect(rts(d.querySelector('[data-testid="fc-frames"]')!)).toEqual(["wǒ", "xiàn", "zài", "zhù", "zài"]);
    expect(rts(d.querySelector('[data-testid="fc-words"]')!)).toEqual(["hěn", "jìn"]);
    expect(rts(d.querySelector('[data-testid="fc-vocab"]')!)).toEqual(["zū", "fáng", "zi"]);
    expect(d.textContent).toContain("Bây giờ mình ở ...");
    expect(d.querySelector('[data-testid="fc-frames"]')!.textContent).toContain("……");
    for (const r of d.querySelectorAll("ruby")) expect(r.textContent).toMatch(/[㐀-鿿]/);
  });

  it("khoá en: không ruby, không công tắc", async () => {
    await mount("en");
    expect(host.querySelector('[data-testid="fc-pinyin-toggle"]')).toBeNull();
    await click(btn(/^\s*Bắt đầu\s*$/));
    expect(host.querySelectorAll("ruby")).toHaveLength(0);
  });
});
