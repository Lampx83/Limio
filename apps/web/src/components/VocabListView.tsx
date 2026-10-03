"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { useExclusiveAudio } from "./useExclusiveAudio";

export interface VocabViewItem {
  id: string;
  term: string;
  reading?: string;
  meaning: string;
  example?: string;
  exampleReading?: string;
  exampleMeaning?: string;
  note?: string;
  audioUrl?: string;
}

/**
 * LANG G2 — bảng từ vựng cho học viên.
 *
 * Mobile (< sm): mỗi từ là một thẻ xếp dọc. Từ `sm`: bảng cột (từ · phiên âm ·
 * nghĩa · nghe). Mọi chữ là text node — React tự thoát HTML.
 *
 * "Che nghĩa" chỉ làm mờ phần phiên âm/nghĩa để tự kiểm tra; nội dung vẫn nằm
 * trong DOM. Khác lời thoại bài nghe-hiểu (bị gỡ khỏi payload ở máy chủ), vì từ
 * vựng không phải là bí mật cần giấu.
 */
export default function VocabListView({
  title,
  readingLabel,
  items,
  initialMasked = false,
}: {
  title?: string;
  readingLabel?: string;
  items: VocabViewItem[];
  initialMasked?: boolean;
}) {
  const [masked, setMasked] = useState(initialMasked);
  const { playingId, toggle } = useExclusiveAudio();
  const hasReading = items.some((i) => !!i.reading);
  const label = readingLabel?.trim() || "Phiên âm";
  const cols = hasReading
    ? "sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.8fr)_2rem]"
    : "sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_2rem]";
  const mask = (on: boolean) => (on ? "true" : undefined);
  const maskCls = masked ? "select-none blur-sm" : "";

  return (
    <section className="space-y-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? <p className="text-body font-semibold">{title}</p> : <span />}
        <button
          type="button"
          aria-pressed={masked}
          onClick={() => setMasked((v) => !v)}
          className={`rounded-lg border px-2.5 py-1 text-sm transition-colors ${
            masked ? "border-brand-200 bg-brand-soft text-brand-700" : "border-token hover:bg-brand-soft"
          }`}
        >
          Che nghĩa
        </button>
      </div>

      <div className={`hidden gap-x-4 text-caption sm:grid ${cols}`}>
        <span>Từ</span>
        {hasReading && <span>{label}</span>}
        <span>Nghĩa</span>
        <span />
      </div>

      <ul className="divide-y divide-[rgb(var(--border))]">
        {items.map((it) => {
          const playing = playingId === it.id;
          return (
            <li key={it.id} className={`grid grid-cols-1 gap-x-4 gap-y-1 py-3 sm:items-baseline ${cols}`}>
              <span className="text-lg font-medium">{it.term}</span>
              {hasReading && (
                <span data-masked={mask(masked && !!it.reading)} className={`text-meta ${maskCls}`}>
                  {it.reading}
                </span>
              )}
              <div className="space-y-1">
                <p data-masked={mask(masked)} className={`text-body ${maskCls}`}>
                  {it.meaning}
                </p>
                {it.example && (
                  <p className="text-meta">
                    <span>{it.example}</span>
                    {it.exampleReading && (
                      <span data-masked={mask(masked)} className={`ml-2 ${maskCls}`}>
                        {it.exampleReading}
                      </span>
                    )}
                    {it.exampleMeaning && (
                      <span data-masked={mask(masked)} className={`ml-2 text-muted ${maskCls}`}>
                        {it.exampleMeaning}
                      </span>
                    )}
                  </p>
                )}
                {it.note && <p className="text-caption">{it.note}</p>}
              </div>
              <div>
                {it.audioUrl && (
                  <button
                    type="button"
                    aria-label={`Nghe ${it.term}`}
                    aria-pressed={playing}
                    onClick={() => toggle(it.id, it.audioUrl!)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-token hover:bg-brand-soft"
                  >
                    {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
