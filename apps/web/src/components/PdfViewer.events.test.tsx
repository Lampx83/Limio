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

const pdf = vi.hoisted(() => ({ numPages: 5 }));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: pdf.numPages,
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

async function mount(contentItemId?: string, lessonId?: string) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <PdfViewer url="/x.pdf" title="Tài liệu" contentItemId={contentItemId} lessonId={lessonId} />,
    );
  });
  // pdfjs nạp bằng import() động: chờ tới khi viewer hiện nút lật trang.
  await act(async () => {
    await vi.waitFor(() => expect(host.querySelector("canvas")).not.toBeNull());
  });
}

const last = () => events[events.length - 1];

beforeEach(() => {
  pdf.numPages = 5;
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

describe("PdfViewer — ghi việc mở ở tab mới (AC6)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let prevented: boolean[];
  const onClick = (e: Event) => {
    prevented.push(e.defaultPrevented);
    e.preventDefault(); // jsdom không điều hướng; chỉ để khỏi báo "not implemented"
  };

  beforeEach(() => {
    prevented = [];
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    document.addEventListener("click", onClick);
  });
  afterEach(() => document.removeEventListener("click", onClick));

  const openLink = () =>
    [...host.querySelectorAll("a")].find((a) => a.textContent?.includes("tab mới"))!;

  it("bấm link thì gửi yêu cầu nền (keepalive) kèm id bài và id khối, không chặn việc mở tab", async () => {
    await mount("pdf-1", "lesson-1");
    act(() => openLink().click());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/lessons/lesson-1/pdf-opened");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(String(init.body))).toEqual({ contentItemId: "pdf-1" });
    // Link vẫn là <a target=_blank> thường, và không bị gọi preventDefault trước khi tới trình duyệt.
    expect(openLink().getAttribute("target")).toBe("_blank");
    expect(prevented).toEqual([false]);
  });

  it("lỗi mạng bị nuốt, không ném ra ngoài", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await mount("pdf-1", "lesson-1");
    expect(() => act(() => openLink().click())).not.toThrow();
  });

  it("fetch ném lỗi đồng bộ cũng không làm hỏng việc bấm", async () => {
    fetchMock.mockImplementation(() => {
      throw new Error("boom");
    });
    await mount("pdf-1", "lesson-1");
    expect(() => act(() => openLink().click())).not.toThrow();
    expect(prevented).toEqual([false]);
  });

  it("thiếu id (form giảng viên, Limio-Live) thì không gửi gì", async () => {
    await mount(undefined, undefined);
    act(() => openLink().click());
    await mount("pdf-1", undefined); // thiếu lessonId
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("PdfViewer — toàn màn hình (AC7)", () => {
  let fsElement: Element | null;
  let requestFullscreen: ReturnType<typeof vi.fn>;
  let exitFullscreen: ReturnType<typeof vi.fn>;

  function setFullscreen(el: Element | null) {
    fsElement = el;
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
  }
  const fsButton = () =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Toàn màn hình"));
  const exitButton = () =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Thoát toàn màn hình"));

  beforeEach(() => {
    fsElement = null;
    requestFullscreen = vi.fn(async function (this: Element) {
      return undefined;
    });
    exitFullscreen = vi.fn(async () => undefined);
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fsElement });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    // Khung rộng 2000px, trang PDF giả 100x100 -> vừa chiều ngang sẽ cao 2000px.
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 2000 });
  });
  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).fullscreenEnabled;
    delete (document as unknown as Record<string, unknown>).fullscreenElement;
    delete (document as unknown as Record<string, unknown>).exitFullscreen;
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).requestFullscreen;
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  });

  it("bấm nút thì cả vùng xem (có thanh Trước/Sau) vào toàn màn hình", async () => {
    await mount("pdf-1", "lesson-1");
    act(() => fsButton()!.click());
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    const target = requestFullscreen.mock.instances[0] as HTMLElement;
    expect(target.textContent).toContain("Trang 1 / 5");
    expect(target.querySelector("canvas")).not.toBeNull();
  });

  it("đang toàn màn hình: nút đổi thành Thoát; bấm thì gọi exitFullscreen", async () => {
    await mount("pdf-1", "lesson-1");
    act(() => fsButton()!.click());
    setFullscreen(requestFullscreen.mock.instances[0] as Element);
    expect(fsButton()).toBeUndefined();
    act(() => exitButton()!.click());
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("phím ← / → đổi trang chỉ khi đang toàn màn hình, và vẫn báo trang cho bộ đo", async () => {
    await mount("pdf-1", "lesson-1");
    const key = (k: string) =>
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
      });
    key("ArrowRight");
    expect(last()?.page).toBe(1); // chưa toàn màn hình: không bắt phím

    act(() => fsButton()!.click());
    setFullscreen(requestFullscreen.mock.instances[0] as Element);
    intersect(300);
    key("ArrowRight");
    key("ArrowRight");
    expect(last()).toEqual({ contentItemId: "pdf-1", page: 3, totalPages: 5, inView: true });
    key("ArrowLeft");
    expect(last()?.page).toBe(2);
    key("ArrowLeft");
    key("ArrowLeft"); // không lùi quá trang 1
    expect(last()?.page).toBe(1);
  });

  it("toàn màn hình thì trang vừa khít cả chiều cao, thoát thì lại vừa chiều ngang", async () => {
    await mount("pdf-1", "lesson-1");
    const canvas = () => host.querySelector("canvas") as HTMLCanvasElement;
    await act(async () => {
      await vi.waitFor(() => expect(canvas().style.width).toBe("2000px"));
    });
    act(() => fsButton()!.click());
    setFullscreen(requestFullscreen.mock.instances[0] as Element);
    // Cao màn hình 768 trừ chỗ cho thanh điều khiển -> nhỏ hơn 2000 rất nhiều.
    await act(async () => {
      await vi.waitFor(() => expect(parseFloat(canvas().style.width)).toBeLessThan(768));
    });
    setFullscreen(null);
    await act(async () => {
      await vi.waitFor(() => expect(canvas().style.width).toBe("2000px"));
    });
  });

  it("trình duyệt không hỗ trợ thì không hiện nút", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
    await mount("pdf-1", "lesson-1");
    expect(fsButton()).toBeUndefined();
  });

  it("trình duyệt từ chối vào toàn màn hình thì nuốt lỗi", async () => {
    requestFullscreen.mockRejectedValue(new Error("denied"));
    await mount("pdf-1", "lesson-1");
    expect(() => act(() => fsButton()!.click())).not.toThrow();
  });

  it("đang toàn màn hình chỉ còn nút Thoát, Trước/Sau và số trang — bỏ tiêu đề, link tab mới, nút khác", async () => {
    await mount("pdf-1", "lesson-1");
    // Trước khi vào: có tiêu đề, link tab mới, nút Toàn màn hình.
    expect(host.textContent).toContain("Tài liệu");
    expect(host.textContent).toContain("Mở PDF trong tab mới");

    act(() => fsButton()!.click());
    setFullscreen(requestFullscreen.mock.instances[0] as Element);

    const buttons = [...host.querySelectorAll("button")].map((b) => b.textContent?.trim());
    expect(buttons).toHaveLength(3);
    expect(buttons.join("|")).toMatch(/Thoát toàn màn hình/);
    expect(buttons.join("|")).toMatch(/Trước/);
    expect(buttons.join("|")).toMatch(/Sau/);
    expect(host.textContent).toContain("Trang 1 / 5");
    expect(host.textContent).not.toContain("Tài liệu"); // tiêu đề
    expect(host.textContent).not.toContain("tab mới"); // link mở tab mới
    expect(host.querySelectorAll("a")).toHaveLength(0);

    // Thoát: mọi thứ hiện lại.
    setFullscreen(null);
    expect(host.textContent).toContain("Tài liệu");
    expect(host.textContent).toContain("Mở PDF trong tab mới");
    expect(fsButton()).toBeDefined();
  });

  it("PDF 1 trang: toàn màn hình chỉ còn nút Thoát và số trang, không có Trước/Sau", async () => {
    pdf.numPages = 1;
    await mount("pdf-1", "lesson-1");
    expect(fsButton()).toBeDefined(); // nút có cả khi chỉ 1 trang
    act(() => fsButton()!.click());
    setFullscreen(requestFullscreen.mock.instances[0] as Element);
    const buttons = [...host.querySelectorAll("button")].map((b) => b.textContent?.trim());
    expect(buttons).toEqual(["Thoát toàn màn hình"]);
    expect(host.textContent).toContain("Trang 1 / 1");
  });
});
