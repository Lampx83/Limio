"use client";

import { useState } from "react";
import { Eye, Pause, Volume2 } from "lucide-react";
import { SOURCE_TEXT_COLOR } from "@/lib/langText";
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
 * Mobile (< sm): mỗi từ là một thẻ xếp dọc. Từ `sm`: bảng cột (từ · phiên âm · nghĩa).
 * Nút nghe nằm ngay trước chữ ở cột 1; bấm cả hàng cũng nghe được. Mọi chữ là
 * text node — React tự thoát HTML.
 *
 * Tự kiểm tra bằng hai nút bật/tắt độc lập — phiên âm và nghĩa — cùng kiểu với khối
 * hội thoại: tắt phiên âm để đoán cách đọc, tắt nghĩa để đoán nghĩa. Tắt chỉ làm
 * mờ; nội dung vẫn nằm trong DOM. Khác lời thoại bài nghe-hiểu (bị gỡ khỏi payload
 * ở máy chủ), vì từ vựng không phải là bí mật cần giấu. Cột "từ" không bao giờ bị che.
 */
export default function VocabListView({
  title,
  readingLabel,
  items,
  initialShowReading = true,
  initialShowMeaning = true,
}: {
  title?: string;
  readingLabel?: string;
  items: VocabViewItem[];
  initialShowReading?: boolean;
  initialShowMeaning?: boolean;
}) {
  const [showReading, setShowReading] = useState(initialShowReading);
  const [showMeaning, setShowMeaning] = useState(initialShowMeaning);
  const { playingId, toggle } = useExclusiveAudio();
  const hasReading = items.some((i) => !!i.reading);
  const label = readingLabel?.trim() || "Phiên âm";
  const anyAudio = items.some((i) => i.audioUrl);
  const anyExample = items.some((i) => !!i.example);
  // Từ md: từ · phiên âm · nghĩa, ví dụ nằm dưới nghĩa. Từ lg nếu có ví dụ: ví dụ sang
  // cột riêng cùng hàng — mỗi từ chỉ cao một dòng thay vì ba, người học đỡ phải cuộn.
  const cols = hasReading
    ? `sm:grid-cols-[minmax(7rem,12rem)_minmax(5rem,9rem)_minmax(0,1fr)] ${
        anyExample ? "lg:grid-cols-[minmax(6.5rem,9rem)_minmax(4.5rem,6.5rem)_minmax(9rem,1fr)_minmax(0,1.5fr)]" : ""
      }`
    : `sm:grid-cols-[minmax(7rem,12rem)_minmax(0,1fr)] ${
        anyExample ? "lg:grid-cols-[minmax(6.5rem,9rem)_minmax(9rem,1fr)_minmax(0,1.5fr)]" : ""
      }`;
  const meaningColStart = hasReading ? "sm:col-start-3" : "sm:col-start-2";
  const exampleCls = hasReading
    ? "sm:col-start-3 lg:col-start-4 lg:row-start-1"
    : "sm:col-start-2 lg:col-start-3 lg:row-start-1";
  const mask = (on: boolean) => (on ? "true" : undefined);
  const blur = (hidden: boolean) => (hidden ? "select-none blur-sm" : "");

  return (
    <section className="space-y-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {title ? <p className="text-body font-semibold">{title}</p> : <span />}
        <div
          role="group"
          aria-label="Hiển thị"
          className="inline-flex h-9 items-center gap-0.5 rounded-full border border-token bg-[rgb(var(--surface))] p-0.5 pl-3"
        >
          <Eye size={15} aria-hidden className="mr-1.5 text-muted" />
          {hasReading && (
            <ToggleChip pressed={showReading} onClick={() => setShowReading((v) => !v)}>
              {label}
            </ToggleChip>
          )}
          <ToggleChip pressed={showMeaning} onClick={() => setShowMeaning((v) => !v)}>
            Nghĩa
          </ToggleChip>
        </div>
      </div>

      <div className={`hidden gap-x-4 border-b border-token px-2 pb-1.5 text-caption font-medium uppercase tracking-wide sm:grid ${cols}`}>
        <span className={anyAudio ? "pl-9" : undefined}>Từ</span>
        {hasReading && <span>{label}</span>}
        <span>Nghĩa</span>
        {anyExample && <span className="hidden lg:inline">Ví dụ</span>}
      </div>

      <ul className="divide-y divide-[rgb(var(--border))]">
        {items.map((it) => {
          const playing = playingId === it.id;
          return (
            <li
              key={it.id}
              id={`vocab-${it.id}`}
              data-playing={playing ? "true" : undefined}
              onClick={
                it.audioUrl
                  ? () => {
                      if (window.getSelection()?.toString()) return; // đang bôi đen để copy/tra từ
                      toggle(it.id, it.audioUrl!);
                    }
                  : undefined
              }
              className={`grid grid-cols-1 gap-x-4 gap-y-0.5 rounded-lg px-2 py-1.5 transition-colors sm:items-start ${cols} ${
                playing ? "bg-brand-soft ring-2 ring-brand-300" : ""
              } ${it.audioUrl ? "cursor-pointer hover:bg-[rgb(var(--surface-muted))/0.5]" : ""}`}
            >
              <div className="flex items-center gap-2">
                {it.audioUrl && (
                  <button
                    type="button"
                    aria-label={`Nghe ${it.term}`}
                    aria-pressed={playing}
                    onClick={(e) => {
                      e.stopPropagation(); // không để hàng xử lý thêm một lần
                      toggle(it.id, it.audioUrl!);
                    }}
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      playing
                        ? "border-brand-400 bg-brand-100 text-brand-800"
                        : "border-token bg-[rgb(var(--surface))] hover:bg-brand-soft"
                    }`}
                  >
                    {playing ? <Pause size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
                  </button>
                )}
                {!it.audioUrl && anyAudio && <span className="h-7 w-7 shrink-0" aria-hidden />}
                <span className={`text-xl font-medium leading-snug ${SOURCE_TEXT_COLOR}`}>{it.term}</span>
              </div>
              {hasReading && (
                <span
                  data-masked={mask(!showReading && !!it.reading)}
                  className={`text-body text-muted sm:pt-0.5 ${blur(!showReading)}`}
                >
                  {it.reading}
                </span>
              )}
              <div className={`space-y-1 sm:pt-0.5 ${meaningColStart} ${!it.example && anyExample ? "lg:col-span-2" : ""}`}>
                <p data-masked={mask(!showMeaning)} className={`text-body font-medium text-muted ${blur(!showMeaning)}`}>
                  {it.meaning}
                </p>
                {it.note && <p className="text-caption italic">{it.note}</p>}
              </div>
              {it.example && (
                // Ví dụ: câu gốc + phiên âm trên một dòng, bản dịch dòng dưới, vạch lime bên trái.
                <div className={`border-l-2 border-brand-200 pl-2.5 sm:pt-0.5 ${exampleCls}`}>
                  <p className="text-meta text-muted">
                    <span className={`text-body ${SOURCE_TEXT_COLOR}`}>{it.example}</span>
                    {it.exampleReading && (
                      <span
                        data-masked={mask(!showReading)}
                        className={`ml-2 text-meta text-muted ${blur(!showReading)}`}
                      >
                        {it.exampleReading}
                      </span>
                    )}
                  </p>
                  {it.exampleMeaning && (
                    <p data-masked={mask(!showMeaning)} className={`text-meta text-muted ${blur(!showMeaning)}`}>
                      {it.exampleMeaning}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ToggleChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-8 rounded-full px-3.5 text-sm transition-colors ${
        pressed
          ? "bg-brand-100 font-medium text-brand-800 shadow-sm"
          : "text-muted line-through decoration-[rgb(var(--text-muted))/0.5] hover:bg-brand-soft"
      }`}
    >
      {children}
    </button>
  );
}
