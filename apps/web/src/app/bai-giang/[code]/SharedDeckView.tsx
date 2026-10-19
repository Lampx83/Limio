"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { BrandConfig } from "@/lib/limioLiveBrand";
import { brandFrameBackground } from "@/lib/limioLiveBrand";
import { pdfTitle, type PublicSlide, type PublicSlideType } from "@/lib/limioLiveShare";
import { ContentSlideView } from "@/app/instructor/limio-live/ContentSlideView";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "@/app/instructor/limio-live/ResourceContent";
import { isLayoutSlide } from "@/app/instructor/limio-live/SlideLayouts";
import { slideBgFor } from "@/app/instructor/limio-live/slideThemes";
import { BrandLogoOverlay, BrandLogoSpacer, LiveBrandProvider } from "@/app/instructor/limio-live/liveBrandContext";
import { LiveLangProvider } from "@/app/instructor/limio-live/liveLangContext";
import { LiveMotifProvider } from "@/app/instructor/limio-live/liveMotifContext";
import "./sharedDeck.css";

// Khung thiết kế của slide: đúng cỡ trang in 16:9 (13,333 × 7,5 inch ở 96 dpi), nên khi in mỗi slide là một trang
// mà không phải co giãn; trên màn hình thì thu nhỏ theo bề ngang chỗ trống.
const W = 1280;
const H = 720;

const INTERACTIVE_LABELS: Record<Exclude<PublicSlideType, "content">, string> = {
  quiz: "Trắc nghiệm",
  poll: "Bình chọn",
  word_cloud: "Word Cloud",
  collaborate_board: "Dán Note",
  whiteboard: "Bảng trắng",
};

/** Học liệu không in ra giấy được (khung video, trang web nhúng, PDF cuộn): khi in thay bằng thẻ tên + đường link. */
const UNPRINTABLE_RESOURCES = new Set(["video", "embed", "pdf"]);

export default function SharedDeckView({
  deckId,
  motif,
  language,
  imageFrame,
  title,
  ownerName,
  theme,
  brand,
  slides,
}: {
  /** Chỉ để chọn hoa văn tự động giống lúc trình chiếu (limioLiveMotifs). */
  deckId: string;
  motif: string | null;
  /** Ngôn ngữ của bài: chữ hệ thống trên slide (docs/tieu-chi/ngon-ngu-slide.md). */
  language: string | null;
  /** Khung hình của các ô hình (null = tự động theo hoa văn). */
  imageFrame: string | null;
  title: string;
  ownerName: string;
  theme: string;
  brand: BrandConfig | null;
  slides: PublicSlide[];
}) {
  const [preparing, setPreparing] = useState(false);

  async function handleDownloadPdf() {
    setPreparing(true);
    try {
      // Chờ ảnh và phông tải xong (tối đa 8 giây), nếu không bản in có thể thiếu hình.
      const pending = Array.from(document.images)
        .filter((img) => !img.complete)
        .map((img) => new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }));
      await Promise.race([
        Promise.all([...pending, document.fonts?.ready]),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    } finally {
      setPreparing(false);
    }
    // Trình duyệt lấy tiêu đề trang làm tên tệp PDF gợi ý.
    const prevTitle = document.title;
    document.title = pdfTitle(title);
    window.print();
    document.title = prevTitle;
  }

  return (
    <LiveBrandProvider brand={brand}>
    <LiveLangProvider lang={language}>
      <LiveMotifProvider deckId={deckId} motif={motif} imageFrame={imageFrame} slides={slides}>
      <main className="shared-deck mx-auto w-full max-w-5xl px-4 py-6 lg:px-6">
        <header data-print-hide className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-h1 break-words">{title}</h1>
            <p className="mt-1 text-meta">
              Bài giảng của {ownerName} · {slides.length} slide
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
            <button onClick={handleDownloadPdf} disabled={preparing || slides.length === 0} className="btn-primary flex items-center gap-2">
              {preparing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {preparing ? "Đang chuẩn bị…" : "Tải PDF"}
            </button>
            <p className="text-caption text-muted">Trong hộp in, chọn “Lưu thành PDF”.</p>
          </div>
        </header>

        {slides.length === 0 ? (
          <p className="text-body text-muted">Bài giảng này chưa có slide nào.</p>
        ) : (
          <ol className="flex flex-col gap-6">
            {slides.map((slide, i) => (
              <li key={slide.id} className="shared-slide-item">
                <ScaledSlide>
                  <SlideFrame slide={slide} theme={theme} brand={brand} />
                </ScaledSlide>
                <p data-print-hide className="mt-1.5 text-right text-caption text-muted">
                  {i + 1}/{slides.length}
                </p>
              </li>
            ))}
          </ol>
        )}
      </main>
      </LiveMotifProvider>
    </LiveLangProvider>
    </LiveBrandProvider>
  );
}

/** Dựng slide ở khung 1280×720 rồi thu theo bề ngang chỗ trống (giữ tỉ lệ). Khi in, sharedDeck.css đưa về đúng cỡ thật. */
function ScaledSlide({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / W);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="shared-slide-box relative w-full overflow-hidden rounded-xl shadow-[0_8px_24px_rgba(32,36,31,0.12)]" style={{ aspectRatio: `${W} / ${H}` }}>
      <div
        className="shared-slide-scale absolute left-0 top-0 origin-top-left"
        style={{ width: W, height: H, ["--slide-scale" as string]: scale, visibility: scale > 0 ? "visible" : "hidden" }}
      >
        {children}
      </div>
    </div>
  );
}

