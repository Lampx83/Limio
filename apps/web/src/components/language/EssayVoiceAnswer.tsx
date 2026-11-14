"use client";

import { useState, type ReactNode } from "react";
import { Mic, Square } from "lucide-react";
import { MAX_RECORD_SECONDS, formatClock } from "@/lib/audioRecorder";
import { useAudioRecorder } from "@/components/useAudioRecorder";
import { voiceErrorMessage } from "@/lib/practiceEssayView";

/** Mã lỗi (của máy chủ hoặc "network") mà `onUse` ném ra, để hiện đúng lời nhắn. */
export class VoiceUseError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

const NOTICE_KEY = "limio:practice-voice-notice";

export function noticeSeen(): boolean {
  try {
    return window.localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false; // lưu trữ bị chặn: cứ nhắc, chỉ thừa chứ không sai
  }
}
export function markNoticeSeen() {
  try {
    window.localStorage.setItem(NOTICE_KEY, "1");
  } catch {
    /* bỏ qua */
  }
}

/**
 * Câu mở của Bài luyện nhúng: trả lời bằng giọng nói (docs/tieu-chi/bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md, AC1).
 * Nằm dưới ô gõ. Bấm nút là ghi luôn (≤ 3 phút); một khung duy nhất đi qua ba bước: đang ghi (Dừng) → nghe lại
 * (Chuyển thành chữ / Ghi lại). Bản ghi chỉ rời trình duyệt khi học viên bấm "Chuyển thành chữ". Chữ do máy nghe điền vào ô trả lời (việc đó do `onUse` ở chỗ gọi làm). Gõ chữ luôn dùng được.
 *
 * - `preview`: xem thử của giảng viên — ghi âm và chuyển chữ được (trừ ví giảng viên) nhưng không lưu bản ghi và không có nhận xét AI.
 * - `recordingSrc`: có bản ghi cuối cùng của học viên → trình phát "Bản ghi của bạn" (cả sau khi tải lại trang).
 * - `viaVoiceText`: câu trả lời hiện tại đến từ giọng nói → nhãn nhắc đọc lại và sửa.
 */
