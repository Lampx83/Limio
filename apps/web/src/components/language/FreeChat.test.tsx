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
import { parseFreeChatView, type ChatMsg, type PartnerReply, type PartnerSpeech } from "@/lib/freeChatView";

const view = parseFreeChatView({
  freechat: { scenario: "Choose what to take.", partnerRole: "Sam", opening: "What would you take?", targets: ["I'm not sure about that", "not really essential"], maxTurns: 4 },
})!;

let host: HTMLDivElement;
let root: Root;
const send = vi.fn<(h: ChatMsg[], m: string) => Promise<string | PartnerReply>>();
const openingSpeech = vi.fn<() => Promise<PartnerSpeech | null>>();
const transcribe = vi.fn<(t: number, f: File) => Promise<string>>();
const onAnswer = vi.fn<(t: string) => void>();

async function mount(props: { savedText?: string; voiceEnabled?: boolean; animate?: boolean; withSpeech?: boolean } = {}) {
  await act(async () => {
    root.render(
      <FreeChat
        view={view}
        savedText={props.savedText ?? ""}
        preview={false}
        voiceEnabled={props.voiceEnabled ?? true}
        send={send}
        openingSpeech={props.withSpeech ? openingSpeech : undefined}
        transcribe={transcribe}
        onAnswer={onAnswer}
        animate={props.animate ?? false}
      />,
    );
  });
}
/** Mở hội thoại và bấm "Bắt đầu" (các bài kiểm cũ không quan tâm hiệu ứng nên tắt animate). */
async function render(savedText = "", voiceEnabled = true) {
  await mount({ savedText, voiceEnabled });
  if (!savedText) await click(button(/^\s*Bắt đầu\s*$/));
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
  openingSpeech.mockReset();
  transcribe.mockReset();
  vi.stubGlobal("Audio", FakeAudio);
  FakeAudio.instances = [];
  URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`);
  URL.revokeObjectURL = vi.fn();
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
    expect(onAnswer).toHaveBeenLastCalledWith("");
    expect(host.querySelector(".fc-log")).toBeNull(); // về màn Bắt đầu
    await click(button(/^\s*Bắt đầu\s*$/));
    expect(host.querySelectorAll(".fc-msg")).toHaveLength(1);
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

/* ─── Bắt đầu, chữ hiện dần, giọng bạn ảo ───────────────────────────────────── */

class FakeAudio {
  static instances: FakeAudio[] = [];
  src = "";
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  played: string[] = [];
  constructor() {
    FakeAudio.instances.push(this);
  }
  play() {
    this.played.push(this.src);
    return Promise.resolve();
  }
  pause() {}
}
const speech: PartnerSpeech = { audioChunks: [btoa("abc")], contentType: "audio/mpeg" };
// Không phải tệp âm thanh thật: chỉ cần phát ra đúng nguồn blob.
const played = () => FakeAudio.instances.flatMap((a) => a.played).filter((u) => u.startsWith("blob:"));

describe("FreeChat — Bắt đầu, chữ hiện dần và giọng bạn ảo", () => {
  it("chưa bấm Bắt đầu: chỉ có tình huống và nút Bắt đầu, chưa có tin nào, chưa gọi giọng", async () => {
    await mount({ withSpeech: true });
    expect(button(/^\s*Bắt đầu\s*$/)).toBeTruthy();
    expect(host.querySelector(".fc-log")).toBeNull();
    expect(host.querySelector("textarea.fc-input")).toBeNull();
    expect(openingSpeech).not.toHaveBeenCalled();
  });

  it("bấm Bắt đầu: lời mở đầu hiện dần theo nhịp gõ rồi đủ chữ; Gửi khoá cho tới khi gõ xong", async () => {
    vi.useFakeTimers();
    try {
      await mount({ animate: true });
      await click(button(/^\s*Bắt đầu\s*$/));
      const p = () => host.querySelector(".fc-msg[data-role=partner] p")!;
      expect(p().textContent!.length).toBeLessThan("What would you take?".length);
      expect(host.querySelector(".fc-msg[data-typing]")).not.toBeNull();
      await typeIn("I would take my phone");
      expect(button(/^\s*Gửi/).hasAttribute("disabled")).toBe(true);
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(p().textContent).toBe("What would you take?");
      expect(host.querySelector(".fc-msg[data-typing]")).toBeNull();
      expect(button(/^\s*Gửi/).hasAttribute("disabled")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("“Hiện hết” bỏ qua nhịp gõ ngay", async () => {
    vi.useFakeTimers();
    try {
      await mount({ animate: true });
      await click(button(/^\s*Bắt đầu\s*$/));
      await click(button(/Hiện hết/));
      expect(host.querySelector(".fc-msg[data-role=partner] p")!.textContent).toBe("What would you take?");
    } finally {
      vi.useRealTimers();
    }
  });

  it("có giọng: Bắt đầu lấy giọng lời mở đầu rồi phát; Nghe lại phát lại mà không gọi máy chủ lần nữa", async () => {
    openingSpeech.mockResolvedValue(speech);
    await mount({ withSpeech: true });
    await click(button(/^\s*Bắt đầu\s*$/));
    expect(openingSpeech).toHaveBeenCalledTimes(1);
    expect(played()).toHaveLength(1);
    await click(button(/Dừng nghe/)); // đang phát → bấm là dừng
    await click(button(/Nghe lại câu này/));
    expect(played()).toHaveLength(2);
    expect(openingSpeech).toHaveBeenCalledTimes(1);
  });

  it("lượt bạn ảo trả lời kèm giọng: phát đúng giọng đó", async () => {
    openingSpeech.mockResolvedValue(null);
    await mount({ withSpeech: true });
    await click(button(/^\s*Bắt đầu\s*$/));
    send.mockResolvedValueOnce({ text: "Why that?", speech });
    await typeIn("my phone");
    await click(button(/^\s*Gửi/));
    expect(played()).toHaveLength(1);
    expect([...host.querySelectorAll(".fc-msg p")].map((x) => x.textContent)).toEqual(["What would you take?", "my phone", "Why that?"]);
  });

  it("giọng lỗi/không có: vẫn có chữ, không có nút Nghe cho tin đó, không báo lỗi", async () => {
    openingSpeech.mockRejectedValue(new Error("x"));
    await mount({ withSpeech: true });
    await click(button(/^\s*Bắt đầu\s*$/));
    expect(host.querySelector(".fc-msg[data-role=partner] p")!.textContent).toBe("What would you take?");
    expect(host.querySelector("[data-testid=fc-error]")).toBeNull();
    expect(played()).toHaveLength(0);
  });

  it("tắt giọng: Bắt đầu không gọi giọng; bật lại thì Nghe vẫn lấy được lời mở đầu theo yêu cầu", async () => {
    openingSpeech.mockResolvedValue(speech);
    localStorage.setItem("freechat-partner-voice-off", "1");
    await mount({ withSpeech: true });
    await click(button(/^\s*Bắt đầu\s*$/));
    expect(openingSpeech).not.toHaveBeenCalled();
    await click(button(/Nghe lại câu này/));
    expect(openingSpeech).toHaveBeenCalledTimes(1);
    expect(played()).toHaveLength(1);
  });

  it("bấm Nói dừng giọng bạn ảo (không để micro thu lại tiếng loa)", async () => {
    openingSpeech.mockResolvedValue(speech);
    await mount({ withSpeech: true });
    await click(button(/^\s*Bắt đầu\s*$/));
    expect(button(/Dừng nghe/)).toBeTruthy(); // đang đọc: nút loa thành "Dừng"
    await click(button(/Ghi âm lời của bạn/));
    expect(button(/Nghe lại câu này/)).toBeTruthy(); // không còn ở trạng thái "đang đọc"
  });

  it("Bắt đầu lại đưa về màn Bắt đầu; bấm tiếp thì bạn ảo nói lại câu mở đầu", async () => {
    await mount({ savedText: "[Free chat]\nPartner: What would you take?\nLearner: hello\nPartner: Hi!" });
    expect(host.querySelector(".fc-log")).not.toBeNull(); // khôi phục: không đòi bấm Bắt đầu
    vi.stubGlobal("confirm", vi.fn(() => true));
    await click(button(/Bắt đầu lại/));
    expect(host.querySelector(".fc-log")).toBeNull();
    await click(button(/^\s*Bắt đầu\s*$/));
    expect(host.querySelectorAll(".fc-msg")).toHaveLength(1);
  });
});
