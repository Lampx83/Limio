"use client";

import { Pause, Play } from "lucide-react";
import {
  FLASHCARD_RATINGS,
  FLASHCARD_RATING_LABEL,
  type FlashcardMode,
  type FlashcardRating,
} from "@feedbackme/shared-types";
import type { QueueCard } from "@feedbackme/core-feedback";
import { formatInterval } from "@/lib/flashcardSession";
import { useExclusiveAudio } from "./useExclusiveAudio";

/**
 * LANG G4 — một thẻ đang ôn: mặt trước, mặt sau và bốn nút đánh giá.
 *
 * Chỉ trình bày: trạng thái (đã lật chưa, thẻ thứ mấy) do FlashcardSession giữ.
 * Mọi chữ là text node — React tự thoát HTML.
 *
 * Mặt trước theo chế độ: Từ → nghĩa chỉ hiện từ; Nghĩa → từ chỉ hiện nghĩa; Nghe →
 * từ chỉ hiện nút nghe (không lộ cả từ lẫn nghĩa). Khoảng ôn trên mỗi nút lấy từ chính
 * thẻ (`card.intervals`), nên nút không bao giờ lệch kết quả thật.
 *
 * Thanh nút dính đáy màn hình dưới `lg` (ngón cái với tới được), về vị trí thường từ `lg`.
 */
export default function FlashcardStage({
  card,
  mode,
  flipped,
  index,
  total,
  onFlip,
  onRate,
}: {
  card: QueueCard;
  mode: FlashcardMode;
  flipped: boolean;
  index: number;
  total: number;
  onFlip: () => void;
  onRate: (rating: FlashcardRating) => void;
}) {
  const { playingId, toggle } = useExclusiveAudio();
  const playing = playingId === card.itemId;

  const listen = (label: string, big = false) =>
    card.audioUrl ? (
      <button
        type="button"
        aria-label={label}
        aria-pressed={playing}
        onClick={() => toggle(card.itemId, card.audioUrl!)}
        className={`inline-flex items-center justify-center rounded-full border border-token hover:bg-brand-soft ${
          big ? "h-16 w-16" : "h-9 w-9"
        }`}
      >
        {playing ? <Pause size={big ? 28 : 18} aria-hidden /> : <Play size={big ? 28 : 18} aria-hidden />}
      </button>
    ) : null;

  return (
    <section aria-label="Thẻ từ vựng" className="space-y-4 pb-32 lg:pb-0">
      <p className="text-meta">{`Thẻ ${index + 1}/${total}`}</p>

      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-4 rounded-2xl border border-token bg-[rgb(var(--surface))] p-6 text-center">
        {!flipped ? (
          <>
            {mode === "term_to_meaning" && <p className="text-3xl font-medium">{card.term}</p>}
            {mode === "meaning_to_term" && <p className="text-2xl">{card.meaning}</p>}
            {mode === "audio_to_term" && listen("Nghe từ", true)}
          </>
        ) : (
          <>
            <p className="text-3xl font-medium">{card.term}</p>
            {card.reading && <p className="text-body text-muted">{card.reading}</p>}
            <p className="text-xl">{card.meaning}</p>
            {card.example && (
              <p className="text-meta">
                <span>{card.example}</span>
                {card.exampleReading && <span className="ml-2">{card.exampleReading}</span>}
                {card.exampleMeaning && <span className="ml-2 text-muted">{card.exampleMeaning}</span>}
              </p>
            )}
            {card.note && <p className="text-caption">{card.note}</p>}
            {listen(`Nghe ${card.term}`)}
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-token bg-[rgb(var(--surface))] px-4 py-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        {!flipped ? (
          <button type="button" aria-keyshortcuts="Space" onClick={onFlip} className="btn-primary w-full lg:w-auto">
            Lật thẻ
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {FLASHCARD_RATINGS.map((r, i) => (
              <button
                key={r}
                type="button"
                aria-keyshortcuts={String(i + 1)}
                onClick={() => onRate(r)}
                className="flex flex-col items-center rounded-xl border border-token px-2 py-2 hover:bg-brand-soft"
              >
                <span className="text-body font-medium">{FLASHCARD_RATING_LABEL[r]}</span>
                <span className="text-caption">{formatInterval(card.intervals[r])}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
