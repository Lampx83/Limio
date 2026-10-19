"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatBytes } from "@/lib/formatBytes";
import { lmsErrorMessage } from "@/lib/lmsErrors";
import {
  LESSON_FILE_MAX_BYTES,
  LESSON_FILE_UPLOAD_ACCEPT,
  validateLessonFileUpload,
} from "@/lib/lessonFile";

export interface UploadedLessonFile {
  url: string;
  originalName: string;
  sizeBytes: number;
  mime: string;
}

const MAX_MB = Math.round(LESSON_FILE_MAX_BYTES / (1024 * 1024));

/**
 * Ô "Tải file lên từ máy" cho tài nguyên File đính kèm — dùng chung cho form
 * Thêm và Sửa. Kiểm cỡ + đuôi ngay ở trình duyệt (cùng hàm với server) để GV
 * không phải chờ gửi xong mới biết bị từ chối.
 */
export default function LessonFileUploadPanel({
  onUploaded,
}: {
  onUploaded: (file: UploadedLessonFile) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    const check = validateLessonFileUpload(file);
    if (!check.ok) {
      setError(
        check.error === "file_too_large"
          ? `File ${formatBytes(file.size)} vượt giới hạn ${MAX_MB} MB.`
          : check.error === "unsupported_media_type"
            ? "Định dạng file này chưa được hỗ trợ."
            : "File rỗng.",
      );
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    let res: Response;
    try {
      res = await fetch(apiUrl("/api/lesson-media/files"), { method: "POST", body: fd });
    } catch (networkErr) {
      setUploading(false);
      console.error("[LessonFileUploadPanel] network error", networkErr);
      setError(lmsErrorMessage("network_error"));
      return;
    }
    setUploading(false);
    if (!res.ok) {
      const ct = res.headers.get("content-type") ?? "";
      const d = ct.includes("application/json")
        ? ((await res.json().catch(() => ({}))) as { error?: string })
        : {};
      // 413 không kèm JSON = reverse proxy chặn trước khi tới Next.js.
      if (res.status === 413 && d.error !== "file_too_large") {
        setError(
          `File ${formatBytes(file.size)} vượt giới hạn tải lên của máy chủ. Liên hệ quản trị viên.`,
        );
        return;
      }
      setError(lmsErrorMessage(d.error ?? "upload_failed", res.status));
      return;
    }
    const data = (await res.json()) as { url: string; sizeBytes: number; mime: string };
    onUploaded({ url: data.url, originalName: file.name, sizeBytes: data.sizeBytes, mime: data.mime });
  }

  return (
    <div className="rounded-lg border border-dashed border-token bg-[rgb(var(--surface-muted))/0.5] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">
        Hoặc tải file lên từ máy
      </p>
      <input
        type="file"
        accept={LESSON_FILE_UPLOAD_ACCEPT}
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          // Cho phép chọn lại đúng file đó sau khi bị từ chối.
          e.target.value = "";
        }}
        className="mt-2 block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:font-medium file:text-brand-700 hover:file:bg-brand-100"
      />
      {uploading && <p className="mt-1 text-xs text-muted">Đang tải lên...</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted">
        <span className="font-semibold uppercase tracking-wide">Tối đa {MAX_MB} MB.</span>{" "}
        Word, PowerPoint, Excel, PDF, OpenDocument, TXT/CSV, ZIP/RAR/7z, ảnh, MP3/M4A.
      </p>
    </div>
  );
}
