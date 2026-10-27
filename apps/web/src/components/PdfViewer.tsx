"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import {
  PDF_VIEW_EVENT,
  PDF_VIEW_REQUEST_EVENT,
  type PdfViewDetail,
} from "@/lib/pdfViewEvents";

// pdfjs-dist is a large client-only library — dynamically imported to keep it
// out of the server bundle. The worker is served from /pdf.worker.min.mjs
// (copied into public/ from node_modules at install time).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDoc = any;

/** Khung PDF phải hiện bằng ngần này (so với chính nó) mới coi là đang đọc. */
const IN_VIEW_FRACTION = 0.25;
/** Chiều cao thanh điều khiển khi toàn màn hình, trừ ra để trang PDF vừa khít phần còn lại. */
const FS_BAR_PX = 64;

export default function PdfViewer({
  url,
  title,
  contentItemId,
  lessonId,
}: {
  url: string;
  title?: string;
  /**
   * Có thì viewer báo trang đang xem cho bộ đo thời gian đọc bài
   * (`LessonEngagementTracker`). Không có (form giảng viên, Limio-Live) thì im lặng.
   */
  contentItemId?: string;
  /** Cùng với `contentItemId`: ghi lại việc học viên bấm mở PDF ở tab mới (AC6). */
  lessonId?: string;
}) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfDoc>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [inView, setInView] = useState(false);
  const [fsSupported, setFsSupported] = useState(false);
  const [isFs, setIsFs] = useState(false);
  // Cao màn hình khi đang toàn màn hình (0 = không). Để trang vừa khít cả chiều cao.
  const [fsHeight, setFsHeight] = useState(0);

  // Ghi việc mở PDF ở tab mới. Đo lường không bao giờ được làm chậm hay chặn việc mở
  // tab: keepalive để sống qua cú chuyển tab, không chờ, nuốt mọi lỗi — cùng nguyên
  // tắc với RemediationLink. Link vẫn là thẻ <a> thường nên mở được cả khi JS hỏng.
  function recordOpen() {
    if (!contentItemId || !lessonId) return;
    try {
      void fetch(apiUrl(`/api/lessons/${lessonId}/pdf-opened`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Never let instrumentation break navigation.
    }
  }
  // Bấm chuột giữa không bắn onClick mà bắn auxclick; vẫn là mở tab mới.
  const onAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) recordOpen();
  };

  // Toàn màn hình: chỉ hiện nút khi trình duyệt hỗ trợ (iPhone Safari thì không). Quyết
  // định ở effect chứ không lúc render để khỏi lệch giữa máy chủ và máy khách.
  useEffect(() => {
    setFsSupported(
      !!document.fullscreenEnabled && typeof HTMLElement.prototype.requestFullscreen === "function",
    );
  }, []);

  useEffect(() => {
    const sync = () => {
      const on = !!viewerRef.current && document.fullscreenElement === viewerRef.current;
      setIsFs(on);
      setFsHeight(on ? window.innerHeight : 0);
    };
    document.addEventListener("fullscreenchange", sync);
    window.addEventListener("resize", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      window.removeEventListener("resize", sync);
      // Gỡ viewer khi đang toàn màn hình (đổi bài bằng phím tắt...): trả màn hình lại.
      if (viewerRef.current && document.fullscreenElement === viewerRef.current) {
        void document.exitFullscreen?.()?.catch?.(() => {});
      }
    };
  }, []);

  function enterFullscreen() {
    try {
      void Promise.resolve(viewerRef.current?.requestFullscreen?.()).catch(() => {});
    } catch {
      // Trình duyệt từ chối: trang giữ nguyên.
    }
  }
  function exitFullscreen() {
    try {
      void Promise.resolve(document.exitFullscreen?.()).catch(() => {});
    } catch {
      // Đã thoát rồi.
    }
  }

  // ← / → đổi trang khi toàn màn hình (Esc do trình duyệt lo).
  useEffect(() => {
    if (!isFs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setPage((p) => Math.min(totalPages, p + 1));
      else if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFs, totalPages]);

  // Track container width to scale pages responsively (fit-to-width).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, error]);

  // Khung PDF có nằm trong màn hình không. Bài có chữ ở trên và PDF ở cuối: em
  // đang đọc chữ thì không tính là đang đọc trang PDF. Bài tính "đủ lớn" theo
  // phần của chính khung, hoặc nửa màn hình nếu trang PDF cao hơn cả màn hình
  // (khi đó không bao giờ phủ nổi 25% của nó).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !contentItemId || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const need = Math.min(
          entry.boundingClientRect.height * IN_VIEW_FRACTION,
          window.innerHeight * 0.5,
        );
        setInView(entry.isIntersecting && entry.intersectionRect.height >= need && need > 0);
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      setInView(false);
    };
  }, [loading, error, contentItemId]);

  // Báo bộ đo thời gian đọc. Ref giữ trạng thái mới nhất để hai nơi bắn (effect
  // dưới và lời hỏi "ai đang có PDF?") cùng nói một điều.
  const detailRef = useRef<PdfViewDetail | null>(null);
  useEffect(() => {
    if (!contentItemId) return;
    const publish = () => {
      if (detailRef.current) {
        document.dispatchEvent(new CustomEvent<PdfViewDetail>(PDF_VIEW_EVENT, { detail: detailRef.current }));
      }
    };
    detailRef.current = { contentItemId, page, totalPages, inView: inView && !error };
    publish();
    document.addEventListener(PDF_VIEW_REQUEST_EVENT, publish);
    return () => document.removeEventListener(PDF_VIEW_REQUEST_EVENT, publish);
  }, [contentItemId, page, totalPages, inView, error]);

  // Gỡ viewer (đổi bài, đóng): báo "không còn xem" để bộ đo thôi cộng giây.
  useEffect(() => {
    if (!contentItemId) return;
    return () => {
      document.dispatchEvent(
        new CustomEvent<PdfViewDetail>(PDF_VIEW_EVENT, {
          detail: { contentItemId, page: 1, totalPages: 0, inView: false },
        }),
      );
    };
  }, [contentItemId]);

  // Load pdfjs and the PDF document whenever url changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setTotalPages(0);
    setPage(1);

    import("pdfjs-dist")
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        return lib.getDocument(url).promise;
      })
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Render the current page onto the canvas whenever the doc or page changes.
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const canvas = canvasRef.current;
    let cancelled = false;

    pdfDoc
      .getPage(page)
      .then((pdfPage: PdfDoc) => {
        if (cancelled || !canvas) return;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const targetWidth = containerWidth > 0 ? containerWidth : baseViewport.width;
        let cssScale = targetWidth / baseViewport.width;
        // Toàn màn hình: vừa khít cả chiều cao còn lại sau thanh điều khiển.
        if (fsHeight > FS_BAR_PX) {
          cssScale = Math.min(cssScale, (fsHeight - FS_BAR_PX) / baseViewport.height);
        }
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const viewport = pdfPage.getViewport({ scale: cssScale * dpr });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${baseViewport.width * cssScale}px`;
        canvas.style.height = `${baseViewport.height * cssScale}px`;
        const ctx = canvas.getContext("2d")!;
        return pdfPage.render({ canvasContext: ctx, viewport }).promise;
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof Error && e.name === "RenderingCancelledException") return;
        setError(String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, page, containerWidth, fsHeight]);

  const pageLabel = (
    <span className="min-w-[80px] text-center text-sm text-muted">
      Trang {page} / {totalPages}
    </span>
  );
  const prevBtn = (
    <button
      type="button"
      onClick={() => setPage((p) => Math.max(1, p - 1))}
      disabled={page <= 1}
      className="btn-secondary btn-sm"
      data-view-keep
    >
      ← Trước
    </button>
  );
  const nextBtn = (
    <button
      type="button"
      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
      disabled={page >= totalPages}
      className="btn-secondary btn-sm"
      data-view-keep
    >
      Sau →
    </button>
  );

  return (
    <div
      ref={viewerRef}
      className={
        isFs
          ? "flex h-full w-full flex-col items-center bg-[rgb(var(--surface))]"
          : "flex flex-col items-center gap-3"
      }
    >
      {title && !isFs && (
        <p className="self-start inline-flex items-center gap-2 text-sm font-medium text-muted">
          <span>📄</span>
          {title}
        </p>
      )}

      {loading && (
        <div className="flex h-48 w-full items-center justify-center rounded-xl border border-token bg-[rgb(var(--surface))]">
          <p className="text-sm text-muted">Đang tải PDF...</p>
        </div>
      )}

      {error && (
        <div className="w-full rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          Không thể tải PDF.{" "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="link font-medium"
            onClick={recordOpen}
            onAuxClick={onAuxClick}
          >
            Mở trong tab mới
          </a>
        </div>
      )}

      {!loading && !error && (
        <>
          {isFs ? (
            // Toàn màn hình chỉ còn: Thoát, Trước/Sau, số trang. Không tiêu đề, không link.
            <div
              className="flex w-full shrink-0 items-center justify-center gap-3 px-4"
              style={{ height: FS_BAR_PX }}
            >
              {totalPages > 1 && prevBtn}
              {pageLabel}
              {totalPages > 1 && nextBtn}
              <button
                type="button"
                onClick={exitFullscreen}
                className="btn-secondary btn-sm ml-4"
                data-view-keep
              >
                Thoát toàn màn hình
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {totalPages > 1 && (
                <>
                  {prevBtn}
                  {pageLabel}
                  {nextBtn}
                </>
              )}
              {fsSupported && (
                <button
                  type="button"
                  onClick={enterFullscreen}
                  className="btn-secondary btn-sm"
                  data-view-keep
                >
                  Toàn màn hình
                </button>
              )}
            </div>
          )}

          <div
            ref={containerRef}
            className={
              isFs
                ? "flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden"
                : "w-full overflow-hidden rounded-xl border border-token shadow-card"
            }
          >
            <canvas
              ref={canvasRef}
              className="mx-auto block max-w-full"
              aria-label={title ?? "PDF"}
            />
          </div>

          {!isFs && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-faint link"
              onClick={recordOpen}
              onAuxClick={onAuxClick}
            >
              Mở PDF trong tab mới
            </a>
          )}
        </>
      )}
    </div>
  );
}
