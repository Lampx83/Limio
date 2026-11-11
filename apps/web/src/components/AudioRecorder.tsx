"use client";

import { Mic, Square } from "lucide-react";
import { MAX_RECORD_SECONDS, formatClock } from "@/lib/audioRecorder";
import { useAudioRecorder } from "./useAudioRecorder";

/**
 * LANG G7a.1 — ghi âm ngay trong trang nộp bài: ghi / dừng / nghe lại / ghi lại, hiện thời lượng, tự dừng ở
 * 3 phút. Xong thì đưa File cho `onRecorded` (chỗ gọi tải lên như file chọn từ máy). Logic ở `useAudioRecorder`.
 */
export default function AudioRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (file: File) => void;
  disabled?: boolean;
}) {
  const { state, seconds, error, previewUrl, start, stop } = useAudioRecorder({ onRecorded });

  return (
    <div className="space-y-2 rounded-lg border border-token bg-[rgb(var(--surface))] p-2" data-testid="audio-recorder">
      <div className="flex flex-wrap items-center gap-2">
        {state === "recording" ? (
          <button type="button" onClick={stop} className="btn-primary btn-sm inline-flex items-center gap-1.5" aria-label="Dừng ghi âm">
            <Square size={14} aria-hidden /> Dừng
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={disabled}
            className="btn-secondary btn-sm inline-flex items-center gap-1.5"
          >
            <Mic size={14} aria-hidden /> {state === "done" ? "Ghi lại" : "Ghi âm"}
          </button>
        )}
        {state === "recording" && (
          <span role="timer" aria-live="off" className="text-sm tabular-nums text-danger-700">
            ● {formatClock(seconds)} / {formatClock(MAX_RECORD_SECONDS)}
          </span>
        )}
        {state !== "recording" && <span className="text-xs text-muted">Tối đa {formatClock(MAX_RECORD_SECONDS)}.</span>}
      </div>
      {state === "done" && previewUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={previewUrl} className="w-full" aria-label="Nghe lại bản ghi" />
      )}
      {error && (
        <p role="alert" className="banner-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
