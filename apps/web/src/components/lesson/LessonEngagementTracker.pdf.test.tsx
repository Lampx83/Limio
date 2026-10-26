// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDF_VIEW_EVENT, type PdfViewDetail } from "@/lib/pdfViewEvents";
import LessonEngagementTracker from "./LessonEngagementTracker";

/**
 * Đo đọc PDF theo trang ở phía trình duyệt (docs/tieu-chi/doc-pdf-theo-trang.md, AC1).
 * Đồng hồ giả: thời gian chỉ trôi khi test cho nó trôi.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Beat = {
  activeSecDelta: number;
  sessionEnd: boolean;
  pdf?: Array<{
    contentItemId: string;
    totalPages: number;
    lastPage: number;
    dwellSec: Record<string, number>;
  }>;
};

let root: Root;
let host: HTMLDivElement;
let bodies: Beat[];

function setTabVisible(visible: boolean) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (visible ? "visible" : "hidden") });
  document.dispatchEvent(new Event("visibilitychange"));
}

function pdfView(d: Partial<PdfViewDetail> = {}) {
  const detail: PdfViewDetail = { contentItemId: "pdf-1", page: 1, totalPages: 10, inView: true, ...d };
  act(() => {
    document.dispatchEvent(new CustomEvent(PDF_VIEW_EVENT, { detail }));
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Khép lượt đọc (đóng tab) và trả về nhịp cuối đã gửi. */
function endSession(): Beat {
  act(() => {
    window.dispatchEvent(new Event("pagehide"));
  });
  const last = bodies[bodies.length - 1];
  if (!last) throw new Error("không có nhịp nào được gửi");
  return last;
}

beforeEach(() => {
  vi.useFakeTimers();
  bodies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Beat);
      return new Response(null, { status: 204 });
    }),
  );
  // Ép đường fetch (đọc được body) thay cho sendBeacon (Blob).
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: undefined });
  setTabVisible(true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root.render(<LessonEngagementTracker lessonId="lesson-1" />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LessonEngagementTracker — PDF theo trang", () => {
  it("cộng giây cho trang đang mở, đổi trang thì giây trước đó ở lại trang cũ", () => {
    pdfView({ page: 3 });
    advance(12_000);
    pdfView({ page: 4 }); // chốt 12s cho trang 3 TRƯỚC khi nhận trang 4
    advance(5_000);

    const beat = endSession();
    expect(beat.pdf).toEqual([
      { contentItemId: "pdf-1", totalPages: 10, lastPage: 4, dwellSec: { "3": 12, "4": 5 } },
    ]);
    expect(beat.activeSecDelta).toBe(17);
  });

  it("khung PDF ra khỏi màn hình thì không cộng giây", () => {
    pdfView({ page: 2, inView: true });
    advance(4_000);
    pdfView({ page: 2, inView: false });
    advance(20_000);
    pdfView({ page: 2, inView: true });
    advance(3_000);

    const beat = endSession();
    expect(beat.pdf?.[0]?.dwellSec).toEqual({ "2": 7 });
    // Thời gian mở bài vẫn tính đủ: chỉ phần PDF bị loại.
    expect(beat.activeSecDelta).toBe(27);
  });

  it("tab bị ẩn thì không cộng giây", () => {
    pdfView({ page: 1 });
    advance(6_000);
    setTabVisible(false); // chốt sổ một lượt (gửi nhịp)
    advance(60_000);
    setTabVisible(true);
    advance(2_000);

    const beat = endSession();
    const total = bodies.flatMap((b) => b.pdf ?? []).reduce((n, p) => n + (p.dwellSec["1"] ?? 0), 0);
    expect(total).toBe(8);
    expect(beat.activeSecDelta).toBe(2);
  });

  it("giữ phần lẻ dưới 1 giây qua nhịp tự động, không mất dần", () => {
    advance(500);
    pdfView({ page: 1 }); // bắt đầu đo ở 0,5s
    advance(30_000); // nhịp tự động ở 30,0s: PDF mới có 29,5s -> gửi 29, giữ 0,5s
    expect(bodies[0]?.pdf?.[0]?.dwellSec).toEqual({ "1": 29 });

    const last = endSession(); // 0,5s giữ lại + 0,5s mới = đúng 1s
    expect(last.pdf?.[0]?.dwellSec).toEqual({ "1": 1 });
  });

  it("hai PDF được tách riêng, chỉ PDF đang trong màn hình được cộng", () => {
    pdfView({ contentItemId: "pdf-1", page: 1, inView: true });
    pdfView({ contentItemId: "pdf-2", page: 5, totalPages: 3, inView: false });
    advance(9_000);

    const beat = endSession();
    expect(beat.pdf).toEqual([
      { contentItemId: "pdf-1", totalPages: 10, lastPage: 1, dwellSec: { "1": 9 } },
    ]);
  });

  it("PDF đã gỡ thì dừng đo, phần đã dồn vẫn được gửi", () => {
    pdfView({ page: 1 });
    advance(5_000);
    pdfView({ page: 1, totalPages: 0, inView: false }); // viewer gỡ
    advance(20_000);

    const beat = endSession();
    expect(beat.pdf?.[0]?.dwellSec).toEqual({ "1": 5 });
  });

  it("PDF chưa tải xong (totalPages 0 từ đầu) thì không ghi gì", () => {
    pdfView({ page: 1, totalPages: 0, inView: true });
    advance(10_000);
    expect(endSession()).not.toHaveProperty("pdf");
  });

  it("không có PDF nào báo thì nhịp không có trường pdf", () => {
    advance(10_000);
    const beat = endSession();
    expect(beat).not.toHaveProperty("pdf");
  });

  it("nhịp 30 giây mang phần chênh, nhịp sau không gửi lại phần đã gửi", () => {
    pdfView({ page: 7 });
    advance(30_000); // nhịp tự động
    const first = bodies[0];
    expect(first?.sessionEnd).toBe(false);
    expect(first?.pdf?.[0]?.dwellSec).toEqual({ "7": 30 });

    advance(4_000);
    const last = endSession();
    expect(last.pdf?.[0]?.dwellSec).toEqual({ "7": 4 });
  });

  it("PDF quá lớn (vượt trần theo dõi) bị bỏ qua, không làm nhịp bị máy chủ từ chối", () => {
    pdfView({ page: 1, totalPages: 5000 });
    advance(10_000);
    const beat = endSession();
    expect(beat).not.toHaveProperty("pdf");
  });
});
