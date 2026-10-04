"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import {
  MAX_RECORD_SECONDS,
  extForRecorderMime,
  formatClock,
  pickRecorderMime,
  recorderErrorText,
} from "@/lib/audioRecorder";

/**
 * LANG G7a.1 — ghi âm ngay trong trang nộp bài: ghi / dừng / nghe lại / ghi lại, hiện thời lượng, tự dừng ở
 * 3 phút. Xong thì đưa File cho `onRecorded` (chỗ gọi tải lên như file chọn từ máy). Micro luôn được
 * nhả ngay khi dừng hoặc khi rời trang — không để đèn micro sáng.
 */
export default function AudioRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (file: File) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function release() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }
  useEffect(
    () => () => {
      release();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewUrl],
  );

  async function start() {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(recorderErrorText("unsupported"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        release();
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size === 0) {
          setState("idle");
          setError(recorderErrorText("other"));
          return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setState("done");
        onRecorded(new File([blob], `ghi-am.${extForRecorderMime(type)}`, { type: type.split(";")[0] }));
      };
      recRef.current = rec;
      rec.start();
      setSeconds(0);
      setState("recording");
      tickRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) {
            // Hết 3 phút: tự dừng (onstop sẽ nộp bản ghi).
            if (rec.state !== "inactive") rec.stop();
          }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      release();
      setState("idle");
      setError(recorderErrorText((e as { name?: string })?.name ?? "other"));
    }
  }

  function stop() {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }

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
