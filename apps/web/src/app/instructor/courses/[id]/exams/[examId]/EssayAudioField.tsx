"use client";

import { useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { AUDIO_DIALOG_HINT, AUDIO_LIMIT, checkAudioFile } from "@/lib/mediaLimits";

/** Nhãn mô tả (alt) gửi kèm tệp: route tải lên bắt buộc có, và đây là chỗ giảng viên nhận ra tệp trong kho. */
export const SAMPLE_AUDIO_ALT = "Audio bài mẫu";

function uploadErrorMessage(code: unknown, status: number): string {
  if (code === "file_too_large") return `Audio quá nặng. ${AUDIO_DIALOG_HINT}`;
  if (code === "unsupported_media_type") return `Định dạng chưa đúng. ${AUDIO_DIALOG_HINT}`;
  if (code === "unauthorized") return "Phiên đăng nhập đã hết. Hãy tải lại trang rồi thử lại.";
  return `Tải lên lỗi (${typeof code === "string" ? code : status}). Thử lại sau.`;
}

/**
 * Ô "Audio bài mẫu" của câu tự luận trong Bài luyện: tải tệp lên kho của đề, nghe thử, Xoá.
 * `value` là đường dẫn `/api/exam-assets/<tên>` (rỗng = chưa có). Gỡ khỏi câu thì tệp được dọn khi lưu câu (lõi `pruneRemovedQuestionAssets`).
 * docs/tieu-chi/bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md (AC3).
 */
export default function EssayAudioField({
  examId,
  value,
  onChange,
  label = "Audio bài mẫu",
  altText = SAMPLE_AUDIO_ALT,
  hint,
}: {
  examId: string;
  value: string;
  onChange: (url: string) => void;
  /** Tên ô (mặc định "Audio bài mẫu"); hội thoại đóng vai dùng "Audio lượt n". */
  label?: string;
  altText?: string;
  /** Dòng chú thích dưới ô; mặc định là chú thích của audio bài mẫu. */
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function pick(f: File | null) {
    setError(null);
    if (!f) return;
    const problem = checkAudioFile(f);
    if (problem) {
      setError(problem);
      if (input.current) input.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("altText", altText);
      const res = await fetch(apiUrl(`/api/exams/${examId}/assets`), { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(uploadErrorMessage(data.error, res.status));
        return;
      }
      onChange(data.url);
    } catch {
      setError("Không tải được (mất kết nối hoặc tệp quá nặng). Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <span className="block text-sm font-medium">{label}</span>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center rounded border border-default px-3 py-1 text-sm hover:bg-gray-50">
          {busy ? "Đang tải…" : value ? "Chọn tệp khác" : "Tải tệp audio lên"}
          <input
            ref={input}
            type="file"
            accept={AUDIO_LIMIT.mimes.join(",")}
            disabled={busy}
            onChange={(e) => void pick(e.target.files?.[0] ?? null)}
            className="sr-only"
            aria-label={`Tải tệp lên: ${label}`}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              onChange("");
            }}
            disabled={busy}
            className="rounded border border-default px-3 py-1 text-sm text-red-700 disabled:opacity-50"
          >
            Xoá
          </button>
        )}
      </div>
      {value && <audio controls preload="none" src={apiUrl(value)} className="mt-2 w-full max-w-md" aria-label={`Nghe thử: ${label}`} />}
      <p className="mt-1 text-caption text-faint">{hint ?? `${AUDIO_DIALOG_HINT} Học viên nghe ngay dưới bài mẫu sau khi kiểm tra. Có thể để trống.`}</p>
      {error && (
        <p role="alert" className="mt-1 text-caption text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
