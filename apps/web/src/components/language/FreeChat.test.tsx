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

// docs/tieu-chi/limio-language-ban-ao-scaffolding-moc-1.md
describe("FreeChat — scaffolding cho người nói yếu (mốc 1)", () => {
  const scView = parseFreeChatView({
    freechat: {
      scenario: "Choose what to take.",
      partnerRole: "Sam",
      opening: "What would you take?",
      targets: ["I would take…"],
      maxTurns: 4,
      scaffold: {
        ideas: ["Chọn một món và nói vì sao"],
        frames: [
          { en: "I would take ___ because ___.", vi: "Tôi sẽ mang ___ vì ___." },
          { en: "What about you?", vi: "Còn bạn thì sao?" },
        ],
        phrases: [{ en: "take my passport", vi: "mang hộ chiếu" }],
        vocab: [{ en: "passport", vi: "hộ chiếu" }],
        model: { text: "**I would take** my phone **because** it has my photos.", audio: "/api/exam-assets/m.m4a" },
      },
    },
  })!;
  const speech: PartnerSpeech = { audioChunks: ["QUJD"], contentType: "audio/mpeg" };
  const frameSpeech = vi.fn<(i: number) => Promise<PartnerSpeech | null>>();

  async function mountSc(props: { language?: string | null; scaffold?: boolean; withFrameSpeech?: boolean } = {}) {
    frameSpeech.mockReset().mockResolvedValue(speech);
    await act(async () => {
      root.render(
        <FreeChat
          view={props.scaffold === false ? view : scView}
          savedText=""
          preview={false}
          send={send}
          frameSpeech={props.withFrameSpeech === false ? undefined : frameSpeech}
          language={props.language === undefined ? "en" : props.language}
          transcribe={transcribe}
          onAnswer={onAnswer}
          animate={false}
        />,
      );
    });
  }
  const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 5))));
  // Phần chuẩn bị là popup render vào document.body (portal), không nằm trong `host`.
  const dlg = () => document.querySelector<HTMLElement>("[data-testid=fc-prep-dialog]");
  const inDlg = (sel: string) => dlg()?.querySelector<HTMLElement>(sel) ?? null;
  const dlgText = () => dlg()?.textContent?.replace(/\s+/g, " ") ?? "";
  const dlgButton = (label: RegExp) => [...(dlg()?.querySelectorAll("button") ?? [])].find((b) => label.test(b.textContent ?? "") || label.test(b.getAttribute("aria-label") ?? ""))!;
  const frameButtons = () => [...(dlg()?.querySelectorAll<HTMLButtonElement>("button.fc-frame") ?? [])];
  const prepButton = () => host.querySelector<HTMLButtonElement>("[data-testid=fc-prep-open]")!;
  const openPrep = async () => click(prepButton());
  const sel = () => input().value.slice(input().selectionStart, input().selectionEnd);

  it("mọi phiếu có công thức 3 bước; ví dụ tiếng Anh chỉ hiện ở khoá tiếng Anh", async () => {
    await mountSc({ scaffold: false, language: "en" });
    expect(host.querySelector("[data-testid=fc-formula]")!.textContent).toMatch(/Trả lời.*Thêm một lý do hoặc ví dụ.*Hỏi lại/);
    expect(text()).toContain("I prefer cities because");
    await act(async () => root.render(<div />));
    await mountSc({ scaffold: false, language: "zh" });
    expect(host.querySelector("[data-testid=fc-formula]")).not.toBeNull();
    expect(text()).not.toContain("I prefer cities because");
  });

  it("phiếu không scaffold: vẫn là danh sách 'Cụm gợi ý' như cũ, không có nút Chuẩn bị", async () => {
    await mountSc({ scaffold: false });
    expect(text()).toContain("Cụm gợi ý (0/2 đã dùng)");
    expect(prepButton()).toBeNull();
    expect(dlg()).toBeNull();
  });

  it("phiếu có scaffold: trang chỉ có tình huống và nút Chuẩn bị + Bắt đầu; mọi gợi ý nằm trong popup, chưa mở", async () => {
    await mountSc();
    expect(prepButton().textContent).toContain("Chuẩn bị");
    expect(text()).toContain("Bắt đầu");
    expect(dlg()).toBeNull();
    for (const t of ["Mẫu câu", "Cụm từ hữu ích", "Từ vựng", "Ý tưởng", "Đoạn mẫu"]) expect(text()).not.toContain(t);
    expect(host.querySelector("[data-testid=fc-formula]")).toBeNull(); // công thức nằm trong popup
    expect(host.querySelector("[data-testid=fc-tray]")).toBeNull();
  });

  it("bấm Chuẩn bị: popup MỘT section có đủ công thức, đoạn mẫu, ý tưởng, mẫu câu (kèm nghĩa), cụm từ, từ vựng; mẫu câu chưa bấm chèn được trước khi bắt đầu", async () => {
    await mountSc();
    await openPrep();
    const d = dlg()!;
    expect(d.querySelector("[role=dialog]")!.getAttribute("aria-modal")).toBe("true");
    expect(d.querySelector("h2")!.textContent).toBe("Chuẩn bị trước khi nói");
    expect(d.querySelectorAll("[data-testid=fc-prep]")).toHaveLength(1);
    for (const id of ["fc-formula", "fc-model", "fc-ideas", "fc-frames", "fc-words", "fc-vocab"]) expect(inDlg(`[data-testid=${id}]`)).not.toBeNull();
    expect(dlgText()).toContain("Mẫu câu (0/2 đã dùng)");
    expect(dlgText()).toContain("I would take ___ because ___.");
    expect(dlgText()).toContain("Tôi sẽ mang ___ vì ___.");
    expect(frameButtons()).toHaveLength(0);
    expect(inDlg("button[aria-label^='Chèn']")).toBeNull();
  });

  it("đoạn mẫu: audio (đường dẫn qua audioUrl), chữ hiện sẵn với mẫu câu tô sáng (<mark>), ẩn/hiện được", async () => {
    await mountSc();
    await openPrep();
    expect(inDlg("audio.fc-model-audio")!.getAttribute("src")).toBe("/api/exam-assets/m.m4a");
    const marks = [...dlg()!.querySelectorAll("[data-testid=fc-transcript] mark.fc-hl")].map((m) => m.textContent);
    expect(marks).toEqual(["I would take", "because"]);
    expect(inDlg("[data-testid=fc-transcript]")!.textContent).toBe("I would take my phone because it has my photos.");
    await click(dlgButton(/Ẩn chữ/));
    expect(inDlg("[data-testid=fc-transcript]")).toBeNull();
    expect(inDlg("audio.fc-model-audio")).not.toBeNull(); // chỉ ẩn chữ, audio vẫn còn
    await click(dlgButton(/Hiện chữ/));
    expect(inDlg("[data-testid=fc-transcript]")).not.toBeNull();
  });

  it("đoạn mẫu chưa có audio thì chỉ có chữ; chỉ có từ vựng thì popup vẫn mở được", async () => {
    const onlyText = parseFreeChatView({ freechat: { scenario: "S", opening: "O", scaffold: { model: { text: "**Hi** there." }, vocab: [{ en: "x", vi: "y" }] } } })!;
    await act(async () => {
      root.render(<FreeChat view={onlyText} savedText="" preview={false} send={send} transcribe={transcribe} onAnswer={onAnswer} animate={false} />);
    });
    await openPrep();
    expect(inDlg("audio")).toBeNull();
    expect(inDlg("[data-testid=fc-transcript] mark")!.textContent).toBe("Hi");
    expect(inDlg("[data-testid=fc-ideas]")).toBeNull();
    expect(inDlg("[data-testid=fc-vocab]")).not.toBeNull();
  });

  it("đóng popup: nút Đóng (x), phím Esc, bấm nền; tiêu điểm về nút Chuẩn bị; trang cuộn được lại", async () => {
    await mountSc();
    await openPrep();
    expect(document.activeElement).toBe(inDlg("button[aria-label='Đóng']"));
    expect(document.body.style.overflow).toBe("hidden");
    await click(inDlg("button[aria-label='Đóng']")!);
    await settle();
    expect(dlg()).toBeNull();
    expect(document.activeElement).toBe(prepButton());
    expect(document.body.style.overflow).not.toBe("hidden");
    await openPrep();
    await act(async () => {
      inDlg("[role=dialog]")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(dlg()).toBeNull();
    await openPrep();
    await act(async () => {
      dlg()!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); // chính lớp nền
    });
    expect(dlg()).toBeNull();
  });

  it("nút Bắt đầu trong popup: đóng popup và bắt đầu hội thoại (hiện khung chat, khay); nút Chuẩn bị chuyển lên đầu khung chat để mở lại khi bị bí", async () => {
    await mountSc();
    await openPrep();
    await click(dlgButton(/Bắt đầu/));
    expect(dlg()).toBeNull();
    expect(host.querySelector(".fc-log")).not.toBeNull();
    expect(host.querySelector("[data-testid=fc-tray]")).not.toBeNull();
    expect(prepButton().textContent?.trim()).toBe("Chuẩn bị"); // nút ở đầu khung chat để mở lại, không kèm số
  });

  it("gõ đè chỗ trống rồi gửi được; còn chỗ trống ___ thì Gửi và Enter không gửi, báo lỗi, không tốn lượt, lời báo biến mất khi điền xong", async () => {
    await mountSc();
    await click(button(/^\s*Bắt đầu\s*$/));
    await click(button(/Chèn: Well, ___/));
    await settle();
    expect(input().value).toBe("Well, ___");
    await click(button(/^\s*Gửi/));
    await press("Enter");
    expect(send).not.toHaveBeenCalled();
    expect(host.querySelector("[data-testid=fc-error]")!.textContent).toContain("Còn chỗ trống");
    expect(text()).toContain("Lượt 1/4");
    await typeIn("Well, I would take my phone because it has my photos.");
    expect(host.querySelector("[data-testid=fc-error]")).toBeNull();
    send.mockResolvedValueOnce("Why?");
    await click(button(/^\s*Gửi/));
    expect(send).toHaveBeenCalledWith([], "Well, I would take my phone because it has my photos.");
  });

  it("chip khay 'Khi bị bí' chèn đúng; chip có chỗ trống bôi đen chỗ trống", async () => {
    await mountSc();
    await click(button(/^\s*Bắt đầu\s*$/));
    await click(button(/Chèn: Could you say that again\?/));
    await settle();
    expect(input().value).toBe("Could you say that again?");
    await typeIn("");
    await click(button(/Chèn: How can I say ___ in English\?/));
    await settle();
    expect(input().value).toBe("How can I say ___ in English?");
    expect(sel()).toBe("___");
  });

  it("khay 'Khi bị bí' chỉ ở khoá tiếng Anh", async () => {
    await mountSc({ language: "zh" });
    await click(button(/^\s*Bắt đầu\s*$/));
    expect(host.querySelector("[data-testid=fc-tray]")).toBeNull();
    await act(async () => root.render(<div />));
    await mountSc({ language: null });
    await click(button(/^\s*Bắt đầu\s*$/));
    expect(host.querySelector("[data-testid=fc-tray]")).toBeNull();
  });

  it("nghe thử mẫu câu trong popup: gọi frameSpeech(chỉ số), tải một lần mỗi mẫu; lỗi thì ẩn nút của mẫu đó", async () => {
    await mountSc();
    await openPrep();
    const listen = () => [...dlg()!.querySelectorAll<HTMLButtonElement>("button.fc-replay")];
    expect(listen()).toHaveLength(2);
    await click(listen()[0]!);
    await settle();
    expect(frameSpeech).toHaveBeenCalledTimes(1);
    expect(frameSpeech).toHaveBeenCalledWith(0);
    expect(FakeAudio.instances.length).toBeGreaterThan(0);
    await click(listen()[0]!); // đang phát thì bấm là dừng, không gọi lại
    await click(listen()[0]!);
    await settle();
    expect(frameSpeech).toHaveBeenCalledTimes(1);
    frameSpeech.mockResolvedValueOnce(null);
    await click(listen()[1]!);
    await settle();
    expect(frameSpeech).toHaveBeenLastCalledWith(1);
    expect(listen()).toHaveLength(1); // mẫu 1 đọc lỗi: nút biến mất, không báo lỗi
    expect(host.querySelector("[data-testid=fc-error]")).toBeNull();
  });

  it("bị bí giữa chừng: bấm Chuẩn bị ở đầu khung chat mở lại popup (có Đóng, không có Bắt đầu); bấm mẫu câu chèn vào ô, bôi đen chỗ trống đầu tiên, rồi đóng popup", async () => {
    await mountSc();
    await click(button(/^\s*Bắt đầu\s*$/));
    await openPrep();
    expect(dlgButton(/^\s*Bắt đầu\s*$/)).toBeUndefined();
    expect(dlgButton(/^\s*Đóng\s*$/)).toBeDefined();
    expect(frameButtons()).toHaveLength(2);
    await click(frameButtons()[0]!);
    await settle();
    expect(dlg()).toBeNull();
    expect(input().value).toBe("I would take ___ because ___.");
    expect(sel()).toBe("___");
    expect(host.textContent).toContain("Đã chèn vào ô nhập");
  });

  it("còn chỗ trống ___ thì Gửi và Enter không gửi, báo lỗi, không tốn lượt; gõ đè xong gửi được và mẫu câu có ✓ trong popup", async () => {
    await mountSc();
    await click(button(/^\s*Bắt đầu\s*$/));
    await openPrep();
    await click(frameButtons()[0]!);
    await settle();
    await click(button(/^\s*Gửi/));
    await press("Enter");
    expect(send).not.toHaveBeenCalled();
    expect(host.querySelector("[data-testid=fc-error]")!.textContent).toContain("Còn chỗ trống");
    expect(text()).toContain("Lượt 1/4");
    await typeIn("I would take my phone because it has my photos.");
    expect(host.querySelector("[data-testid=fc-error]")).toBeNull();
    send.mockResolvedValueOnce("Why?");
    await click(button(/^\s*Gửi/));
    expect(send).toHaveBeenCalledWith([], "I would take my phone because it has my photos.");
    await openPrep();
    expect(dlgText()).toContain("Mẫu câu (1/2 đã dùng)");
    expect(prepButton().textContent?.trim()).toBe("Chuẩn bị"); // nút không hiện số
  });

  it("bấm cụm từ hữu ích và từ vựng trong popup chèn đúng", async () => {
    await mountSc();
    await click(button(/^\s*Bắt đầu\s*$/));
    await openPrep();
    await click(dlgButton(/Chèn từ: passport/));
    await settle();
    expect(input().value).toBe("passport");
    await openPrep();
    await click(dlgButton(/Chèn cụm từ: take my passport/));
    await settle();
    expect(input().value).toBe("passport take my passport");
  });

  it("chèn từ popup khi bạn ảo còn đang gõ dần vẫn được (popup đóng, ô nhập có chữ)", async () => {
    await act(async () => {
      root.render(<FreeChat view={scView} savedText="" preview={false} send={send} frameSpeech={frameSpeech} language="en" transcribe={transcribe} onAnswer={onAnswer} animate />);
    });
    await click(button(/^\s*Bắt đầu\s*$/));
    expect(host.querySelector(".fc-msg[data-typing]")).not.toBeNull(); // lời mở đầu đang hiện dần
    await openPrep();
    await click(frameButtons()[0]!);
    await settle();
    expect(dlg()).toBeNull();
    expect(input().value).toBe("I would take ___ because ___.");
  });

  it("không truyền frameSpeech thì mẫu câu không có nút nghe", async () => {
    await mountSc({ withFrameSpeech: false });
    await openPrep();
    expect(dlg()!.querySelectorAll("button.fc-replay")).toHaveLength(0);
  });
});