export default function EssayVoiceAnswer({
  preview,
  recordingSrc,
  viaVoiceText,
  hasText,
  feedbackOn,
  onUse,
  trailing,
}: {
  preview: boolean;
  recordingSrc: string | null;
  viaVoiceText: boolean;
  hasText: boolean;
  /** Câu này có góp ý AI (và không phải xem thử): nút chính vừa lấy bản chữ vừa xin AI nhận xét luôn. */
  feedbackOn: boolean;
  /** `withFeedback`: kiểm tra và nhận xét ngay sau khi có bản chữ. */
  onUse: (file: File, withFeedback: boolean) => Promise<void>;
  /** Nút của chỗ gọi (vd "Kiểm tra câu n") đặt cùng hàng với nút giọng nói, căn phải, để hai việc không chiếm hai dòng. */
  trailing?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 space-y-2" data-testid="lp-voice">
      {viaVoiceText && hasText && (
        <p className="text-xs text-muted" data-testid="lp-voice-note">
          Bản chữ từ giọng nói, máy có thể nghe sai: hãy đọc lại và sửa.
        </p>
      )}

      {!open && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              className="btn-secondary btn-sm inline-flex items-center gap-1.5"
              onClick={() => setOpen(true)}
            >
              <Mic size={14} aria-hidden /> Trả lời bằng giọng nói
            </button>
            {preview && <span className="text-xs text-muted">Xem thử: ghi âm và chuyển thành chữ được, nhưng không lưu bản ghi.</span>}
          </div>
          {trailing}
        </div>
      )}

      {open && (
        <>
          <VoicePanel hasText={hasText} feedbackOn={feedbackOn} onUse={onUse} onClose={() => setOpen(false)} />
          {trailing && <div className="flex justify-end">{trailing}</div>}
        </>
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

/** Khung ghi âm: ghi ngay khi hiện. Ba trạng thái trong cùng một khung, mỗi lúc chỉ có một việc để bấm. */
function VoicePanel({ hasText, feedbackOn, onUse, onClose }: { hasText: boolean; feedbackOn: boolean; onUse: (file: File, withFeedback: boolean) => Promise<void>; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [useError, setUseError] = useState<string | null>(null);
  const [seen, setSeen] = useState(() => (typeof window === "undefined" ? true : noticeSeen()));
  const rec = useAudioRecorder({
    autoStart: true,
    onRecorded: (f) => {
      setFile(f);
      setUseError(null);
    },
  });
  const error = useError ?? rec.error;

  async function use(withFeedback: boolean) {
    if (!file || busy) return;
    setBusy(true);
    setUseError(null);
    try {
      await onUse(file, withFeedback);
      markNoticeSeen();
      setSeen(true);
      onClose();
    } catch (e) {
      setUseError(voiceErrorMessage(e instanceof VoiceUseError ? e.code : "network"));
    } finally {
      setBusy(false);
    }
  }

  const recording = rec.state === "recording";
  const done = rec.state === "done" && !!rec.previewUrl;

  return (
    <div className="space-y-3 rounded-lg border border-token bg-[rgb(var(--surface))] p-3" data-testid="lp-voice-panel">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {recording ? "Đang ghi âm" : done ? "Nghe lại bản ghi" : "Trả lời bằng giọng nói"}
        </p>
        {!recording && !busy && (
          <button type="button" className="text-xs text-muted underline" onClick={onClose}>
            Đóng
          </button>
        )}
      </div>

      {recording && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary btn-sm inline-flex items-center gap-1.5" onClick={rec.stop} aria-label="Dừng ghi âm">
            <Square size={14} aria-hidden /> Dừng
          </button>
          <span role="timer" aria-live="off" className="inline-flex items-center gap-1.5 text-sm tabular-nums text-danger-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger-600" aria-hidden />
            {formatClock(rec.seconds)} / {formatClock(MAX_RECORD_SECONDS)}
          </span>
        </div>
      )}

      {!recording && !done && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1.5" onClick={() => void rec.start()}>
            <Mic size={14} aria-hidden /> Ghi âm
          </button>
          <span className="text-xs text-muted">Tối đa {formatClock(MAX_RECORD_SECONDS)}.</span>
        </div>
      )}

      {done && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={rec.previewUrl!} className="w-full" aria-label="Nghe lại bản ghi" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary btn-sm disabled:opacity-50" disabled={busy || !file} onClick={() => void use(feedbackOn)}>
              {busy ? (feedbackOn ? "Đang nghe và nhận xét…" : "Đang chuyển thành chữ…") : feedbackOn ? "Nhận xét bằng AI" : "Chuyển thành chữ"}
            </button>
            <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1.5 disabled:opacity-50" disabled={busy} onClick={() => void rec.start()}>
              <Mic size={14} aria-hidden /> Ghi lại
            </button>
          </div>
          {feedbackOn && !busy && (
            <button type="button" className="text-xs text-muted underline" onClick={() => void use(false)}>
              Chỉ lấy bản chữ để tự sửa trước
            </button>
          )}
        </>
      )}

      {(recording || done) && !error && (
        <p className="text-xs text-muted">
          {done && feedbackOn ? "AI nghe bản ghi, điền chữ vào ô trả lời rồi nhận xét ngay. " : ""}
          {done && hasText ? "Bản chữ từ giọng nói sẽ thay phần bạn đã gõ. " : ""}
          {!seen ? "Bản ghi âm sẽ được gửi tới OpenAI để chuyển thành chữ." : ""}
        </p>
      )}

      {error && (
        <p role="alert" className="banner-danger text-xs" data-testid="lp-voice-error">
          {error}
        </p>
      )}
    </div>
  );
}
