"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { audioPlayView, type ExamAudioPolicy } from "@/lib/examAudio";

/** Bối cảnh audio của một bài đọc/nghe trong đề thi thử; không có (null) = trình phát gốc. */
export interface ExamAudioContextValue {
  attemptId: string;
  passageId: string;
  policy: ExamAudioPolicy;
  maxAudioPlays: number | null;
  /** audioKey → số lượt đã dùng (máy chủ báo lúc tải trang). */
  usage: Record<string, number>;
}
export const ExamAudioContext = createContext<ExamAudioContextValue | null>(null);

/**
 * LANG G5b — trình phát audio của đề thi thử. Nút Phát xin máy chủ một lượt rồi
 * mới phát; trong lúc phát không tua, không dừng; hết file là hết một lượt.
 * Không dùng bộ điều khiển gốc của trình duyệt (có tua và dừng).
 *
 * Nói thẳng giới hạn: máy chủ đếm lượt phát, không chống được việc tải file về nghe riêng.
 * Lượt đã cấp mà file không phát được (mất mạng giữa chừng, file hỏng) vẫn bị tính.
 */
export default function ExamAudioPlayer({ src, alt }: { src: string; alt?: string }) {
  const ctx = useContext(ExamAudioContext);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [used, setUsed] = useState(ctx?.usage[src] ?? 0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Giữ playId qua các lần thử lại để gửi lại vì mất mạng không tính hai lượt.
  const pendingPlayId = useRef<string | null>(null);

  useEffect(() => {
    setUsed(ctx?.usage[src] ?? 0);
  }, [ctx?.usage, src]);

  // Không có bối cảnh (hoặc không giới hạn): trình phát gốc như trước.
  const view = ctx ? audioPlayView(ctx.policy, ctx.maxAudioPlays, used) : null;
  if (!ctx || !view || view.unlimited) {
    return (
      <div className="my-3 rounded border border-default bg-slate-50 p-3">
        <audio src={src} controls preload="metadata" className="w-full">
          <track kind="captions" />
        </audio>
        {alt && <p className="mt-1 text-xs text-faint">🎵 {alt}</p>}
      </div>
    );
  }

  async function play() {
    if (!ctx || busy || playing || !view?.canPlay) return;
    setBusy(true);
    setError(null);
    pendingPlayId.current ??= crypto.randomUUID();
    try {
      const res = await fetch(apiUrl(`/api/exam-attempts/${ctx.attemptId}/audio/claim`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passageId: ctx.passageId, audioKey: src, playId: pendingPlayId.current }),
      });
      if (res.status === 403) {
        const j = (await res.json().catch(() => null)) as { error?: string; details?: { limit?: number } } | null;
        if (j?.error === "audio_plays_exhausted") {
          setUsed(j.details?.limit ?? 99);
          pendingPlayId.current = null;
          return;
        }
      }
      if (!res.ok) {
        // 409 (phần đã đóng / đã nộp) hoặc lỗi máy chủ: không phát, cho thử lại với cùng playId.
        setError(
          res.status === 409
            ? "Phần này đã đóng nên không nghe được nữa."
            : "Không xin được lượt nghe. Kiểm tra mạng rồi bấm Phát lại — lượt chưa bị tính.",
        );
        return;
      }
      const j = (await res.json()) as { used: number };
      pendingPlayId.current = null;
      setUsed(j.used);
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = 0;
      setProgress(0);
      setPlaying(true);
      await a.play().catch(() => {
        setPlaying(false);
        setError("Trình duyệt không phát được âm thanh. Lượt nghe này đã được tính — báo giám thị nếu cần.");
      });
    } catch {
      setError("Không xin được lượt nghe. Kiểm tra mạng rồi bấm Phát lại — lượt chưa bị tính.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="my-3 rounded border border-default bg-slate-50 p-3" data-testid="exam-audio">
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setProgress(a.duration > 0 ? (a.currentTime / a.duration) * 100 : 0);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(100);
        }}
        onError={() => {
          setPlaying(false);
          setError("Không tải được file âm thanh. Lượt nghe này đã được tính — báo giám thị nếu cần.");
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void play()}
          disabled={!view.canPlay || playing || busy}
          aria-label={playing ? "Đang phát" : "Phát"}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Volume2 size={16} aria-hidden />
          {playing ? "Đang phát…" : busy ? "Đang xin lượt…" : "Phát"}
        </button>
        {/* Thanh tiến độ chỉ để xem (không tua được): không phải <input>. */}
        <div
          role="progressbar"
          aria-label="Tiến độ phát"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-300"
        >
          <div className="h-full rounded-full bg-brand-800 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <p className={`mt-2 text-xs ${view.canPlay ? "text-faint" : "font-medium text-red-700"}`}>{view.label}</p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
      {alt && <p className="mt-1 text-xs text-faint">🎵 {alt}</p>}
    </div>
  );
}
