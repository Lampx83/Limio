// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDF_VIEW_EVENT, PDF_VIEW_REQUEST_EVENT, type PdfViewDetail } from "@/lib/pdfViewEvents";
import PdfViewer from "./PdfViewer";

/**
 * PdfViewer báo trang đang xem cho bộ đo thời gian đọc bài
 * (docs/tieu-chi/doc-pdf-theo-trang.md, AC1). pdfjs và IntersectionObserver là đồ giả:
 * thứ cần kiểm là hợp đồng sự kiện, không phải việc vẽ PDF.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 5,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    }),
  }),
}));

type IoCallback = (entries: Array<Record<string, unknown>>) => void;
let ioCallback: IoCallback | null = null;

class FakeIntersectionObserver {
  constructor(cb: IoCallback) {
    ioCallback = cb;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

class FakeResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

let root: Root;
let host: HTMLDivElement;
let events: PdfViewDetail[];
const listener = (e: Event) => events.push((e as CustomEvent<PdfViewDetail>).detail);

/** Khung PDF cao 800px; `visiblePx` là phần đang nằm trong màn hình. */
function intersect(visiblePx: number) {
  act(() => {
    ioCallback?.([
      {
        isIntersecting: visiblePx > 0,
        boundingClientRect: { height: 800 },
        intersectionRect: { height: visiblePx },
      },
    ]);
  });
}

async function mount(contentItemId?: string) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<PdfViewer url="/x.pdf" title="Tài liệu" contentItemId={contentItemId} />);
  });
  // pdfjs nạp bằng import() động: chờ tới khi viewer hiện nút lật trang.
  await act(async () => {
    await vi.waitFor(() => expect(host.textContent).toContain("Trang 1 / 5"));
  });
}

const last = () => events[events.length - 1];

beforeEach(() => {
  events = [];
  ioCallback = null;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  document.addEventListener(PDF_VIEW_EVENT, listener);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.removeEventListener(PDF_VIEW_EVENT, listener);
  vi.unstubAllGlobals();
});

describe("PdfViewer — báo trang cho bộ đo", () => {
  it("tải xong thì báo trang 1 / 5, chưa nằm trong màn hình", async () => {
    await mount("pdf-1");
    expect(last()).toEqual({ contentItemId: "pdf-1", page: 1, totalPages: 5, inView: false });
  });

  it("chỉ coi là đang xem khi khung hiện đủ lớn: ≥ 25% khung hoặc ≥ nửa màn hình", async () => {
    await mount("pdf-1");
    intersect(100); // 12,5% của khung 800px, chưa đủ
    expect(last()?.inView).toBe(false);
    intersect(250); // 31%
    expect(last()?.inView).toBe(true);
    intersect(0);
    expect(last()?.inView).toBe(false);
  });

  it("bấm Sau → thì báo trang mới", async () => {
    await mount("pdf-1");
    const next = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Sau"));
    act(() => next!.click());
    expect(last()).toMatchObject({ page: 2, totalPages: 5 });
  });

  it("bộ đo hỏi lại thì viewer báo lại trạng thái hiện tại", async () => {
    await mount("pdf-1");
    intersect(300);
    events = [];
    act(() => {
      document.dispatchEvent(new Event(PDF_VIEW_REQUEST_EVENT));
    });
    expect(events).toEqual([{ contentItemId: "pdf-1", page: 1, totalPages: 5, inView: true }]);
  });

  it("gỡ viewer thì báo totalPages 0 và không còn xem", async () => {
    await mount("pdf-1");
    intersect(300);
    act(() => root.unmount());
    expect(last()).toEqual({ contentItemId: "pdf-1", page: 1, totalPages: 0, inView: false });
    // afterEach gọi unmount lần nữa: dựng lại một root rỗng cho nó.
    root = createRoot(host);
  });

  it("không có contentItemId (form giảng viên, Limio-Live) thì im lặng", async () => {
    await mount(undefined);
    intersect(300);
    expect(events).toEqual([]);
  });
});
