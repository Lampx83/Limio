"use client";

import { Captions, CaptionsOff, ChevronLeft, ChevronRight, Maximize, Minimize, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NarrationAvatar } from "./NarrationAvatar";

/**
 * Phần khung của chế độ trình chiếu (docs/tieu-chi/trinh-chieu-giang-vien.md): nút thoát ở góc trên trái, ảnh giảng viên ở góc trên phải,
 * và phía dưới là phụ đề + thanh chuyển slide. Không có thanh nền trên cùng — slide chiếm trọn màn hình.
 * Nội dung slide là chính trang bài (NarrationPlayer đánh dấu `data-slide-on`, CSS trong narration.css đưa nó ra toàn màn hình);
 * thanh phát ở dưới vẫn là điều khiển phát/tua/tốc độ như Nghe giảng.
 */
export default function SlideStage({
  index,
  count,
  subtitle,
  showSubtitles,
  lecturer,
  speaking,
  waiting,
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
  lecturer?: { name?: string; accent?: string };
  speaking: boolean;
  /** Giọng đang dừng chờ học viên làm bài trên slide. */
  waiting: boolean;
  onToggleSubtitles: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onExit: () => void;
}) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const canFull = typeof document !== "undefined" && document.fullscreenEnabled;
  const toggleFull = () => {
    const op = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    op.catch(() => {
      /* trình duyệt từ chối (vd. iOS Safari): bỏ qua, trình chiếu vẫn dùng được */
    });
  };

  return (
    <>
      <button type="button" className="slide-pill slide-exit print:hidden" onClick={onExit} aria-label="Thoát trình chiếu (Esc)">
        <X size={18} />
        <span className="hidden sm:inline">Thoát</span>
      </button>

      <span className="slide-avatar print:hidden">
        <NarrationAvatar who="lecturer" name={lecturer?.name} accent={lecturer?.accent} size="sm" speaking={speaking} />
      </span>

      <div className="slide-dock print:hidden">
        {showSubtitles && subtitle && (
          <p className="slide-subtitle" aria-hidden="true">
            {subtitle}
          </p>
        )}
        {waiting && (
          <p className="slide-wait" role="status">
            Em làm xong rồi bấm <b>Tiếp tục</b> nhé
          </p>
        )}
        <div className="slide-pill slide-nav">
          <button type="button" className="slide-btn" onClick={() => onPrev?.()} disabled={!onPrev} aria-label="Slide trước">
            <ChevronLeft size={20} />
          </button>
          <span className="min-w-[3.5rem] text-center text-sm tabular-nums" aria-live="polite">
            {count > 0 ? `${index + 1} / ${count}` : "—"}
          </span>
          <button
            type="button"
            className={`slide-btn ${waiting ? "slide-btn-go" : ""}`}
            onClick={() => onNext?.()}
            disabled={!onNext}
            aria-label={waiting ? "Tiếp tục" : "Slide sau"}
          >
            {waiting && <span className="text-sm font-medium">Tiếp tục</span>}
            <ChevronRight size={20} />
          </button>
          <span className="slide-sep" aria-hidden="true" />
          <button
            type="button"
            className="slide-btn"
            onClick={onToggleSubtitles}
            aria-pressed={showSubtitles}
            aria-label={showSubtitles ? "Tắt phụ đề" : "Bật phụ đề"}
          >
            {showSubtitles ? <Captions size={20} /> : <CaptionsOff size={20} />}
          </button>
          {canFull && (
            <button type="button" className="slide-btn" onClick={toggleFull} aria-pressed={full} aria-label={full ? "Thoát toàn màn hình" : "Toàn màn hình"}>
              {full ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
