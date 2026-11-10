// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Hai thành phần nặng thay bằng bản giả ghi lại props để kiểm hành vi của vỏ.
const aiProps: Array<{ active: boolean; ask: { quote: string; nonce: number } | null }> = [];
vi.mock("@/components/AiTutorPanel", () => ({
  default: (p: { active: boolean; ask: { quote: string; nonce: number } | null }) => {
    aiProps.push({ active: p.active, ask: p.ask });
    return <div data-testid="ai">AI {p.active ? "đang hiện" : "ẩn"} {p.ask?.quote ?? ""}</div>;
  },
}));
vi.mock("@/components/LessonActions", () => ({
  LessonNotes: ({ onCount }: { onCount?: (n: number) => void }) => (
    <button type="button" data-testid="notes-add" onClick={() => onCount?.(5)}>
      thêm ghi chú
    </button>
  ),
}));

import LessonFrameShell from "./LessonFrameShell";

let host: HTMLDivElement;
let root: Root;

function setWidth(w: number) {
  Object.defineProperty(window, "innerWidth", { value: w, configurable: true, writable: true });
}
async function render(notesCount = 0) {
  await act(async () => {
    root.render(
      <LessonFrameShell lessonId="l1" notesCount={notesCount} rail={<p>RAIL</p>} railLabel="Bài trong module" railSummary="Bài trong module · 1 / 4" crumbs={<p>CRUMBS</p>} nav={<p>NAV</p>}>
        <main>NỘI DUNG</main>
      </LessonFrameShell>,
    );
  });
}
const panel = () => host.querySelector('aside[aria-label="Trợ giảng AI và ghi chú"]') as HTMLElement;
// Đóng = thuộc tính hidden VÀ lớp `hidden` (lớp `flex` của Tailwind từng đè display:none khiến panel đóng vẫn hiện).
const isOpen = () => !panel().hasAttribute("hidden") && !panel().classList.contains("hidden") && panel().classList.contains("flex");
const openBtn = () => host.querySelector('button[aria-label="Mở trợ giảng AI và ghi chú"]') as HTMLButtonElement | null;
const closeBtn = () => host.querySelector('button[aria-label="Đóng panel"]') as HTMLButtonElement;
const tab = (id: "ai" | "notes") => host.querySelector(`#lesson-panel-tab-${id}`) as HTMLButtonElement;
async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  aiProps.length = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("LessonFrameShell — panel phải theo chiều ngang (AC1)", () => {
  it("từ 1536 px: gắn cố định và mở sẵn", async () => {
    setWidth(1600);
    await render();
    expect(isOpen()).toBe(true);
    expect(host.querySelector(".xl\\:grid-cols-\\[16rem_minmax\\(0\\,1fr\\)_24rem\\]")).not.toBeNull();
    expect(openBtn()).toBeNull();
  });

  it("gốc khung có dấu data-lesson-frame (CSS dùng để ẩn nút nổi 'Về trang chủ' đè lên rail) và nút mở panel nằm cao 32%, không đè nút cuộn", async () => {
    setWidth(1400);
    await render();
    expect(host.querySelector("[data-lesson-frame]")).not.toBeNull();
    expect(openBtn()!.className).toContain("top-[32%]");
    expect(openBtn()!.className).not.toContain("top-1/2");
  });

  it("1280–1535 px: đóng sẵn, có nút mở; mở ra thì thành 3 cột", async () => {
    setWidth(1400);
    await render();
    expect(isOpen()).toBe(false);
    expect(host.querySelector(".xl\\:grid-cols-\\[16rem_minmax\\(0\\,1fr\\)_24rem\\]")).toBeNull();
    await click(openBtn()!);
    expect(isOpen()).toBe(true);
    expect(host.querySelector(".xl\\:grid-cols-\\[16rem_minmax\\(0\\,1fr\\)_24rem\\]")).not.toBeNull();
  });

  it("dưới 1280 px: đóng sẵn; mở ra có nền mờ (ngăn kéo), Esc và bấm nền đều đóng", async () => {
    setWidth(900);
    await render();
    expect(isOpen()).toBe(false);
    await click(openBtn()!);
    expect(isOpen()).toBe(true);
    expect(host.querySelector(".bg-black\\/40")).not.toBeNull();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(isOpen()).toBe(false);
    await click(openBtn()!);
    await click(host.querySelector(".bg-black\\/40")!);
    expect(isOpen()).toBe(false);
  });

  it("ngăn kéo (dưới 1280 px) KHÔNG nhớ trạng thái mở: mở rồi tải lại trang thì vẫn đóng, không ghi gì vào lưu trữ", async () => {
    setWidth(900);
    window.localStorage.setItem("limio:lesson-panel:open:narrow", "1"); // giá trị cũ còn sót từ bản trước phải bị bỏ qua
    await render();
    expect(isOpen()).toBe(false);
    await click(openBtn()!);
    expect(isOpen()).toBe(true);
    expect(window.localStorage.getItem("limio:lesson-panel:open:narrow")).toBe("1"); // không bị ghi lại (giữ nguyên giá trị cũ)
    act(() => root.unmount());
    root = createRoot(host);
    await render();
    expect(isOpen()).toBe(false);
  });

  it("nhớ mở/đóng RIÊNG theo lớp chiều ngang: đóng ở màn rộng không làm đổi mặc định ở màn laptop", async () => {
    setWidth(1600);
    await render();
    await click(closeBtn());
    expect(window.localStorage.getItem("limio:lesson-panel:open:wide")).toBe("0");
    // Mở lại trang ở màn rộng: vẫn đóng (đã nhớ).
    act(() => root.unmount());
    root = createRoot(host);
    await render();
    expect(isOpen()).toBe(false);
    // Đổi sang màn laptop: dùng mặc định của lớp mid (đóng), không bị lẫn lựa chọn của lớp wide.
    setWidth(1400);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(isOpen()).toBe(false);
    expect(window.localStorage.getItem("limio:lesson-panel:open:mid")).toBeNull();
  });

  it("lưu trữ bị chặn thì vẫn chạy bình thường", async () => {
    setWidth(1600);
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await render();
    expect(isOpen()).toBe(true);
    await click(closeBtn());
    expect(isOpen()).toBe(false);
    spy.mockRestore();
    setSpy.mockRestore();
  });
});

