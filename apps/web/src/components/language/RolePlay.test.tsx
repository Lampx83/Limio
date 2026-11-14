// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Bộ ghi âm giả: "Ghi âm" → đang ghi; "Dừng" → đưa ngay một tệp cho onRecorded (không đụng micro thật).
vi.mock("@/components/useAudioRecorder", async () => {
  const React = await import("react");
  return {
    useAudioRecorder: ({ onRecorded }: { onRecorded: (f: File) => void }) => {
      const [state, setState] = React.useState<"idle" | "recording" | "done">("idle");
      return {
        state,
        seconds: 3,
        error: null,
        previewUrl: null,
        start: async () => setState("recording"),
        stop: () => {
          setState("done");
          onRecorded(new File([new Uint8Array([1, 2])], "x.webm", { type: "audio/webm" }));
        },
      };
    },
  };
});

import RolePlay from "./RolePlay";
import { VoiceUseError } from "./EssayVoiceAnswer";
import { parseRolePlay } from "@/lib/rolePlayView";

const rp = parseRolePlay({
  roleplay: {
    roles: { A: "Khách", B: "Chủ quán" },
    turns: [
      { speaker: "A", text: "Chocolate! It’s good for energy.", audio: "/api/exam-assets/a1.m4a" },
      { speaker: "B", text: "I was thinking the same thing.", audio: "/api/exam-assets/b1.m4a" },
      { speaker: "A", text: "Great, let’s take it." },
    ],
  },
})!;

let host: HTMLDivElement;
let root: Root;
const transcribe = vi.fn<(turn: number, file: File) => Promise<string>>();
const onAnswer = vi.fn<(text: string) => void>();

async function render(savedText = "") {
  await act(async () => {
    root.render(<RolePlay rp={rp} savedText={savedText} transcribe={transcribe} onAnswer={onAnswer} audioUrl={(p) => p} preview={false} />);
  });
}
const text = () => host.textContent?.replace(/\s+/g, " ") ?? "";
const button = (label: RegExp) => [...host.querySelectorAll("button")].find((b) => label.test(b.textContent ?? "") || label.test(b.getAttribute("aria-label") ?? ""))!;
async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  transcribe.mockReset();
  onAnswer.mockReset();
  localStorage.clear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("RolePlay — hội thoại đóng vai", () => {
  it("hiện hai vai (mặc định A đang chọn), cả hội thoại, nút nghe cho lượt của bạn ảo và 'Nghe cả hội thoại'", async () => {
    await render();
    const roles = [...host.querySelectorAll<HTMLButtonElement>(".rp-role")];
    expect(roles.map((r) => r.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
    expect(text()).toContain("Khách");
    expect(text()).toContain("Chủ quán");
    expect(host.querySelectorAll(".rp-turn")).toHaveLength(3);
    expect(button(/Nghe lượt 2/)).toBeTruthy(); // lượt 2 là của B (bạn ảo) có audio
    expect(host.querySelector('[aria-label^="Nghe lượt 1"]')).toBeNull(); // lượt 1 là của mình: không có nút nghe
    expect(button(/Nghe cả hội thoại/)).toBeTruthy();
    expect(host.querySelector(".rp-turn[data-current]")!.getAttribute("aria-label")).toContain("Lượt 1");
  });

  it("ghi âm một lượt → chuyển chữ đúng lượt, so với câu mẫu (đánh dấu từ thiếu, không điểm), đưa bản chữ có số lượt lên onAnswer", async () => {
    transcribe.mockResolvedValue("chocolate it's good for energy");
    await render();
    await click(button(/^\s*Ghi âm/));
    await click(button(/Dừng và kiểm tra/));
    expect(transcribe).toHaveBeenCalledWith(0, expect.any(File));
    expect(text()).toContain("5/5 từ khớp") ; // 5 từ trong câu mẫu "Chocolate! It’s good for energy."
    expect(host.querySelectorAll(".rp-miss")).toHaveLength(0);
    expect(onAnswer).toHaveBeenLastCalledWith("[Role A]\n1. A: chocolate it's good for energy");
    expect(text()).not.toMatch(/\d+\s*điểm|score/i);
    // lượt kế tiếp của mình được nhấn mạnh
    expect(host.querySelector(".rp-turn[data-current]")!.getAttribute("aria-label")).toContain("Lượt 3");
  });

  it("nói thiếu từ thì từ đó bị đánh dấu và liệt kê từ thừa", async () => {
    transcribe.mockResolvedValue("chocolate good really energy");
    await render();
    await click(button(/^\s*Ghi âm/));
    await click(button(/Dừng và kiểm tra/));
    const missed = [...host.querySelectorAll(".rp-miss")].map((e) => e.textContent?.trim());
    expect(missed).toEqual(["It’s", "for"]);
    expect(text()).toContain("thừa/khác: really");
  });

  it("đổi vai: phần đã nói của vai kia được giữ, onAnswer nhận bản chữ của vai mới; đang ghi thì không đổi được", async () => {
    transcribe.mockResolvedValue("chocolate it's good for energy");
    await render();
    await click(button(/^\s*Ghi âm/));
    await click(button(/Dừng và kiểm tra/));
    await click(host.querySelectorAll<HTMLButtonElement>(".rp-role")[1]!);
    expect(host.querySelectorAll<HTMLButtonElement>(".rp-role")[1]!.getAttribute("aria-pressed")).toBe("true");
    expect(onAnswer).toHaveBeenLastCalledWith(""); // vai B chưa nói gì
    expect(host.querySelectorAll("[data-testid=rp-heard]")).toHaveLength(0);
    await click(host.querySelectorAll<HTMLButtonElement>(".rp-role")[0]!);
    expect(host.querySelectorAll("[data-testid=rp-heard]")).toHaveLength(1); // vai A còn nguyên
    expect(onAnswer).toHaveBeenLastCalledWith("[Role A]\n1. A: chocolate it's good for energy");
  });

  it("lỗi chuyển chữ hiện lời nhắn tiếng Việt, ô không bị đánh dấu đã nói, có thể ghi lại", async () => {
    transcribe.mockRejectedValue(new VoiceUseError("no_speech"));
    await render();
    await click(button(/^\s*Ghi âm/));
    await click(button(/Dừng và kiểm tra/));
    expect(host.querySelector("[data-testid=rp-error]")!.textContent).toContain("Không nghe thấy tiếng nói");
    expect(onAnswer).not.toHaveBeenCalled();
    expect(button(/^\s*Ghi âm/)).toBeTruthy();
  });

  it("tải lại trang: phần đã nói được khôi phục đúng vai và đúng lượt từ bản chữ đã lưu", async () => {
    await render("[Role A]\n3. A: great lets take it");
    expect(host.querySelectorAll("[data-testid=rp-heard]")).toHaveLength(1);
    expect(host.querySelectorAll(".rp-turn")[2]!.textContent).toContain("great lets take it");
    expect(host.querySelector(".rp-turn[data-current]")!.getAttribute("aria-label")).toContain("Lượt 1");
  });

  it("'Bỏ qua lượt này' đánh dấu bỏ qua và lượt nhấn mạnh chuyển sang lượt kế; câu hướng dẫn gửi OpenAI hiện tới khi đã dùng một lần", async () => {
    await render();
    expect(text()).toContain("gửi tới OpenAI");
    await click(button(/Bỏ qua lượt này/));
    expect(text()).toContain("Đã bỏ qua");
    expect(host.querySelector(".rp-turn[data-current]")!.getAttribute("aria-label")).toContain("Lượt 3");
  });
});
