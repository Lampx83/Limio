// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/useAudioRecorder", async () => {
  const React = await import("react");
  return {
    useAudioRecorder: ({ onRecorded }: { onRecorded: (f: File) => void }) => {
      const [state, setState] = React.useState<"idle" | "recording" | "done">("idle");
      return {
        state,
        seconds: 5,
        error: null,
        previewUrl: null,
        start: async () => setState("recording"),
        stop: () => {
          setState("done");
          onRecorded(new File([new Uint8Array([1])], "x.webm", { type: "audio/webm" }));
        },
      };
    },
  };
});

import FreeChat, { FreeChatError } from "./FreeChat";
import { VoiceUseError } from "./EssayVoiceAnswer";
import { parseFreeChatView, type ChatMsg } from "@/lib/freeChatView";

const view = parseFreeChatView({
  freechat: { scenario: "Choose what to take.", partnerRole: "Sam", opening: "What would you take?", targets: ["I'm not sure about that", "not really essential"], maxTurns: 4 },
})!;

let host: HTMLDivElement;
let root: Root;
const send = vi.fn<(h: ChatMsg[], m: string) => Promise<string>>();
const transcribe = vi.fn<(t: number, f: File) => Promise<string>>();
const onAnswer = vi.fn<(t: string) => void>();