function SlideFrame({ slide, theme, brand }: { slide: PublicSlide; theme: string; brand: BrandConfig | null }) {
  const config = slide.config as Record<string, any>;
  const layout = slide.type === "content" && isLayoutSlide(config);
  const resourceType: string | undefined = slide.type === "content" ? config.resource?.type : undefined;
  return (
    <div
      className={`relative box-border flex h-full w-full flex-col overflow-hidden text-[#20241F] ${slide.type === "content" ? "p-0" : "p-12"}`}
      style={{ background: brandFrameBackground(brand, layout) ?? slideBgFor(theme, layout) }}
    >
      {!layout && <BrandLogoSpacer role="other" edge="t" />}
      <div className="flex min-h-0 flex-1 flex-col">
        {slide.type === "content" ? (
          resourceType && UNPRINTABLE_RESOURCES.has(resourceType) ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col print:hidden">
                <ContentSlideView slideId={slide.id} config={config} timerSeconds={null} editable={false} onStartTimer={noop} themeId={theme} />
              </div>
              <ResourcePrintCard type={resourceType} payload={config.resource?.payload ?? {}} />
            </>
          ) : (
            <ContentSlideView slideId={slide.id} config={config} timerSeconds={null} editable={false} onStartTimer={noop} themeId={theme} />
          )
        ) : (
          <InteractiveSlide type={slide.type} config={config} />
        )}
      </div>
      {!layout && <BrandLogoSpacer role="other" edge="b" />}
      {!layout && <BrandLogoOverlay role="other" />}
    </div>
  );
}

const noop = () => {};

function ResourcePrintCard({ type, payload }: { type: string; payload: Record<string, any> }) {
  const label = (RESOURCE_TYPE_LABELS as Record<string, string>)[type as ResourceType] ?? "Học liệu";
  return (
    <div className="hidden flex-1 flex-col justify-center gap-5 p-16 print:flex">
      <p className="text-[22px] font-bold uppercase tracking-wide text-[#6B7268]">{label}</p>
      {payload.title && <p className="text-[48px] font-bold leading-tight">{payload.title}</p>}
      {payload.url && <p className="break-all text-[26px] text-[#3A3F38]">{payload.url}</p>}
      <p className="text-[22px] text-[#6B7268]">Mở đường link trên để xem nội dung này.</p>
    </div>
  );
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Slide tương tác ở bản xem: chỉ đề bài và các lựa chọn, không đáp án, không kết quả của lớp. */
function InteractiveSlide({ type, config }: { type: Exclude<PublicSlideType, "content">; config: Record<string, any> }) {
  const options: { text: string }[] = Array.isArray(config.options) ? config.options : [];
  const heading =
    type === "quiz" || type === "poll"
      ? config.question
      : type === "word_cloud"
        ? config.prompt
        : type === "collaborate_board"
          ? config.prompt || config.title
          : config.title;
  const compact = options.length > 4;
  const label = type === "collaborate_board" && config.mode === "drawing" ? "Draw-it (vẽ)" : INTERACTIVE_LABELS[type];
  const columns: string[] = type === "collaborate_board" && config.mode === "grouped" && Array.isArray(config.columns) ? config.columns : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="mb-3 text-[20px] font-bold uppercase tracking-wide text-[#6B7268]">{label}</p>
      <h2 className="mb-8 text-[48px] font-bold leading-tight">{heading || "(Chưa có đề bài)"}</h2>
      {options.length > 0 && (
        <ol className={`flex min-h-0 flex-1 flex-col justify-center ${compact ? "gap-2.5" : "gap-4"}`}>
          {options.map((opt, idx) => (
            <li
              key={idx}
              className={`flex items-center gap-5 rounded-2xl border-2 border-[#E3E0D3] bg-white px-6 ${compact ? "py-2.5" : "py-5"}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F1EFE6] text-xl font-bold text-[#6B7268]">
                {LETTERS[idx] ?? idx + 1}
              </span>
              <span className={`flex-grow font-semibold leading-snug ${compact ? "text-[26px]" : "text-[32px]"}`}>{opt.text}</span>
            </li>
          ))}
        </ol>
      )}
      {columns.length > 0 && <p className="text-[28px] text-[#3A3F38]">Các nhóm: {columns.join(" · ")}</p>}
      <p className="mt-auto pt-6 text-[22px] text-[#6B7268]">Slide tương tác: học viên trả lời khi giảng viên trình chiếu.</p>
    </div>
  );
}
