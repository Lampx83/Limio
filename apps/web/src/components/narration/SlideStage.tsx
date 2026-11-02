"use client";

import { Captions, CaptionsOff, ChevronLeft, ChevronRight, Maximize, Minimize, X } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import { NarrationAvatar, lecturerPhoto } from "./NarrationAvatar";
import LecturerVideo from "./LecturerVideo";

/**
 * Phần khung của chế độ trình chiếu (docs/tieu-chi/trinh-chieu-giang-vien.md): nút thoát ở góc trên trái và ảnh giảng viên.
 * Phụ đề + chuyển slide là `SlideDock`, nằm trong thanh phát để cả dải điều khiển chỉ cao một hàng — slide chiếm trọn màn hình.
 * Nội dung slide là chính trang bài (NarrationPlayer đánh dấu `data-slide-on`, CSS trong narration.css đưa nó ra toàn màn hình).
 */
export default function SlideStage({
  lecturer,
  video,
  speaking,
  onExit,
}: {
  lecturer?: { name?: string; accent?: string };
  /** Có video giảng viên nói cho bài này (AC7): video thay ảnh tĩnh ở góc dưới phải, chạy theo thẻ audio. */
  video?: { lessonId: string; audio: RefObject<HTMLAudioElement | null> };
  speaking: boolean;
  onExit: () => void;
}) {
  return (
    <>
      <button type="button" className="slide-pill slide-exit print:hidden" onClick={onExit} aria-label="Thoát trình chiếu (Esc)">
        <X size={20} />
      </button>

      <span className="slide-avatar print:hidden" data-speaking={speaking ? "1" : "0"}>
        {video ? (
          <LecturerVideo lessonId={video.lessonId} audio={video.audio} photo={lecturerPhoto(lecturer?.name)} name={lecturer?.name} accent={lecturer?.accent} speaking={speaking} />
        ) : (
          <NarrationAvatar who="lecturer" name={lecturer?.name} accent={lecturer?.accent} size="sm" speaking={speaking} />
        )}
      </span>
    </>
  );
}

/**
 * Phụ đề + chuyển slide. Nằm TRONG thanh phát (cùng hàng với nút phát) để dải điều khiển chỉ một hàng;
 * trên điện thoại CSS đưa nó ra khỏi thanh thành cụm nổi riêng.
 */
export function SlideDock({
  index,
  count,
  showCount,
  subtitle,
  showSubtitles,
  waiting,
  prompt,
  onToggleSubtitles,
  onPrev,
  onNext,
}: {
  /** Slide đang hiện, từ 0. */
  index: number;
  count: number;
  /** Khung slide tương tác đã tự hiện «n / N» ở góc trên: không lặp lại ở đây. */
  showCount: boolean;
  subtitle: string;
  showSubtitles: boolean;
  /** Giọng đang dừng chờ học viên làm bài trên slide. */
  waiting: boolean;
  /** Lời nhắc của điểm dừng ở cuối bước (`[chờ: …]`, `[nghĩ n: …]`). Rỗng thì dùng câu chung. */
  prompt: string;
  onToggleSubtitles: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
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
    <div className="slide-dock print:hidden">
      <div className="slide-pill slide-nav">
        <button type="button" className="slide-btn" onClick={() => onPrev?.()} disabled={!onPrev} aria-label="Slide trước">
          <ChevronLeft size={20} />
        </button>
        {showCount && (
          <span className="min-w-[3.5rem] text-center text-sm tabular-nums" aria-live="polite">
            {count > 0 ? `${index + 1} / ${count}` : "—"}
          </span>
        )}
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
      {showSubtitles && subtitle && !waiting && (
        <p className="slide-subtitle" aria-hidden="true">
          {subtitle}
        </p>
      )}
      {waiting && (
        <p className="slide-wait" role="status">
          {prompt ? (
            <b className="slide-wait-prompt">{prompt}</b>
          ) : (
            <>
              Em làm xong rồi bấm <b>Tiếp tục</b> nhé
            </>
          )}
        </p>
      )}
    </div>
  );
}
