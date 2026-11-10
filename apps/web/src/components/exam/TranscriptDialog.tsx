"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { createPortal } from "react-dom";
import { AUDIO_DIALOG_HINT, VIDEO_DIALOG_HINT, formatBytes } from "@/lib/mediaLimits";

export const TRANSCRIPT_MAX = 20_000;

/**
 * Hộp thoại nhập audio/transcript của trình soạn Đoạn văn (thay cho `window.prompt` chỉ thấy một dòng).
 * - `askAlt`: lúc tải audio lên, hỏi thêm mô tả (bắt buộc).
 * - Không `askAlt`: chỉ sửa transcript của audio đã có (nạp sẵn nội dung).
 * Ô transcript cao sẵn ~12 dòng (≥ 8 dòng trên điện thoại), có đếm ký tự. docs/tieu-chi/bai-doc-anh-audio-xoa-transcript.md (AC3).
 */
export default function TranscriptDialog({
  title,
  media = "audio",
  askAlt = true,
  askUrl = false,
  fileField,
  initialAlt = "",
  initialTranscript = "",
  busy,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  /** Audio hoặc video: đổi chữ trong hộp thoại. */
  media?: "audio" | "video";
  /** Hỏi mô tả (lúc thêm mới). Khi chỉ sửa transcript, truyền `false`. */
  askAlt?: boolean;
  /** Hỏi URL video (dán link). */
  askUrl?: boolean;
  /** Ô chọn tệp (tải lên): nói rõ định dạng và dung lượng cho phép ngay khi mở, kiểm tệp ngay khi chọn. */
  fileField?: { accept: string; file: File | null; error?: string | null; onPick: (f: File | null) => void };
  initialAlt?: string;
  initialTranscript?: string;
  busy?: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (v: { alt: string; transcript: string; url: string }) => void;
  onCancel: () => void;
}) {
  const [alt, setAlt] = useState(initialAlt);
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState(initialTranscript);
  const [mounted, setMounted] = useState(false);
  const firstRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted) firstRef.current?.focus();
  }, [mounted]);
  useEffect(() => setTranscript(initialTranscript), [initialTranscript]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  if (!mounted) return null;

  const fileMissing = !!fileField && !fileField.file;
  const altMissing = askAlt && alt.trim() === "";
  const urlBad = askUrl && !/^https?:\/\/\S+$/i.test(url.trim());
  const noun = media === "video" ? "video" : "audio";
  const tooLong = transcript.length > TRANSCRIPT_MAX;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="transcript-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (fileMissing || altMissing || urlBad || tooLong || busy) return;
          onSubmit({ alt: alt.trim(), transcript, url: url.trim() });
        }}
        className="flex max-h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-xl border border-token bg-[rgb(var(--surface))] p-4 shadow-xl sm:p-5"
      >
        <h3 className="text-h4">{title}</h3>
        {fileField && (
          <div className="rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3" data-testid="media-file-field">
            <p className="text-sm font-medium">{media === "video" ? VIDEO_DIALOG_HINT : AUDIO_DIALOG_HINT}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-1.5 text-sm font-medium hover:bg-white disabled:opacity-50"
              >
                <Upload size={15} aria-hidden /> {fileField.file ? "Chọn tệp khác" : `Chọn tệp ${noun}`}
              </button>
              {fileField.file && (
                <span className="min-w-0 text-sm" data-testid="media-file-info">
                  <span className="break-all font-medium">{fileField.file.name}</span> · {formatBytes(fileField.file.size)}
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={fileField.accept}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = ""; // chọn lại cùng tệp vẫn báo
                fileField.onPick(f);
              }}
            />
            {fileField.error && (
              <p role="alert" className="mt-2 text-sm font-medium text-red-700" data-testid="media-file-error">
                {fileField.error}
              </p>
            )}
          </div>
        )}
        {askUrl && (
          <label className="block">
            <span className="block text-sm font-medium">Link video (bắt buộc)</span>
            <input
              ref={(el) => {
                if (askUrl) firstRef.current = el;
              }}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=…"
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            />
            <span className="mt-0.5 block text-xs text-faint">
              Hỗ trợ YouTube, Vimeo, Google Drive (đặt quyền "Anyone with the link"), OneDrive (link Embed) hoặc link tệp .mp4/.webm.
            </span>
            {url.trim() !== "" && urlBad && <span className="mt-0.5 block text-xs text-red-700">Link phải bắt đầu bằng http:// hoặc https://</span>}
          </label>
        )}
        {askAlt && (
          <label className="block">
            <span className="block text-sm font-medium">Mô tả {noun} (bắt buộc)</span>
            <input
              ref={(el) => {
                if (askAlt && !askUrl) firstRef.current = el;
              }}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              maxLength={500}
              placeholder={media === "video" ? "Ví dụ: Cô giáo hướng dẫn cách phát âm thanh mẫu" : "Ví dụ: Hội thoại giữa hai người bạn ở quán cà phê"}
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            />
            <span className="mt-0.5 block text-xs text-faint">Dùng cho người khiếm thị và khi cần đối chiếu; không phải nội dung đáp án.</span>
          </label>
        )}
        <label className="block">
          <span className="block text-sm font-medium">Transcript (tuỳ chọn)</span>
          <textarea
            ref={(el) => {
              if (!askAlt && !askUrl) firstRef.current = el;
            }}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={12}
            placeholder={`Dán hoặc gõ lời thoại của ${noun}. Mỗi đoạn cách nhau một dòng trống để học viên thấy đánh số ①②…`}
            className="mt-1 min-h-[12rem] w-full resize-y rounded border border-default px-3 py-2 text-sm leading-relaxed"
          />
          <span className={`mt-0.5 flex justify-between text-xs ${tooLong ? "font-medium text-red-700" : "text-faint"}`}>
            <span>Học viên tự bấm mở khi luyện; trong lúc thi thử có giờ thì không hiện.</span>
            <span>
              {transcript.length.toLocaleString("vi-VN")} / {TRANSCRIPT_MAX.toLocaleString("vi-VN")}
            </span>
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-token px-3 py-1.5 text-sm hover:bg-[rgb(var(--surface-muted))] disabled:opacity-50">
            Huỷ
          </button>
          <button type="submit" disabled={fileMissing || altMissing || urlBad || tooLong || busy} className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? "Đang lưu…" : submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
