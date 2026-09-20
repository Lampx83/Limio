"use client";

import "@excalidraw/excalidraw/index.css";
import { useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import { Pencil, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { getClientId } from "@/lib/clientId";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

// Lazy-load (ssr:false): Excalidraw nặng và cần window — chỉ tải khi học viên mở khung vẽ.
const Excalidraw = dynamicImport(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false },
);

const MAX_EXPORT_PX = 1400;

const DEFAULT_COLOR = "#1e1e1e";
const DEFAULT_WIDTH = 2;
const PEN_COLORS = ["#1e1e1e", "#e03131", "#f08c00", "#2f9e44", "#1971c2", "#9c36b5", "#f783ac", "#868e96"];
const PEN_WIDTHS = [
  { label: "Mảnh", value: 1, dot: 6 },
  { label: "Vừa", value: 2, dot: 12 },
  { label: "Đậm", value: 4, dot: 20 },
];

export interface PostedDrawing {
  noteId: string;
  name: string;
}

/**
 * Khung vẽ Draw-it của học viên: vẽ riêng 1 hình → xuất PNG → tải lên → đăng thành note ảnh.
 * Một thiết bị đăng được nhiều hình: mặc định luôn tạo note mới. Chỉ khi học viên bấm sửa 1 hình cụ thể
 * (existingNoteId) mới cập nhật note đó thay vì tạo mới.
 * Mở ra là chọn sẵn bút + có thanh màu lớn ngay trên khung vẽ (palette gốc của Excalidraw quá nhỏ trên điện thoại).
 */
export default function DrawingComposer({
  code,
  initialName,
  existingNoteId,
  onClose,
  onPosted,
}: {
  code: string;
  initialName: string;
  existingNoteId: string | null;
  onClose: () => void;
  onPosted: (posted: PostedDrawing) => void;
}) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  const pickColor = (c: string) => {
    setColor(c);
    apiRef.current?.updateScene({ appState: { currentItemStrokeColor: c } });
    apiRef.current?.setActiveTool({ type: "freedraw" });
  };
  const pickWidth = (w: number) => {
    setWidth(w);
    apiRef.current?.updateScene({ appState: { currentItemStrokeWidth: w } });
    apiRef.current?.setActiveTool({ type: "freedraw" });
  };

  const handleSubmit = async () => {
    const api = apiRef.current;
    if (!api) return;
    if (!name.trim()) {
      setInfo("Vui lòng nhập tên hiển thị");
      return;
    }
    const elements = api.getSceneElements().filter((e) => !e.isDeleted);
    if (elements.length === 0) {
      setInfo("Hãy vẽ gì đó trước khi đăng");
      return;
    }
    setSubmitting(true);
    setInfo(null);
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements,
        appState: { exportBackground: true, viewBackgroundColor: "#ffffff" },
        files: api.getFiles(),
        mimeType: "image/png",
        maxWidthOrHeight: MAX_EXPORT_PX,
      });

      const form = new FormData();
      form.append("file", blob, "drawing.png");
      const up = await fetch(apiUrl(`/api/public/boards/${code}/drawings`), {
        method: "POST",
        headers: { "x-client-id": getClientId() },
        body: form,
      });
      if (up.status === 429) {
        setInfo("Bạn gửi quá nhanh — chờ vài giây rồi thử lại.");
        return;
      }
      if (up.status === 403) {
        const err = (await up.json().catch(() => ({}))).error;
        setInfo(err === "board_closed" ? "Bảng đã đóng." : "Không đăng được hình.");
        return;
      }
      if (up.status === 413) {
        setInfo("Hình quá lớn — hãy vẽ gọn lại.");
        return;
      }
      if (!up.ok) {
        setInfo("Lỗi tải hình lên");
        return;
      }
      const { url } = (await up.json()) as { url: string };

      // Có note cũ của mình → sửa thay hình (1 hình mỗi học viên); không thì tạo note mới.
      const res = existingNoteId
        ? await fetch(apiUrl(`/api/public/boards/${code}/notes/${existingNoteId}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "", attachmentUrl: url, clientId: getClientId() }),
          })
        : await fetch(apiUrl(`/api/public/boards/${code}/notes`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ authorName: name.trim(), content: "", attachmentUrl: url, clientId: getClientId() }),
          });
      if (res.status === 429) {
        setInfo("Bạn gửi quá nhanh — chờ vài giây rồi thử lại.");
        return;
      }
      if (!res.ok) {
        setInfo("Lỗi đăng hình");
        return;
      }
      const note = (await res.json()) as { id: string };
      onPosted({ noteId: existingNoteId ?? note.id, name: name.trim() });
    } catch {
      setInfo("Lỗi mạng");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
        <h2 className="shrink-0 text-base font-bold text-gray-900">✏️ Draw-it</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên hiển thị"
          maxLength={40}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 hover:bg-gray-100" aria-label="Đóng">
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pickColor(c)}
              aria-label={`Màu ${c}`}
              aria-pressed={color === c}
              style={{ backgroundColor: c }}
              className={`h-9 w-9 shrink-0 rounded-full border-2 border-white shadow transition-transform sm:h-10 sm:w-10 ${
                color === c ? "scale-110 ring-4 ring-brand-500" : "ring-1 ring-gray-300"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-sm font-medium text-gray-600">
            <Pencil size={18} aria-hidden />
            Nét bút
          </span>
          {PEN_WIDTHS.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => pickWidth(w.value)}
              aria-label={`Nét ${w.label}`}
              aria-pressed={width === w.value}
              className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-lg ${
                width === w.value ? "bg-brand-100 ring-2 ring-brand-500" : "bg-white ring-1 ring-gray-300"
              }`}
            >
              <span className="rounded-full bg-gray-900" style={{ width: w.dot, height: w.dot }} />
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <Excalidraw
          initialData={{
            elements: [],
            appState: {
              viewBackgroundColor: "#ffffff",
              activeTool: { type: "freedraw", customType: null, locked: false, lastActiveTool: null },
              currentItemStrokeColor: DEFAULT_COLOR,
              currentItemStrokeWidth: DEFAULT_WIDTH,
            },
          }}
          excalidrawAPI={(api) => {
            apiRef.current = api;
            api.setActiveTool({ type: "freedraw" });
          }}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false } }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-3 py-2">
        <p className="min-w-0 truncate text-sm font-medium text-gray-700">{info ?? (existingNoteId ? "Đăng lại sẽ thay hình cũ này của bạn." : "Vẽ xong bấm Đăng hình — bạn có thể đăng nhiều hình.")}</p>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="shrink-0 rounded-lg bg-brand-gradient px-5 py-2 font-semibold text-white shadow transition-all hover:shadow-brand-glow active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? "Đang đăng..." : existingNoteId ? "Cập nhật hình" : "📌 Đăng hình"}
        </button>
      </div>
    </div>
  );
}
