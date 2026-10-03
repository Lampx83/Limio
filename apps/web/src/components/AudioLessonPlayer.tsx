"use client";

import { useEffect, useRef, useState } from "react";

const SPEEDS = [0.75, 1, 1.25] as const;
const speedLabel = (s: number) => `${s === 1 ? "1" : String(s)}×`;

/**
 * LANG G1 — trình phát bài nghe.
 *
 * Dùng <audio controls> gốc của trình duyệt (tua, âm lượng, hỗ trợ bàn phím và
 * trình đọc màn hình đã có sẵn), thêm tốc độ 0.75×/1×/1.25× và lặp lại — hai thứ
 * người học ngoại ngữ cần nhất khi nghe đi nghe lại một câu.
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
}: {
  url: string;
  title?: string;
  caption?: string;
  transcript?: string;
  showTranscript?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState<number>(1);
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const hasTranscript = showTranscript && !!transcript?.trim();

  return (
    <figure className="space-y-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
      {title && <figcaption className="text-body font-medium">{title}</figcaption>}
      {caption && <p className="text-meta">{caption}</p>}

      <audio
        ref={audioRef}
        src={url}
        controls
        preload="metadata"
        loop={loop}
        className="w-full"
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption">Tốc độ</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            onClick={() => setSpeed(s)}
            className={`rounded-lg border px-2.5 py-1 text-sm transition-colors ${
              speed === s
                ? "border-brand-200 bg-brand-soft text-brand-700"
                : "border-token hover:bg-brand-soft"
            }`}
          >
            {speedLabel(s)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={loop}
          onClick={() => setLoop((v) => !v)}
          className={`ml-auto rounded-lg border px-2.5 py-1 text-sm transition-colors ${
            loop ? "border-brand-200 bg-brand-soft text-brand-700" : "border-token hover:bg-brand-soft"
          }`}
        >
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
