"use client";

import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";
import {
  PenTool, RefreshCw, RotateCcw, QrCode, X, Download,
  PanelLeftOpen, PanelLeftClose, Lock, Unlock,
  FileImage, FileText, ChevronLeft, ChevronRight, Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import dynamic from "next/dynamic";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { formatVN } from "@/lib/datetime";
import WhiteboardCanvas from "./WhiteboardCanvas";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const QRCode = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white p-3 rounded-lg border border-token" style={{ width: 200, height: 200 }} />
    ),
  },
);

interface WhiteboardMeta {
  id: string;
  code: string;
  title: string;
  status: string;
  kioskMode?: boolean;
}

interface WhiteboardHistoryItem {
  id: string;
  code: string;
  title: string;
  status: string;
  createdAt: string;
  kioskMode?: boolean;
}

interface WhiteboardProps {
  onExit?: () => void;
}

export default function Whiteboard({ onExit }: WhiteboardProps) {
  const [current, setCurrent] = useState<WhiteboardMeta | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrPanelOpen, setQrPanelOpen] = useState(true);
  const [menuHidden, setMenuHidden] = useState(true);
  const [history, setHistory] = useState<WhiteboardHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [title, setTitle] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);

  // B — annotate tài liệu: chọn chế độ + upload trang lúc TẠO (chưa hỗ trợ
  // đổi mode/thêm trang sau khi đã tạo — giữ phạm vi gọn cho P1).
  const [mode, setMode] = useState<"blank" | "document">("blank");
  const [uploadedPages, setUploadedPages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // C — kiosk/triển lãm: set 1 lần lúc tạo, không đổi lại sau (giữ phạm vi
  // gọn như document mode). Bật thì tab khách tự xoá bảng khi im lặng lâu.
  const [kioskMode, setKioskMode] = useState(false);

  // Trang đang xem (chế độ tài liệu) — cập nhật qua callback onPageInfo của
  // WhiteboardCanvas, đồng bộ 2 chiều với SSE `doc.page.changed`.
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isChangingPage, setIsChangingPage] = useState(false);

  useEffect(() => {
    if (!current) return;
    if (menuHidden) document.body.classList.add("board-immersive");
    else document.body.classList.remove("board-immersive");
    return () => {
      document.body.classList.remove("board-immersive");
    };
  }, [current, menuHidden]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    if (mode === "document" && uploadedPages.length === 0) {
      toast.error("Vui lòng tải lên ít nhất 1 trang tài liệu");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch(apiUrl("/api/instructor/teaching-tools/whiteboards"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          ...(mode === "document" ? { pages: uploadedPages } : {}),
          ...(kioskMode ? { kioskMode: true } : {}),
        }),
      });
      if (!res.ok) {
        toast.error((await res.json()).error || "Lỗi tạo whiteboard");
        return;
      }
      const created = await res.json();
      setCurrent({
        id: created.id,
        code: created.code,
        title: created.title,
        status: created.status,
        kioskMode: created.kioskMode,
      });
      setTitle("");
      setUploadedPages([]);
      setMode("blank");
      setKioskMode(false);
      toast.success("Whiteboard tạo thành công");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsCreating(false);
    }
  };

  // Upload 1 trang (ảnh hoặc canvas đã rasterize từ PDF) → trả về URL public.
  const uploadPageBlob = async (blob: Blob, filename: string): Promise<string> => {
    const form = new FormData();
    form.append("file", blob, filename);
    const res = await fetch(apiUrl("/api/instructor/teaching-tools/whiteboards/pages"), {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("upload_failed");
    const data = await res.json();
    return data.url as string;
  };

  const handleImageFilesSelected = async (files: FileList) => {
    setIsUploading(true);
    const urls: string[] = [];
    const total = files.length;
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ current: i + 1, total });
        const file = files[i]!;
        const url = await uploadPageBlob(file, file.name);
        urls.push(url);
      }
      setUploadedPages((prev) => [...prev, ...urls]);
    } catch {
      toast.error("Lỗi upload ảnh — một số trang có thể chưa tải xong");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handlePdfFileSelected = async (file: File) => {
    setIsUploading(true);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const urls: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        setUploadProgress({ current: i, total: doc.numPages });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfPage: any = await doc.getPage(i);
        const viewport = pdfPage.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob_failed"))), "image/png");
        });
        const url = await uploadPageBlob(blob, `page-${i}.png`);
        urls.push(url);
      }
      setUploadedPages((prev) => [...prev, ...urls]);
    } catch {
      toast.error("Lỗi xử lý PDF — thử lại hoặc tách thành ảnh riêng");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleChangePage = async (page: number) => {
    if (!current || isChangingPage) return;
    setIsChangingPage(true);
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/whiteboards/${current.id}/page`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page }),
      });
      if (!res.ok) toast.error("Không đổi được trang");
      // currentPage tự cập nhật qua SSE doc.page.changed (onPageInfo callback).
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsChangingPage(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(apiUrl("/api/instructor/teaching-tools/whiteboards"));
      if (res.ok) setHistory(await res.json());
    } catch {
      toast.error("Lỗi tải lịch sử");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLoadBoard = (item: WhiteboardHistoryItem) => {
    setCurrent({
      id: item.id,
      code: item.code,
      title: item.title,
      status: item.status,
      kioskMode: item.kioskMode,
    });
  };

  const handleReset = async () => {
    if (!current) return;
    const confirmMsg =
      totalPages > 0
        ? `Xoá toàn bộ nét vẽ trên trang ${currentPage + 1} hiện tại? Không thể hoàn tác.`
        : "Xoá toàn bộ nét vẽ hiện tại để bắt đầu phiên mới? Không thể hoàn tác.";
    if (!confirm(confirmMsg)) return;
    setIsResetting(true);
    try {
      const res = await fetch(
        apiUrl(`/api/instructor/teaching-tools/whiteboards/${current.id}/reset?page=${currentPage}`),
        { method: "POST" },
      );
      if (!res.ok) {
        toast.error("Không thể reset");
        return;
      }
      toast.success("Đã xoá bảng vẽ");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!current) return;
    const nextStatus = current.status === "open" ? "closed" : "open";
    setIsTogglingStatus(true);
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/whiteboards/${current.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        toast.error("Không cập nhật được trạng thái");
        return;
      }
      setCurrent((c) => (c ? { ...c, status: nextStatus } : c));
      toast.success(nextStatus === "closed" ? "Đã đóng whiteboard" : "Đã mở lại whiteboard");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleExportPng = async () => {
    if (!excalidrawApi) return;
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements: excalidrawApi.getSceneElements(),
        appState: excalidrawApi.getAppState(),
        files: excalidrawApi.getFiles(),
        mimeType: "image/png",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${current?.title || "whiteboard"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Không xuất được ảnh");
    }
  };

  const joinUrl = current ? shareUrl(`/whiteboard/${current.code}`) : null;

  // ── Active whiteboard view ──────────────────────────────────────────────
  if (current) {
    const wrapper = isFullscreen
      ? "fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-900"
      : "relative rounded-2xl overflow-hidden border border-token flex flex-col shadow-card";
    return (
      <div className={wrapper} data-whiteboard="container" style={isFullscreen ? undefined : { height: "80vh" }}>
        <header className="relative bg-gradient-to-br from-pink-600 via-rose-600 to-pink-700 text-white px-4 py-3 shrink-0">
          <div className="relative max-w-full mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-90 mb-0.5">
                Whiteboard · GIẢNG VIÊN
              </p>
              <h1 className="text-lg sm:text-xl font-extrabold drop-shadow-sm break-words leading-tight">
                {current.title}
                {current.kioskMode && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/30 backdrop-blur font-semibold align-middle">🖥 Kiosk</span>
                )}
                {current.status === "closed" && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/30 backdrop-blur font-semibold align-middle">Đã đóng</span>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {totalPages > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-white/20 backdrop-blur px-1.5 py-1">
                  <button
                    onClick={() => handleChangePage(currentPage - 1)}
                    disabled={currentPage <= 0 || isChangingPage}
                    className="p-1 rounded-md hover:bg-white/30 disabled:opacity-40"
                    title="Trang trước"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-semibold px-1 tabular-nums">
                    {currentPage + 1}/{totalPages}
                  </span>
                  <button
                    onClick={() => handleChangePage(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1 || isChangingPage}
                    className="p-1 rounded-md hover:bg-white/30 disabled:opacity-40"
                    title="Trang sau"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
              <button
                onClick={() => setMenuHidden((v) => !v)}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur p-2 text-xs font-semibold transition-colors hidden lg:flex"
                title={menuHidden ? "Hiện menu trái" : "Ẩn menu trái"}
              >
                {menuHidden ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
              </button>
              <button
                onClick={() => setQrPanelOpen((v) => !v)}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5"
                title={qrPanelOpen ? "Ẩn khung QR" : "Hiện khung QR"}
              >
                <QrCode size={14} />
                {current.code}
              </button>
              <button
                onClick={handleExportPng}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5"
                title="Xuất ảnh PNG"
              >
                <Download size={14} />
              </button>
              <button
                onClick={handleToggleStatus}
                disabled={isTogglingStatus}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5"
                title={current.status === "open" ? "Đóng whiteboard" : "Mở lại whiteboard"}
              >
                {current.status === "open" ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5"
                title="Xoá toàn bộ nét vẽ, bắt đầu phiên mới"
              >
                <RotateCcw size={14} className={isResetting ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => setIsFullscreen((v) => !v)}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors"
              >
                {isFullscreen ? "⛶ Thoát" : "⛶ Full"}
              </button>
              {onExit && (
                <button
                  onClick={onExit}
                  className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors"
                >
                  ✕ Exit
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="relative flex-1 min-h-0">
          <WhiteboardCanvas
            key={current.id}
            code={current.code}
            authorName="Giáo viên"
            showAuthors
            onReady={setExcalidrawApi}
            onStatusLoaded={(status) => setCurrent((c) => (c ? { ...c, status } : c))}
            onPageInfo={(page, total) => {
              setCurrentPage(page);
              setTotalPages(total);
            }}
          />

          {qrPanelOpen && joinUrl && (
            <div className="absolute bottom-4 left-4 z-10 flex flex-col items-center gap-1 rounded-xl bg-white p-2.5 shadow-2xl ring-2 ring-pink-300 animate-fade-in-up">
              <button
                onClick={() => setQrPanelOpen(false)}
                className="absolute -top-2 -right-2 rounded-full bg-white p-1 shadow ring-1 ring-gray-300 hover:bg-gray-100"
                aria-label="Ẩn khung QR"
              >
                <X size={12} />
              </button>
              <button
                onClick={() => setShowQrModal(true)}
                title="Bấm để phóng to"
                className="rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
              >
                <QRCode value={joinUrl} size={110} level="H" includeMargin />
              </button>
              <p className="text-sm font-extrabold font-mono tracking-[0.15em] text-pink-800">{current.code}</p>
            </div>
          )}
        </div>

        {showQrModal && joinUrl && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in-up p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowQrModal(false); }}
          >
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl max-w-md text-center relative">
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-3 right-3 p-2 rounded-lg hover:bg-gray-100"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
              <p className="text-xs uppercase tracking-widest text-gray-600 font-semibold mb-2">Quét để tham gia vẽ</p>
              <div className="inline-block bg-white p-4 rounded-xl ring-2 ring-pink-300">
                <QRCode value={joinUrl} size={280} level="H" includeMargin />
              </div>
              <p className="mt-4 text-4xl font-extrabold font-mono tracking-[0.3em] text-pink-800">{current.code}</p>
              <p className="mt-2 text-sm text-gray-700">
                Hoặc truy cập: <code className="font-mono px-1.5 py-0.5 bg-pink-50 text-pink-900 rounded">/whiteboard/{current.code}</code>
              </p>
              <button
                onClick={async () => {
                  const ok = await copyText(joinUrl);
                  if (ok) toast.success("Đã copy link");
                  else toast.error("Không sao chép được — bạn chọn link rồi copy tay giúp");
                }}
                className="mt-3 text-sm text-pink-700 hover:text-pink-800 font-semibold underline"
              >
                Copy link tham gia
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Create form ──────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-card">
      <header className="relative bg-gradient-to-br from-pink-600 via-rose-600 to-pink-700 text-white px-6 py-6">
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/30 backdrop-blur rounded-xl p-2.5">
              <PenTool size={28} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-90">Whiteboard</p>
              <h2 className="text-xl sm:text-2xl font-extrabold drop-shadow-sm">Tạo bảng vẽ mới</h2>
            </div>
          </div>
          {onExit && (
            <button
              onClick={onExit}
              className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors shrink-0"
            >
              ✕ Exit
            </button>
          )}
        </div>
      </header>

      <div className="p-5 sm:p-6 space-y-5">
        <div className="rounded-2xl bg-slate-50 dark:bg-zinc-800/60 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-zinc-700 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-1.5">
              Tiêu đề
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vd. Sơ đồ tư duy buổi học hôm nay"
              maxLength={120}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-1.5">
              Chế độ
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <label
                className={`flex-1 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                  mode === "blank"
                    ? "border-pink-600 bg-pink-50 ring-1 ring-pink-600"
                    : "border-slate-300 bg-white hover:border-pink-400"
                }`}
              >
                <input
                  type="radio"
                  name="whiteboard-mode"
                  checked={mode === "blank"}
                  onChange={() => setMode("blank")}
                  className="h-4 w-4 accent-pink-600"
                />
                <span className="text-sm font-semibold text-gray-900">Bảng trắng rỗng</span>
              </label>
              <label
                className={`flex-1 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                  mode === "document"
                    ? "border-pink-600 bg-pink-50 ring-1 ring-pink-600"
                    : "border-slate-300 bg-white hover:border-pink-400"
                }`}
              >
                <input
                  type="radio"
                  name="whiteboard-mode"
                  checked={mode === "document"}
                  onChange={() => setMode("document")}
                  className="h-4 w-4 accent-pink-600"
                />
                <span className="text-sm font-semibold text-gray-900">Bảng trắng kèm tài liệu</span>
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 cursor-pointer hover:border-pink-400 transition-colors">
            <input
              type="checkbox"
              checked={kioskMode}
              onChange={(e) => setKioskMode(e.target.checked)}
              className="h-4 w-4 accent-pink-600"
            />
            <span className="text-sm font-medium text-gray-900">
              Chế độ Kiosk / Triển lãm
              <span className="block text-xs font-normal text-gray-600">
                Tự xoá bảng sau {"3 phút"} không ai vẽ — dùng cho màn hình đứng ở booth, không có GV túc trực
              </span>
            </span>
          </label>

          {mode === "document" && (
            <div className="rounded-xl bg-white border border-slate-300 p-3 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-gray-800 hover:border-pink-400 hover:text-pink-700 disabled:opacity-50"
                >
                  <FileImage size={14} /> Tải ảnh (nhiều trang)
                </button>
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-gray-800 hover:border-pink-400 hover:text-pink-700 disabled:opacity-50"
                >
                  <FileText size={14} /> Tải PDF
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.length) handleImageFilesSelected(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePdfFileSelected(file);
                    e.target.value = "";
                  }}
                />
              </div>

              {isUploading && (
                <p className="text-xs text-pink-800 font-semibold">
                  Đang xử lý trang {uploadProgress?.current ?? "…"}/{uploadProgress?.total ?? "…"}...
                </p>
              )}

              {uploadedPages.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-gray-800">{uploadedPages.length} trang đã tải</p>
                    <button
                      type="button"
                      onClick={() => setUploadedPages([])}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Xoá hết
                    </button>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {uploadedPages.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt={`Trang ${i + 1}`}
                        className="h-16 w-auto rounded border border-slate-300 shrink-0"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={isCreating || isUploading}
            className="w-full bg-gradient-to-br from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-semibold py-2.5 rounded-lg shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isCreating ? "Đang tạo..." : (<><PenTool size={16} strokeWidth={2.4} /> Tạo Whiteboard</>)}
          </button>
        </div>

        <div className="pt-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">📋 Whiteboard đã tạo</p>
            <button
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="text-xs font-semibold text-pink-700 dark:text-pink-400 hover:text-pink-900 dark:hover:text-pink-200 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/20 transition-colors"
            >
              <RefreshCw size={12} className={isLoadingHistory ? "animate-spin" : ""} />
              {isLoadingHistory ? "Đang tải..." : "Tải lịch sử"}
            </button>
          </div>
          {history.length === 0 && !isLoadingHistory && (
            <div className="text-center py-6 rounded-xl bg-slate-50 dark:bg-black/10 border border-dashed border-slate-300">
              <p className="text-xs text-gray-600">Bấm &quot;Tải lịch sử&quot; để xem whiteboard cũ</p>
            </div>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2 max-h-72 overflow-y-auto pr-1">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => handleLoadBoard(item)}
                className="text-left rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] ring-1 ring-slate-200 hover:ring-pink-300 bg-white"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.title}</p>
                  <span className="text-[11px] font-mono font-bold text-pink-800 bg-pink-50 px-2 py-0.5 rounded-md shrink-0">
                    {item.code}
                  </span>
                </div>
                <p className="text-[11px] text-gray-700 font-medium">
                  {formatVN(item.createdAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {item.kioskMode && " · 🖥 Kiosk"}
                  {item.status === "closed" && " · 🔒 Đã đóng"}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