describe("LessonFrameShell — hai tab và Hỏi AI (AC2–AC4)", () => {
  it("hai tab; số ghi chú hiện trên tab và cập nhật khi thêm; tab chuyển được bằng mũi tên; tab được nhớ", async () => {
    setWidth(1600);
    await render(2);
    expect(tab("notes").textContent).toBe("Ghi chú · 2");
    expect(tab("ai").getAttribute("aria-selected")).toBe("true");
    await act(async () => {
      host.querySelector('[role="tablist"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(tab("notes").getAttribute("aria-selected")).toBe("true");
    expect(window.localStorage.getItem("limio:lesson-panel:tab")).toBe("notes");
    await click(host.querySelector('[data-testid="notes-add"]')!);
    expect(tab("notes").textContent).toBe("Ghi chú · 5");
  });

  it("đang ở tab Ghi chú: AI không 'active' nhưng vẫn được dựng (giữ hội thoại)", async () => {
    setWidth(1600);
    await render();
    await click(tab("notes"));
    expect(host.querySelector('[data-testid="ai"]')).not.toBeNull();
    expect(aiProps.at(-1)!.active).toBe(false);
    await click(tab("ai"));
    expect(aiProps.at(-1)!.active).toBe(true);
  });

  it("'Hỏi AI' từ vùng bôi đen: mở panel đang đóng, sang tab AI, chuyển đoạn trích xuống AI", async () => {
    setWidth(900);
    await render();
    expect(isOpen()).toBe(false);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("limio:ask-ai", { detail: { quote: "survive là gì" } }));
    });
    expect(isOpen()).toBe(true);
    expect(tab("ai").getAttribute("aria-selected")).toBe("true");
    expect(host.querySelector('[data-testid="ai"]')!.textContent).toContain("survive là gì");
    // Đang ở tab Ghi chú, hỏi lần nữa với cùng đoạn: vẫn kích hoạt (nonce tăng).
    await click(tab("notes"));
    const before = aiProps.at(-1)!.ask!.nonce;
    await act(async () => {
      window.dispatchEvent(new CustomEvent("limio:ask-ai", { detail: { quote: "survive là gì" } }));
    });
    expect(tab("ai").getAttribute("aria-selected")).toBe("true");
    expect(aiProps.at(-1)!.ask!.nonce).toBe(before + 1);
  });

  it("sự kiện không có đoạn trích thì bỏ qua", async () => {
    setWidth(900);
    await render();
    await act(async () => {
      window.dispatchEvent(new CustomEvent("limio:ask-ai", { detail: { quote: "  " } }));
    });
    expect(isOpen()).toBe(false);
  });

  it("chưa mở lần nào thì chưa dựng AI/ghi chú (không gọi API khi chưa cần)", async () => {
    setWidth(1400);
    await render();
    expect(host.querySelector('[data-testid="ai"]')).toBeNull();
    await click(openBtn()!);
    expect(host.querySelector('[data-testid="ai"]')).not.toBeNull();
  });
});
