"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, RotateCw, Shuffle, Volume2 } from "lucide-react";
import { SOURCE_TEXT_COLOR } from "@/lib/langText";
import type { VocabViewItem } from "./VocabListView";

/**
 * Thẻ ghi nhớ dạng thẻ lật: mỗi lần một thẻ, bấm (hoặc Cách / Enter) để lật, mũi tên trái/phải để chuyển thẻ.
 * Mặt trước là từ (kèm phiên âm nếu đang bật); mặt sau là nghĩa, ghi chú và ví dụ. Có thể đổi chiều (mặt trước là nghĩa để đoán
 * từ) và xáo thẻ. Mọi chữ là text node — React tự thoát HTML.
 */
export default function VocabFlashcards({
  items,
  showReading,
  playingId,
  onToggleAudio,
}: {
  items: VocabViewItem[];
  showReading: boolean;
  playingId: string | null;
  onToggleAudio: (id: string, url: string) => void;
}) {
  const [order, setOrder] = useState<number[]>(() => items.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reverse, setReverse] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Danh sách từ đổi (giảng viên sửa bài) thì dựng lại thứ tự, tránh trỏ ra ngoài mảng.
  useEffect(() => {
    setOrder(items.map((_, i) => i));
    setPos(0);
    setFlipped(false);
  }, [items]);

  const total = items.length;
  const item = items[order[Math.min(pos, total - 1)] ?? 0];
  if (!item) return null;

  const go = (next: number) => {
    setPos(Math.min(total - 1, Math.max(0, next)));
    setFlipped(false);
  };
  const shuffle = () => {
    const a = items.map((_, i) => i);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    setOrder(a);
    setPos(0);
    setFlipped(false);
    rootRef.current?.focus();
  };
  const playing = playingId === item.id;
  const progress = total > 1 ? (pos / (total - 1)) * 100 : 100;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(pos + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(pos - 1);
    } else if ((e.key === " " || e.key === "Enter") && e.target === e.currentTarget) {
      e.preventDefault();
      setFlipped((v) => !v);
    }
  };

  const termFace = (
    <>
      <p className={`text-3xl font-semibold leading-snug sm:text-4xl ${SOURCE_TEXT_COLOR}`}>{item.term}</p>
      {showReading && item.reading && <p className="mt-2 text-lg text-muted">{item.reading}</p>}
    </>
  );
  const meaningFace = (
    <>
      {/* Nghĩa dài (cả câu định nghĩa) thì chữ nhỏ hơn để thẻ không tràn. */}
      <p className={`font-semibold leading-snug text-[rgb(var(--text))] ${item.meaning.length > 60 ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl"}`}>{item.meaning}</p>
      {item.note && <p className="mt-2 text-sm italic text-muted">{item.note}</p>}
      {item.example && (
        <div className="mt-4 w-full max-w-md border-l-2 border-brand-300 bg-brand-soft/60 py-1.5 pl-3 pr-2 text-left">
          <p className="text-body">
            <span className={SOURCE_TEXT_COLOR}>{item.example}</span>
            {showReading && item.exampleReading && <span className="ml-2 text-meta text-muted">{item.exampleReading}</span>}
          </p>
          {item.exampleMeaning && <p className="text-meta text-muted">{item.exampleMeaning}</p>}
        </div>
      )}
    </>
  );
  const front = reverse ? meaningFace : termFace;
  const back = reverse ? termFace : meaningFace;
  const hint = reverse ? "Bấm để xem từ" : "Bấm để xem nghĩa";

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Thẻ ghi nhớ"
      className="space-y-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span className="tabular-nums" aria-live="polite">
          Thẻ {pos + 1} / {total}
        </span>
        <span className="inline-flex items-center gap-1">
          <button type="button" onClick={() => { setReverse((v) => !v); setFlipped(false); }} className="btn-pill" aria-pressed={reverse} title="Đổi mặt trước: từ hay nghĩa">
            <RotateCw size={14} aria-hidden />
            {reverse ? "Mặt trước: nghĩa" : "Mặt trước: từ"}
          </button>
          {total > 1 && (
            <button type="button" onClick={shuffle} className="btn-pill" title="Xáo thứ tự thẻ">
              <Shuffle size={14} aria-hidden />
              Xáo thẻ
            </button>
          )}
        </span>
      </div>

      <div className="flip-card mx-auto w-full max-w-xl" data-flipped={flipped ? "true" : "false"}>
        {/* div chứ không phải button: bên trong có đoạn văn và khối ví dụ (button chỉ chứa được nội dung dòng). Bàn phím do khung ngoài lo. */}
        <div
          role="button"
          tabIndex={-1}
          onClick={() => {
            if (window.getSelection()?.toString()) return;
            setFlipped((v) => !v);
          }}
          aria-label={flipped ? "Lật về mặt trước" : "Lật thẻ"}
          className="flip-card-inner relative block min-h-[17rem] w-full cursor-pointer rounded-2xl text-center sm:min-h-[19rem]"
        >
          <span
            aria-hidden={flipped}
            className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-token bg-[rgb(var(--surface))] p-6 shadow-card"
          >
            {front}
            <span className="absolute bottom-3 text-caption text-muted">{hint}</span>
          </span>
          <span
            aria-hidden={!flipped}
            className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-2xl border border-brand-200 bg-[rgb(var(--brand-soft))] p-6 shadow-card"
          >
            {back}
          </span>
        </div>
        {item.audioUrl && (
          <button
            type="button"
            aria-label={`Nghe ${item.term}`}
            aria-pressed={playing}
            onClick={() => onToggleAudio(item.id, item.audioUrl!)}
            className={`absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
              playing ? "border-brand-400 bg-brand-100 text-brand-800" : "border-token bg-[rgb(var(--surface))] hover:bg-brand-soft"
            }`}
          >
            {playing ? <Pause size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
          </button>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-xl items-center gap-3">
        <button type="button" onClick={() => go(pos - 1)} disabled={pos === 0} className="btn-secondary btn-sm" aria-label="Thẻ trước">
          <ArrowLeft size={16} aria-hidden />
          Trước
        </button>
        <div
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]"
          role="progressbar"
          aria-label="Thẻ đã xem"
          aria-valuenow={pos + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <div className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <button type="button" onClick={() => go(pos + 1)} disabled={pos === total - 1} className="btn-primary btn-sm" aria-label="Thẻ sau">
          Sau
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
