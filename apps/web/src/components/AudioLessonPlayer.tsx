"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat, Volume2, VolumeX } from "lucide-react";
import { formatClock, progressPct } from "@/lib/audioClock";

const SPEEDS = [0.75, 1, 1.25] as const;
const speedLabel = (s: number) => `${s === 1 ? "1" : String(s)}×`;

/**
 * LANG G1 — trình phát bài nghe.
 *
 * Thanh phát tự vẽ trên thẻ <audio> ẩn: thanh tiến độ gốc của trình duyệt xám nhạt
 * trên nền xám, khó nhìn và không đổi màu được. Thanh tua là <input type="range">
 * thật (bàn phím, trình đọc màn hình đều dùng được) nền xám, phần đã phát xanh đậm.
 * Thêm tốc độ 0.75×/1×/1.25× và lặp lại — hai thứ người học ngoại ngữ cần nhất khi
 * nghe đi nghe lại một câu.
 *
 * Import TĨNH ở LessonContent (không `dynamic ssr:false`) để audio có trong HTML
 * server render và test được.
 *
 * Lời thoại là văn bản thuần, gấp lại mặc định để không lộ đáp án ngay. Khi
 * `showTranscript === false` thì KHÔNG dựng khối này — không có trong markup chứ
 * không chỉ ẩn bằng CSS, vì với bài nghe-hiểu, lời thoại chính là đáp án.
 */
export default function AudioLessonPlayer({
  url,
  title,
  caption,
  transcript,
  showTranscript = true,
  compact = false,
}: {
  url: string;
  title?: string;
  caption?: string;
  transcript?: string;
  showTranscript?: boolean;
  /** Gọn: trình phát và tốc độ/lặp lại nằm chung một hàng (dùng trong hội thoại, nơi chiều dọc quý). */
  compact?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState<number>(1);
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState<number | null>(null); // đang kéo thanh tua

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // Metadata có thể đã tải xong trước khi gắn sự kiện (preload="metadata").
  useEffect(() => {
    const a = audioRef.current;
    if (a && Number.isFinite(a.duration)) setDuration(a.duration);
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  };
  const commitSeek = () => {
    if (seeking === null) return;
    const a = audioRef.current;
    if (a) a.currentTime = seeking;
    setCurrent(seeking);
    setSeeking(null);
  };
  const shown = seeking ?? current;
  const pct = progressPct(shown, duration);

  const hasTranscript = showTranscript && !!transcript?.trim();

  return (
    <figure
      className={`rounded-xl ${compact ? "" : "border border-token bg-[rgb(var(--surface))]"} ${
        compact
          ? "flex flex-wrap items-center gap-x-3 gap-y-2 bg-[rgb(var(--surface-muted))/0.6] p-2"
          : "space-y-3 p-4"
      }`}
    >
      {title && <figcaption className="text-body font-medium">{title}</figcaption>}
      {caption && <p className="text-meta">{caption}</p>}

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        loop={loop}
        muted={muted}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
      />

      <div
        className={`flex items-center gap-2.5 rounded-full bg-[rgb(var(--surface))] py-1.5 pl-1.5 pr-3 ${
          compact ? "min-w-[16rem] flex-1" : "w-full"
        } border border-token`}
      >
        <button
          type="button"
          aria-label={playing ? "Tạm dừng" : "Phát"}
          onClick={toggle}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700"
        >
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} className="translate-x-px" aria-hidden />}
        </button>
        <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted">{formatClock(shown)}</span>
        <input
          type="range"
          aria-label="Tiến độ phát"
          aria-valuetext={`${formatClock(shown)} trên ${formatClock(duration)}`}
          min={0}
          max={duration > 0 ? duration : 0}
          step={0.1}
          value={Math.min(shown, duration > 0 ? duration : 0)}
          disabled={!(duration > 0)}
          onChange={(e) => setSeeking(Number(e.target.value))}
          onPointerUp={() => commitSeek()}
          onKeyUp={() => commitSeek()}
          onBlur={() => commitSeek()}
          style={{ ["--pct" as string]: `${pct}%` }}
          // Nền xám, phần đã phát xanh đậm; đầu kéo tròn có viền để nhìn rõ trên cả hai nền.
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [background:linear-gradient(to_right,#3F6212_var(--pct),#D4D4D8_var(--pct))] dark:[background:linear-gradient(to_right,#A3E635_var(--pct),#52525B_var(--pct))] disabled:cursor-default [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-brand-800 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-brand-800 [&::-webkit-slider-thumb]:shadow"
        />
        <span className="w-10 shrink-0 text-sm tabular-nums text-muted">{formatClock(duration)}</span>
        <button
          type="button"
          aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
          aria-pressed={muted}
          onClick={() => setMuted((v) => !v)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-brand-soft"
        >
          {muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
        </button>
      </div>

      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "justify-between"}`}>
        {/* Tốc độ: một cụm nút liền nhau (chọn một) thay cho 3 nút rời. */}
        <div
          role="group"
          aria-label="Tốc độ"
          title="Tốc độ phát"
          className="inline-flex rounded-lg border border-token bg-[rgb(var(--surface))] p-0.5"
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => setSpeed(s)}
              className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
                speed === s
                  ? "bg-brand-100 font-medium text-brand-800 shadow-sm"
                  : "text-muted hover:bg-brand-soft"
              }`}
            >
              {speedLabel(s)}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={loop}
          onClick={() => setLoop((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
            loop
              ? "border-brand-300 bg-brand-100 font-medium text-brand-800"
              : "border-token bg-[rgb(var(--surface))] text-muted hover:bg-brand-soft"
          }`}
        >
          <Repeat size={14} aria-hidden />
          Lặp lại
        </button>
      </div>

      {hasTranscript && (
        <details className="rounded-lg border border-token px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Lời thoại</summary>
          <p className="mt-2 whitespace-pre-line text-body">{transcript}</p>
        </details>
      )}
    </figure>
  );
}
