// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));

import LessonCompletionPrompt from "./LessonCompletionPrompt";

/** Hoàn thành bài theo Bài luyện (docs/tieu-chi/hoan-thanh-bai-theo-bai-luyen.md). */

const base = {
  requireVideoWatch: false,
  videoThresholdPct: 80,
  requireAllActivities: false,
  pendingActivityCount: 0,
  totalActivityCount: 0,
  requireScrollToEnd: false,
  requireListen: false,
  listenThresholdPct: 80,
};

let host: HTMLDivElement;
let root: Root;
let completeCalls: Array<{ url: string; body: unknown }>;

beforeEach(() => {
  completeCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      completeCalls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify({ courseCompleted: false }), { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
  // Cột mốc cuối trang: giả IntersectionObserver báo đã thấy ngay.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {}
      observe() {
        this.cb([{ isIntersecting: true }]);
      }
      disconnect() {}
    },
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function render(autoComplete: Parameters<typeof LessonCompletionPrompt>[0]["autoComplete"], withSentinel = false) {
  if (withSentinel) {
    const s = document.createElement("div");
    s.id = "lesson-end-sentinel";
    document.body.appendChild(s);
  }
  await act(async () => {
    root.render(<LessonCompletionPrompt lessonId="l1" courseSlug="c" initiallyCompleted={false} autoComplete={autoComplete} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

const text = () => host.textContent ?? "";

describe("LessonCompletionPrompt — Bài luyện", () => {
  it("còn câu chưa kiểm tra: chưa gọi /complete, chip hiện 'Bài luyện 2/5' và thanh tiến độ 40%", async () => {
    await render({ ...base, requirePractice: true, practiceTotal: 5, practiceChecked: 2 });
    expect(completeCalls).toHaveLength(0);
    expect(text()).toContain("Bài luyện");
    expect(text()).toContain("2/5");
    expect(host.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("40");
  });

  it("kiểm tra đủ mọi câu: tự hoàn thành một lần, lý do all_activities_completed", async () => {
    await render({ ...base, requirePractice: true, practiceTotal: 5, practiceChecked: 5 });
    expect(completeCalls).toHaveLength(1);
    expect(completeCalls[0]!.url).toContain("/api/lessons/l1/complete");
    expect(completeCalls[0]!.body).toEqual({ reason: "all_activities_completed" });
  });

  it("còn hoạt động chưa nộp thì cả hai điều kiện phải đủ mới hoàn thành", async () => {
    await render({ ...base, requirePractice: true, practiceTotal: 3, practiceChecked: 3, requireAllActivities: true, pendingActivityCount: 1, totalActivityCount: 2 });
    expect(completeCalls).toHaveLength(0);
  });

  it("không hồi quy: bài không có Bài luyện vẫn xong khi cuộn hết trang (scrolled_to_end)", async () => {
    await render({ ...base, requireScrollToEnd: true }, true);
    expect(completeCalls).toHaveLength(1);
    expect(completeCalls[0]!.body).toEqual({ reason: "scrolled_to_end" });
    document.getElementById("lesson-end-sentinel")?.remove();
  });

  it("bài có Bài luyện chưa đủ: cuộn tới cuối trang không làm bài xong (máy chủ đã bỏ điều kiện cuộn, chỉ còn Bài luyện)", async () => {
    await render({ ...base, requirePractice: true, practiceTotal: 2, practiceChecked: 1, requireScrollToEnd: false }, true);
    expect(completeCalls).toHaveLength(0);
    document.getElementById("lesson-end-sentinel")?.remove();
  });
});
