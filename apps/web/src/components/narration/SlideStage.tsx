"use client";

import { Captions, CaptionsOff, ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Phần khung của chế độ trình chiếu (docs/tieu-chi/trinh-chieu-giang-vien.md): số slide, phụ đề, nút thoát (giảng viên đã có trên thanh phát).
 * Nội dung slide là chính trang bài (NarrationPlayer đánh dấu `data-slide-on`, CSS trong narration.css đưa nó ra toàn màn hình);
 * thanh phát ở dưới vẫn là điều khiển phát/tua/tốc độ như Nghe giảng.
 */
export default function SlideStage({
  index,
  count,
  subtitle,
  showSubtitles,
  onToggleSubtitles,
  onPrev,
  onNext,
  onExit,
}: {
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
        <span className="ml-auto" />
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

      {showSubtitles && subtitle && (
        <p className="slide-subtitle print:hidden" aria-hidden="true">
          {subtitle}
        </p>
      )}
    </>
  );
}
