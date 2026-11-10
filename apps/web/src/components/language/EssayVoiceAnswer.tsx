"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import AudioRecorder from "@/components/AudioRecorder";
import { voiceErrorMessage } from "@/lib/practiceEssayView";

/** Mã lỗi (của máy chủ hoặc "network") mà `onUse` ném ra, để hiện đúng lời nhắn. */
export class VoiceUseError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

const NOTICE_KEY = "limio:practice-voice-notice";

function noticeSeen(): boolean {
  try {
    return window.localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false; // lưu trữ bị chặn: cứ nhắc, chỉ thừa chứ không sai
  }
}
function markNoticeSeen() {
  try {
    window.localStorage.setItem(NOTICE_KEY, "1");
  } catch {
    /* bỏ qua */
  }
}

/**
 * Câu mở của Bài luyện nhúng: trả lời bằng giọng nói (docs/tieu-chi/bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md, AC1).
 * Nằm dưới ô gõ. Ghi âm ≤ 3 phút bằng `AudioRecorder` (Dừng, Nghe lại, Ghi lại); bản ghi chỉ rời trình duyệt khi học viên
 * bấm "Dùng bản ghi này". Chữ do máy nghe điền vào ô trả lời (việc đó do `onUse` ở chỗ gọi làm). Gõ chữ luôn dùng được.
 *
 * - `preview`: xem thử của giảng viên — nút hiện nhưng khoá, không gọi máy chủ.
 * - `recordingSrc`: có bản ghi cuối cùng của học viên → trình phát "Bản ghi của bạn" (cả sau khi tải lại trang).
 * - `viaVoiceText`: câu trả lời hiện tại đến từ giọng nói → nhãn nhắc đọc lại và sửa.
 */
export default function EssayVoiceAnswer({
  preview,
  recordingSrc,
  viaVoiceText,
  hasText,
  onUse,
}: {
  preview: boolean;
  recordingSrc: string | null;
  viaVoiceText: boolean;
  hasText: boolean;
  onUse: (file: File) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState(() => (typeof window === "undefined" ? true : noticeSeen()));

  async function use() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onUse(file);
      markNoticeSeen();
      setSeen(true);
      setOpen(false);
      setFile(null);
    } catch (e) {
      setError(voiceErrorMessage(e instanceof VoiceUseError ? e.code : "network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2" data-testid="lp-voice">
      {viaVoiceText && hasText && (
        <p className="text-xs text-muted" data-testid="lp-voice-note">
          Bản chữ từ giọng nói, máy có thể nghe sai: hãy đọc lại và sửa.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className="btn-secondary btn-sm inline-flex items-center gap-1.5"
          aria-expanded={preview ? undefined : open}
          disabled={preview}
          onClick={() => setOpen((o) => !o)}
        >
          <Mic size={14} aria-hidden /> Trả lời bằng giọng nói
        </button>
        {preview && <span className="text-xs text-muted">Xem thử: không chuyển giọng nói thành chữ.</span>}
      </div>

      {open && !preview && (
        <div className="space-y-2" data-testid="lp-voice-panel">
          <AudioRecorder
            disabled={busy}
            onRecorded={(f) => {
              setFile(f);
              setError(null);
            }}
          />
          {!seen && <p className="text-xs text-muted">Bản ghi âm sẽ được gửi tới OpenAI để chuyển thành chữ.</p>}
          {file && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button type="button" className="btn-primary btn-sm disabled:opacity-50" disabled={busy} onClick={() => void use()}>
                {busy ? "Đang chuyển thành chữ…" : "Dùng bản ghi này"}
              </button>
              {hasText && !busy && <span className="text-xs text-muted">Bản chữ từ giọng nói sẽ thay phần bạn đã gõ.</span>}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger-600" data-testid="lp-voice-error">
              {error}
            </p>
          )}
        </div>
      )}

      {recordingSrc && !preview && (
        <div data-testid="lp-voice-player">
          <p className="mb-1 text-xs font-semibold text-muted">Bản ghi của bạn</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls preload="none" src={recordingSrc} className="w-full" aria-label="Bản ghi của bạn" />
        </div>
      )}
    </div>
  );
}
