"use client";

import { useEffect, useRef, useState } from "react";

// pdfjs-dist is a large client-only library — dynamically imported to keep it
// out of the server bundle. The worker is served from /pdf.worker.min.mjs
// (copied into public/ from node_modules at install time).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDoc = any;

export default function PdfViewer({
  url,
  title,
}: {
  url: string;
  title?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfDoc>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const viewport = pdfPage.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
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
  }, [pdfDoc, page]);

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
          <div className="w-full overflow-auto rounded-xl border border-token shadow-card">
            <canvas
              ref={canvasRef}
              className="mx-auto block"
              aria-label={title ?? "PDF"}
            />
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary btn-sm"
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
              >
                Sau →
              </button>
            </div>
          )}

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
