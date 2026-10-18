"use client";

import { useEffect, useState } from "react";
import { Clock, Play } from "lucide-react";
import ResourceContent from "./ResourceContent";
import { LayoutSlideView, isLayoutSlide } from "./SlideLayouts";

// Slide "Nội dung" và đồng hồ đếm giờ, tách khỏi PresentDeck để trang xem công khai (/bai-giang/<mã>)
// dựng slide y hệt lúc trình chiếu mà không phải kéo theo cả màn trình chiếu.

// Đồng bộ qua LiveSession.uiState thay vì state cục bộ — startedAt là epoch ms
// do CỬA SỔ PRESENTER ghi lên server lúc bấm "Bắt đầu"; cửa sổ audience chỉ
// đọc lại (editable=false) qua polling, nên cả 2 cửa sổ luôn cùng 1 "nguồn
// thời gian thật" thay vì mỗi cửa sổ tự chạy setInterval riêng rồi lệch nhau.
export function SlideTimer({
  seconds,
  startedAt,
  editable,
  onStart,
}: {
  seconds: number;
  startedAt?: number;
  editable: boolean;
  onStart: () => void;
}) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const remaining = startedAt ? Math.max(0, seconds - elapsed) : seconds;
  const state: "ready" | "running" | "finished" = !startedAt ? "ready" : remaining <= 0 ? "finished" : "running";

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const style =
    state === "finished"
      ? "border-pink-400 bg-pink-50 text-pink-700 animate-pulse"
      : state === "running"
      ? "border-brand-400 bg-brand-50 text-brand-700"
      : "border-[#E3E0D3] bg-[#FCFBF7] text-[#3A3F38]";
  const label = state === "ready" ? "Sẵn sàng" : state === "running" ? "Đang chạy" : "Hết giờ";

  return (
    <div className={`inline-flex items-center gap-4 rounded-2xl border-2 px-6 py-3 ${style}`}>
      <Clock size={28} />
      <span className="text-base font-bold uppercase tracking-wide">{label}</span>
      <span className="font-mono text-5xl font-bold leading-none">
        {mm}:{ss}
      </span>
      {state === "ready" && editable && (
        <button onClick={onStart} className="btn-primary flex items-center gap-1.5 text-base">
          <Play size={16} /> Bắt đầu
        </button>
      )}
    </div>
  );
}

export function ContentSlideView({
  slideId,
  config,
  timerSeconds,
  timerStartedAt,
  editable,
  onStartTimer,
  lazyImages,
  zoom = 1,
  themeId,
  animate,
}: {
  /** Để biết thứ tự ô hình khi tự chọn hoa văn (xem liveMotifContext). */
  slideId?: string;
  themeId?: string | null;
  animate?: boolean;
  config: Record<string, any>;
  timerSeconds: number | null;
  timerStartedAt?: number;
  editable: boolean;
  onStartTimer: () => void;
  lazyImages?: boolean;
  zoom?: number;
}) {
  // CSS `zoom` của khung ngoài chỉ phóng chữ/kích thước cố định; ảnh/PDF vốn "vừa bề ngang"
  // (w-full) nên vẫn chiếm đúng bề ngang cũ → không thấy phóng to. Với chúng, nới bề ngang
  // thêm `zoom` lần (cuộn ngang khi vượt khung); chữ/markdown thì để reflow như thường.
  const fitScale = { width: `${zoom * 100}%`, maxWidth: zoom > 1 ? "none" : undefined } as React.CSSProperties;
  const bullets: string[] = config.bullets ?? [];

  // Đồng hồ là sticker nổi ở chân slide (không chiếm chỗ của nội dung); vùng
  // nội dung cuộn riêng nên học liệu dài vẫn giữ nguyên bề ngang, chỉ cuộn dọc.
  const timerSticker =
    timerSeconds != null ? (
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
        <div className="pointer-events-auto rounded-2xl bg-white/90 shadow-lg backdrop-blur">
          <SlideTimer seconds={timerSeconds} startedAt={timerStartedAt} editable={editable} onStart={onStartTimer} />
        </div>
      </div>
    ) : null;

  // Slide có bố cục mới (bìa, ba thẻ, các bước...) — do SlideLayouts vẽ trên khung 1280×720.
  if (isLayoutSlide(config)) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <LayoutSlideView config={config} themeId={themeId} slideId={slideId} animate={animate} zoom={zoom} />
        {timerSticker}
      </div>
    );
  }

  // Slide "Nội dung" chèn 1 tài nguyên (video/pdf/markdown/...) — ưu tiên
  // trước cả layout thường lẫn full-bleed ảnh PDF nhập (xem LiveDeckEditor).
  if (config.resource) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-10 pb-28">
          <div
            className="mx-auto w-full max-w-6xl"
            style={config.resource.type === "pdf" ? { ...fitScale, maxWidth: zoom > 1 ? "none" : "72rem" } : undefined}
          >
            <ResourceContent type={config.resource.type} payload={config.resource.payload} />
          </div>
        </div>
        {timerSticker}
      </div>
    );
  }

  // Slide nhập từ PDF (chỉ có ảnh, không tiêu đề/ý) — chiếu full-bleed thay
  // vì layout 2 cột sẽ để trống một nửa trơ trọi (xem LiveDeckEditor).
  const isImportedPage = !config.title && !config.subtitle && !bullets.length && !!config.imageUrl;
  if (isImportedPage) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col bg-[#F1EFE6]">
        {/* Trang PDF dài: ưu tiên bề ngang (chữ đủ to để đọc), chiều dọc cuộn chuột. */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={config.imageUrl} alt="" loading={lazyImages ? "lazy" : undefined} className="mx-auto block h-auto w-full max-w-[1600px]" style={fitScale} />
        </div>
        {timerSticker}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex flex-[1.1] flex-col justify-center gap-7 overflow-y-auto p-16 pb-28">
        <h1 className="text-[64px] font-extrabold leading-[1.1]">{config.title}</h1>
        {config.subtitle && <p className="text-[32px] leading-snug text-[#6B7268]">{config.subtitle}</p>}
        {bullets.length > 0 && (
          <ul className="list-disc space-y-3 pl-8 text-[30px] leading-snug text-[#3A3F38]">
            {bullets.map((b, idx) => (
              <li key={idx}>{b}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center bg-[#F1EFE6]">
        {config.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.imageUrl} alt="" loading={lazyImages ? "lazy" : undefined} className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg text-[#9AA090]">Ảnh/sơ đồ minh hoạ</span>
        )}
      </div>
      {timerSticker}
    </div>
  );
}
