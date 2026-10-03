"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import AudioLessonPlayer from "./AudioLessonPlayer";
import { useExclusiveAudio } from "./useExclusiveAudio";

export interface DialogueViewTurn {
  id: string;
  speaker: string;
  text: string;
  reading?: string;
  translation?: string;
  audioUrl?: string;
}

/**
 * LANG G2 — hội thoại cho học viên: các lượt như khung chat, mỗi người nói luôn
 * nằm cùng một bên (người đầu tiên bên trái). Nút nghe riêng ở lượt có audio;
 * audio cả bài (nếu có) dùng trình phát đầy đủ ở đầu khối.
 *
 * "Bản dịch" bật/tắt để học viên nghe và đoán trước khi xem nghĩa. Tắt chỉ làm
 * mờ (nội dung vẫn trong DOM) — đây là công cụ tự học, không phải đáp án cần giấu.
 */
export default function DialogueView({
  title,
  caption,
  audioUrl,
  turns,
  initialShowTranslation = true,
}: {
  title?: string;
  caption?: string;
  readingLabel?: string;
  audioUrl?: string;
  turns: DialogueViewTurn[];
  initialShowTranslation?: boolean;
}) {
  const [showTranslation, setShowTranslation] = useState(initialShowTranslation);
  const { playingId, toggle } = useExclusiveAudio();
  const speakers: string[] = [];
  for (const t of turns) if (!speakers.includes(t.speaker)) speakers.push(t.speaker);
  const hasTranslation = turns.some((t) => !!t.translation);

  return (
    <section className="space-y-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {title && <p className="text-body font-semibold">{title}</p>}
          {caption && <p className="text-meta">{caption}</p>}
        </div>
        {hasTranslation && (
          <button
            type="button"
            aria-pressed={showTranslation}
            onClick={() => setShowTranslation((v) => !v)}
            className={`rounded-lg border px-2.5 py-1 text-sm transition-colors ${
              showTranslation ? "border-brand-200 bg-brand-soft text-brand-700" : "border-token hover:bg-brand-soft"
            }`}
          >
            Bản dịch
          </button>
        )}
      </div>

      {audioUrl && <AudioLessonPlayer url={audioUrl} />}

      <ul className="space-y-3">
        {turns.map((t) => {
          const side = speakers.indexOf(t.speaker) % 2 === 0 ? "left" : "right";
          const playing = playingId === t.id;
          return (
            <li key={t.id} data-side={side} className={`flex ${side === "right" ? "justify-end" : ""}`}>
              <div
                className={`max-w-[88%] space-y-1 rounded-2xl border border-token px-4 py-2 ${
                  side === "right" ? "bg-brand-soft" : "bg-[rgb(var(--surface-muted))/0.5]"
                }`}
              >
                <p className="text-caption font-medium">{t.speaker}</p>
                <div className="flex items-start gap-2">
                  <p className="text-body">{t.text}</p>
                  {t.audioUrl && (
                    <button
                      type="button"
                      aria-label={`Nghe câu của ${t.speaker}`}
                      aria-pressed={playing}
                      onClick={() => toggle(t.id, t.audioUrl!)}
                      className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-token hover:bg-brand-soft"
                    >
                      {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
                    </button>
                  )}
                </div>
                {t.reading && <p className="text-meta">{t.reading}</p>}
                {t.translation && (
                  <p
                    data-masked={showTranslation ? undefined : "true"}
                    className={`text-meta text-muted ${showTranslation ? "" : "select-none blur-sm"}`}
                  >
                    {t.translation}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