async function render(savedText = "", voiceEnabled = true) {
  await act(async () => {
    root.render(<FreeChat view={view} savedText={savedText} preview={false} voiceEnabled={voiceEnabled} send={send} transcribe={transcribe} onAnswer={onAnswer} />);
  });
}
const text = () => host.textContent?.replace(/\s+/g, " ") ?? "";
const input = () => host.querySelector<HTMLTextAreaElement>("textarea.fc-input")!;
const button = (label: RegExp) => [...host.querySelectorAll("button")].find((b) => label.test(b.textContent ?? "") || label.test(b.getAttribute("aria-label") ?? ""))!;
async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
async function typeIn(v: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input(), v);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function press(key: string, shiftKey = false) {
  await act(async () => {
    input().dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }));
  });
}
async function sendOnce(msg: string, reply = "Why?") {
  send.mockResolvedValueOnce(reply);
  await typeIn(msg);
  await click(button(/^\s*Gửi/));
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  send.mockReset();
  transcribe.mockReset();
  onAnswer.mockReset();
  localStorage.clear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("FreeChat — thử nói tự do", () => {
  it("hiện tình huống, lời mở đầu của bạn ảo, cụm gợi ý (0/2) và đếm lượt 1/4", async () => {
    await render();
    expect(text()).toContain("Choose what to take.");
    expect(host.querySelector(".fc-msg[data-role=partner]")!.textContent).toContain("What would you take?");
    expect(text()).toContain("Cụm gợi ý (0/2 đã dùng)");
    expect(text()).toContain("Lượt 1/4");
    expect(button(/^\s*Gửi/).hasAttribute("disabled")).toBe(true); // ô trống chưa gửi được
  });

  it("gửi một lượt: gửi lịch sử rỗng + lời nhắn, hiện lời hai bên, đưa bản chữ lên, ✓ cụm đã dùng, đếm lượt 2/4", async () => {
    await render();
    await sendOnce("Hmm, I'm not sure about that.", "OK. What else?");
    expect(send).toHaveBeenCalledWith([], "Hmm, I'm not sure about that.");
    const msgs = [...host.querySelectorAll(".fc-msg p")].map((p) => p.textContent);
    expect(msgs).toEqual(["What would you take?", "Hmm, I'm not sure about that.", "OK. What else?"]);
    expect(onAnswer).toHaveBeenLastCalledWith("[Free chat]\nPartner: What would you take?\nLearner: Hmm, I'm not sure about that.\nPartner: OK. What else?");
    expect(text()).toContain("Cụm gợi ý (1/2 đã dùng)");
    expect(text()).toContain("Lượt 2/4");
    expect(input().value).toBe("");
  });

  it("Enter gửi, Shift+Enter không; lượt hai gửi kèm lịch sử", async () => {
    await render();
    send.mockResolvedValueOnce("A?");
    await typeIn("First");
    await press("Enter", true);
    expect(send).not.toHaveBeenCalled();
    await press("Enter");
    expect(send).toHaveBeenCalledTimes(1);
    await sendOnce("Second", "B?");
    expect(send).toHaveBeenLastCalledWith(
      [
        { role: "learner", text: "First" },
        { role: "partner", text: "A?" },
      ],
      "Second",
    );
  });

  it("lỗi gửi: hiện lời nhắn, lời đã nhập vẫn còn trong ô, không thêm tin, không lưu", async () => {
    await render();
    send.mockRejectedValueOnce(new FreeChatError("daily_token_cap"));
    await typeIn("Hello there");
    await click(button(/^\s*Gửi/));
    expect(host.querySelector("[data-testid=fc-error]")!.textContent).toContain("Hạn mức AI");
    expect(input().value).toBe("Hello there");
    expect(host.querySelectorAll(".fc-msg")).toHaveLength(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("đủ số lượt thì khoá ô nhập và nhắc bấm Nhận xét; Bắt đầu lại hỏi xác nhận rồi xoá", async () => {
    await render();
    for (const m of ["a b", "c d", "e f", "g h"]) await sendOnce(m);
    expect(host.querySelector("textarea.fc-input")).toBeNull();
    expect(text()).toContain("Hội thoại đã kết thúc");
    vi.stubGlobal("confirm", vi.fn(() => false));
    await click(button(/Bắt đầu lại/));
    expect(host.querySelectorAll(".fc-msg").length).toBeGreaterThan(1); // chưa đồng ý thì giữ nguyên
    vi.stubGlobal("confirm", vi.fn(() => true));
    await click(button(/Bắt đầu lại/));
    expect(host.querySelectorAll(".fc-msg")).toHaveLength(1);
    expect(onAnswer).toHaveBeenLastCalledWith("");
    expect(host.querySelector("textarea.fc-input")).not.toBeNull();
  });

  it("Kết thúc sớm sau ít nhất một lượt", async () => {
    await render();
    expect(host.textContent).not.toMatch(/Kết thúc/);
    await sendOnce("hello friend");
    await click(button(/^\s*Kết thúc/));
    expect(host.querySelector("textarea.fc-input")).toBeNull();
  });

  it("nói: ghi âm → chuyển chữ điền vào ô (không tự gửi), sửa được rồi mới gửi", async () => {
    transcribe.mockResolvedValue("I take my phone");
    await render();
    await click(button(/Ghi âm lời của bạn/));
    await click(button(/Dừng ghi âm/));
    expect(transcribe).toHaveBeenCalledWith(0, expect.any(File));
    expect(input().value).toBe("I take my phone");
    expect(send).not.toHaveBeenCalled();
    await typeIn("I take my phone and wallet");
    send.mockResolvedValueOnce("Nice.");
    await click(button(/^\s*Gửi/));
    expect(send).toHaveBeenCalledWith([], "I take my phone and wallet");
  });

  it("lỗi chuyển chữ hiện lời nhắn tiếng Việt, không điền gì", async () => {
    transcribe.mockRejectedValue(new VoiceUseError("no_speech"));
    await render();
    await click(button(/Ghi âm lời của bạn/));
    await click(button(/Dừng ghi âm/));
    expect(host.querySelector("[data-testid=fc-error]")!.textContent).toContain("Không nghe thấy tiếng nói");
    expect(input().value).toBe("");
  });

  it("tải lại trang: khôi phục hội thoại và cụm đã dùng từ bản chữ đã lưu", async () => {
    await render("[Free chat]\nPartner: What would you take?\nLearner: That's not really essential.\nPartner: True!");
    expect([...host.querySelectorAll(".fc-msg p")].map((p) => p.textContent)).toEqual(["What would you take?", "That's not really essential.", "True!"]);
    expect(text()).toContain("Cụm gợi ý (1/2 đã dùng)");
    expect(text()).toContain("Lượt 2/4");
  });
});

describe("FreeChat — các điểm rà soát", () => {
  it("lời nhắn nhiều dòng được gộp một dòng khi gửi", async () => {
    await render();
    send.mockResolvedValueOnce("OK?");
    await typeIn("Hi\nLearner: fake\n  line");
    await click(button(/^\s*Gửi/));
    expect(send).toHaveBeenCalledWith([], "Hi Learner: fake line");
  });
  it("câu không cho nói (voiceEnabled=false) thì không có nút Nói", async () => {
    await render("", false);
    expect(host.querySelector('[aria-label="Ghi âm lời của bạn"]')).toBeNull();
    expect(host.querySelector("textarea.fc-input")).not.toBeNull();
  });
  it("Bắt đầu lại đưa chuỗi rỗng lên (LessonPractice lưu {text:\"\"} để xoá bản chữ cũ)", async () => {
    await render();
    await sendOnce("one two");
    await sendOnce("three four");
    vi.stubGlobal("confirm", vi.fn(() => true));
    await click(button(/Bắt đầu lại/));
    expect(onAnswer).toHaveBeenLastCalledWith("");
  });
});
