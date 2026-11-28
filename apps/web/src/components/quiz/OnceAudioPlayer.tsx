"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, Play } from "lucide-react";
import { formatClock, progressPct } from "@/lib/audioClock";
import { useT } from "@/lib/i18n/client";

const KEY = (k: string) => `fbm:once-audio:${k}`;

function wasPlayed(k: string): boolean {
  try {
    return window.sessionStorage.getItem(KEY(k)) === "1";
  } catch {
    return false;
  }
}
function markPlayed(k: string) {
  try {
    window.sessionStorage.setItem(KEY(k), "1");
  } catch {
    /* không lưu được thì vẫn khoá trong lần mở trang này */
  }
}

/**
 * Audio câu nghe kiểu phòng thi HSK: phát MỘT lần. Không tạm dừng, không tua, không đổi tốc độ, không lặp lại;
 * phát xong (hoặc rời câu khi đang phát) là khoá. Trạng thái "đã nghe" nhớ theo `storageKey` (lượt làm + câu) trong phiên trình duyệt,
 * nên tải lại trang cũng không nghe lại được. Mini-test cuối bài dùng cái này cho câu có `extra.audioPlays = 1`.
 */
export default function OnceAudioPlayer({ url, storageKey }: { url: string; storageKey: string }) {
  const t = useT();
  const audioRef = useRef<HTMLAudioElement>(null);
  const playingRef = useRef(false);
  const [state, setState] = useState<"idle" | "playing" | "done">(() => (typeof window !== "undefined" && wasPlayed(storageKey) ? "done" : "idle"));
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(
    () => () => {
      // Rời câu khi đang phát: tính là đã nghe, như phòng thi (không có nút nghe lại).
      if (playingRef.current) markPlayed(storageKey);
    },
    [storageKey],
  );

  function finish() {
    playingRef.current = false;
    markPlayed(storageKey);
    setState("done");
  }

  function start() {
    const a = audioRef.current;
    if (!a || state !== "idle") return;
    setFailed(false);
    playingRef.current = true;
    setState("playing");
    a.play().catch(() => {
      // Trình duyệt chặn phát: chưa tính là đã nghe, cho bấm lại.
      playingRef.current = false;
      setState("idle");
      setFailed(true);
    });
  }

  return (
    <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-3" data-testid="once-audio" data-state={state}>
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={finish}
      />
      {state === "idle" && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={start} className="btn-primary btn-sm inline-flex items-center gap-1.5" data-testid="once-audio-play">
            <Play size={16} aria-hidden /> {t("practice.quiz.onceAudio.play")}
          </button>
          <span className="text-sm text-muted">{t("practice.quiz.onceAudio.hint")}</span>
        </div>
      )}
      {state === "playing" && (
        <div className="flex items-center gap-3" role="status" aria-live="polite">
          <Headphones size={18} aria-hidden className="shrink-0 text-brand-700" />
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[rgb(var(--border))]" aria-hidden>
            <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${progressPct(current, duration)}%` }} />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {formatClock(current)} / {formatClock(duration)}
          </span>
        </div>
      )}
      {state === "done" && (
        <p className="flex items-center gap-2 text-sm text-muted" data-testid="once-audio-done">
          <Headphones size={16} aria-hidden /> {t("practice.quiz.onceAudio.done")}
        </p>
      )}
      {failed && <p className="mt-2 text-xs text-danger-700">{t("practice.quiz.onceAudio.failed")}</p>}
    </div>
  );
}
