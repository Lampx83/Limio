"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAX_RECORD_SECONDS,
  extForRecorderMime,
  pickRecorderMime,
  recorderErrorText,
} from "@/lib/audioRecorder";
import { useUiLang } from "@/lib/i18n/client";

export type RecorderState = "idle" | "recording" | "done";

/**
 * Logic ghi âm bằng micro của trình duyệt, dùng chung cho `AudioRecorder` (nộp bài) và ô trả lời bằng giọng nói của
 * Bài luyện. Ghi / dừng, tự dừng ở 3 phút, xong thì đưa File cho `onRecorded`. Micro luôn được nhả ngay khi dừng hoặc
 * khi rời trang — không để đèn micro sáng. `autoStart`: ghi ngay khi hiện (chỉ một lần).
 */
export function useAudioRecorder({
  onRecorded,
  autoStart,
  maxSeconds = MAX_RECORD_SECONDS,
}: {
  onRecorded: (file: File) => void;
  autoStart?: boolean;
  /** Trần thời lượng một bản ghi (mặc định 3 phút); hội thoại đóng vai ghi từng lượt ngắn. */
  maxSeconds?: number;
}) {
  const lang = useUiLang();
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStartedRef = useRef(false);

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
      setError(recorderErrorText("unsupported", lang));
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
          setError(recorderErrorText("other", lang));
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
          if (s + 1 >= maxSeconds) {
            // Hết thời lượng tối đa: tự dừng (onstop sẽ nộp bản ghi).
            if (rec.state !== "inactive") rec.stop();
          }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      release();
      setState("idle");
      setError(recorderErrorText((e as { name?: string })?.name ?? "other", lang));
    }
  }

  function stop() {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true; // một lần, kể cả khi React dựng lại hai lần ở chế độ dev
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return { state, seconds, error, previewUrl, start, stop };
}
