"use client";

import { useEffect, useRef, useState } from "react";
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

export default function PdfViewer({
  url,
  title,
  contentItemId,
}: {
  url: string;
  title?: string;
  /**
   * Có thì viewer báo trang đang xem cho bộ đo thời gian đọc bài
   * (`LessonEngagementTracker`). Không có (form giảng viên, Limio-Live) thì im lặng.
   */
  contentItemId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfDoc>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [inView, setInView] = useState(false);

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
        const cssScale = targetWidth / baseViewport.width;
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const viewport = pdfPage.getViewport({ scale: cssScale * dpr });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${targetWidth}px`;
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
  }, [pdfDoc, page, containerWidth]);

  return (
    <div className="flex flex-col items-center gap-3">
      {title && (
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
          <a href={url} target="_blank" rel="noopener noreferrer" className="link font-medium">
            Mở trong tab mới
          </a>
        </div>
      )}

      {!loading && !error && (
        <>
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary btn-sm"
                data-view-keep
              >
                ← Trước
              </button>
              <span className="min-w-[80px] text-center text-sm text-muted">
                Trang {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary btn-sm"
                data-view-keep
              >
                Sau →
              </button>
            </div>
          )}

          <div
            ref={containerRef}
            className="w-full overflow-hidden rounded-xl border border-token shadow-card"
          >
            <canvas
              ref={canvasRef}
              className="mx-auto block max-w-full"
              aria-label={title ?? "PDF"}
            />
          </div>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-faint link"
          >
            Mở PDF trong tab mới
          </a>
        </>
      )}
    </div>
  );
}
