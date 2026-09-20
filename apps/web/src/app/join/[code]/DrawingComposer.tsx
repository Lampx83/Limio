"use client";

import "@excalidraw/excalidraw/index.css";
import { useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import { X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { getClientId } from "@/lib/clientId";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

// Lazy-load (ssr:false): Excalidraw nặng và cần window — chỉ tải khi học viên mở khung vẽ.
const Excalidraw = dynamicImport(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false },
);

const MAX_EXPORT_PX = 1400;

export interface PostedDrawing {
  noteId: string;
  name: string;
}

/**
 * Khung vẽ Draw-it của học viên: vẽ riêng 1 hình → xuất PNG → tải lên → đăng thành note ảnh.
 * Mỗi học viên 1 hình: nếu đã có note của mình (existingNoteId) thì cập nhật note đó thay vì tạo mới.
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

      <div className="min-h-0 flex-1">
        <Excalidraw
          initialData={{ elements: [], appState: { viewBackgroundColor: "#ffffff" } }}
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false } }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-3 py-2">
        <p className="min-w-0 truncate text-sm font-medium text-gray-700">{info ?? (existingNoteId ? "Đăng lại sẽ thay hình cũ của bạn." : "Vẽ xong bấm Đăng hình.")}</p>
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
