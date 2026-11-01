"use client";

import { Captions, CaptionsOff, ChevronLeft, ChevronRight, X } from "lucide-react";
import { NarrationAvatar } from "./NarrationAvatar";

/**
 * Phần khung của chế độ trình chiếu (docs/tieu-chi/trinh-chieu-giang-vien.md): giảng viên, số slide, phụ đề, nút thoát.
 * Nội dung slide là chính trang bài (NarrationPlayer đánh dấu `data-slide-on`, CSS trong narration.css đưa nó ra toàn màn hình);
 * thanh phát ở dưới vẫn là điều khiển phát/tua/tốc độ như Nghe giảng.
 */
export default function SlideStage({
  lecturer,
  speaking,
  index,
  count,
  subtitle,
  showSubtitles,
  onToggleSubtitles,
  onPrev,
  onNext,
  onExit,
}: {
  lecturer: { name: string; accent?: string };
  speaking: boolean;
  /** Slide đang hiện, từ 0. */
  index: number;
  count: number;
  subtitle: string;
  showSubtitles: boolean;
  onToggleSubtitles: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onExit: () => void;
}) {
  return (
    <>
      <div className="slide-top print:hidden">
        <NarrationAvatar who="lecturer" name={lecturer.name} accent={lecturer.accent} size="sm" speaking={speaking} className="lg:hidden" />
        <span className="hidden min-w-0 truncate text-sm font-semibold sm:block lg:hidden">{lecturer.name}</span>
        <span className="ml-auto lg:ml-0" />
        <button type="button" className="slide-btn" onClick={() => onPrev?.()} disabled={!onPrev} aria-label="Slide trước">
          <ChevronLeft size={20} />
        </button>
        <span className="min-w-[3.5rem] text-center text-sm tabular-nums text-muted" aria-live="polite">
          {count > 0 ? `${index + 1} / ${count}` : "—"}
        </span>
        <button type="button" className="slide-btn" onClick={() => onNext?.()} disabled={!onNext} aria-label="Slide sau">
          <ChevronRight size={20} />
        </button>
        <button
          type="button"
          className="slide-btn"
          onClick={onToggleSubtitles}
          aria-pressed={showSubtitles}
          aria-label={showSubtitles ? "Tắt phụ đề" : "Bật phụ đề"}
        >
          {showSubtitles ? <Captions size={20} /> : <CaptionsOff size={20} />}
        </button>
        <button type="button" className="slide-btn slide-btn-text" onClick={onExit} aria-label="Thoát trình chiếu (Esc)">
          <X size={18} />
          <span className="hidden sm:inline">Thoát</span>
        </button>
      </div>

      <aside className="slide-lecturer print:hidden" aria-label={`Giảng viên ${lecturer.name}`}>
        <NarrationAvatar who="lecturer" name={lecturer.name} accent={lecturer.accent} size="lg" speaking={speaking} />
        <p className="mt-2 text-sm font-semibold">{lecturer.name}</p>
        <p className="text-xs text-muted">{speaking ? "Đang giảng" : "Tạm dừng"}</p>
      </aside>

      {showSubtitles && subtitle && (
        <p className="slide-subtitle print:hidden" aria-hidden="true">
          {subtitle}
        </p>
      )}
    </>
  );
}
