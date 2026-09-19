"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Clock, Play, Presentation, Monitor, Maximize2, Minimize2, EyeOff, Eye } from "lucide-react";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { copyText } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import EmptyState from "@/components/ui/EmptyState";
import ResourceContent from "../../ResourceContent";

const QRCode = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => <div className="rounded-lg bg-white" style={{ width: 88, height: 88 }} />,
  }
);

type SlideType = "content" | "quiz" | "poll" | "word_cloud" | "collaborate_board";

interface Slide {
  id: string;
  type: SlideType;
  config: Record<string, any>;
  timerSeconds: number | null;
  orderIndex: number;
}

interface Deck {
  id: string;
  title: string;
  slides: Slide[];
}

type Runtime =
  | { kind: "content" }
  | { kind: "poll" | "quiz"; refId: string; joinPath: string }
  | { kind: "word_cloud"; refId: string; joinPath: string }
  | { kind: "collaborate_board"; refId: string; code: string; joinPath: string };

const TYPE_LABELS: Record<SlideType, string> = {
  content: "Nội dung",
  quiz: "Trắc nghiệm",
  poll: "Thăm dò",
  word_cloud: "Word Cloud",
  collaborate_board: "Collaborate Board",
};

interface UiState {
  timerStartedAt?: Record<string, number>;
  revealed?: Record<string, boolean>;
}

export default function PresentDeck({ deckId }: { deckId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode: "presenter" | "audience" = searchParams.get("view") === "audience" ? "audience" : "presenter";

  const [deck, setDeck] = useState<Deck | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSlideId, setCurrentSlideId] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [uiState, setUiState] = useState<UiState>({});
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [loadingSlide, setLoadingSlide] = useState(true);
  const [ending, setEnding] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);

  // Full-bleed sân khấu tối — nới khung main.mx-auto của instructor layout ra
  // hết viewport, cùng cơ chế với board-immersive/gameshow-immersive.
  useEffect(() => {
    document.body.classList.add("limio-live-immersive");
    return () => document.body.classList.remove("limio-live-immersive");
  }, []);

  // 3 chế độ trình chiếu đều dùng chung 1 trang này, chỉ khác cờ hiển thị:
  // mặc định = presenter view 2 cửa sổ (không đổi gì); bấm Fullscreen = giữ
  // nguyên UI nhưng chiếm hết màn hình OS (Fullscreen API); bấm thêm "Ẩn điều
  // khiển" = gỡ header/aside, chỉ còn slide — 3 lựa chọn này KHÔNG loại trừ
  // nhau, GV tự bật/tắt tuỳ tình huống thay vì phải chọn trước 1 màn hình mode.
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        toast.error("Trình duyệt chặn fullscreen — thử bấm lại");
      });
    }
  };

  // Cả 2 cửa sổ (presenter + audience) cùng resume 1 session — POST /present
  // là idempotent (trả về session đang active nếu có), nên cửa sổ nào gọi
  // sau cũng không tạo trùng. Cửa sổ presenter điều khiển (POST slides/[id]);
  // cửa sổ audience chỉ đọc, không mutate (xem effect polling bên dưới).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const deckRes = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}`));
        if (!deckRes.ok) { toast.error("Không tải được bài giảng"); return; }
        const deckData: Deck = await deckRes.json();
        if (cancelled) return;
        setDeck(deckData);

        const presentRes = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/present`), {
          method: "POST",
        });
        if (!presentRes.ok) { toast.error("Không bắt đầu được trình chiếu"); return; }
        const session = await presentRes.json();
        if (cancelled) return;
        setSessionId(session.id);
        setUiState(session.uiState ?? {});
        setEndedAt(session.endedAt ?? null);

        if (mode === "presenter") {
          if (session.currentSlideId) {
            await visitSlide(session.id, session.currentSlideId);
          } else {
            setLoadingSlide(false);
          }
        } else {
          setCurrentSlideId(session.currentSlideId);
          setLoadingSlide(false);
        }
      } catch {
        toast.error("Lỗi mạng");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, mode]);

  // Audience window không tự điều hướng — chỉ poll cửa sổ presenter đã đi
  // tới đâu (currentSlideId/runtime/uiState) để mirror lại lên màn chiếu.
  useEffect(() => {
    if (mode !== "audience" || !sessionId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/present/${sessionId}`));
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setCurrentSlideId(data.currentSlideId);
        setRuntime(data.runtime);
        setUiState(data.uiState ?? {});
        setEndedAt(data.endedAt ?? null);
      } catch {
        /* bỏ qua lỗi poll thoáng qua — lần poll sau sẽ tự sửa */
      }
    };
    poll();
    const t = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [mode, sessionId, deckId]);

  const visitSlide = async (sid: string, slideId: string) => {
    setLoadingSlide(true);
    try {
      const res = await fetch(
        apiUrl(`/api/instructor/limio-live/decks/${deckId}/present/${sid}/slides/${slideId}`),
        { method: "POST" }
      );
      if (!res.ok) { toast.error("Không mở được slide"); return; }
      const data = await res.json();
      setCurrentSlideId(slideId);
      setRuntime(data.runtime);
      setUiState(data.session?.uiState ?? {});
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setLoadingSlide(false);
    }
  };

  // Presenter-only: merge vào uiState trên server để cửa sổ audience (đang
  // poll GET ở trên) thấy được — optimistic update trước, server trả về bản
  // chính thức để sửa lại nếu lệch.
  const patchUiState = async (patch: Record<string, unknown>) => {
    if (!sessionId) return;
    setUiState((prev) => ({ ...prev, ...patch }));
    try {
      const res = await fetch(
        apiUrl(`/api/instructor/limio-live/decks/${deckId}/present/${sessionId}/ui-state`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patch }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setUiState(data.uiState ?? {});
      }
    } catch {
      /* optimistic state vẫn đứng — lần điều hướng/patch kế tiếp sẽ tự sửa */
    }
  };

  const handleStartTimer = (slideId: string) => {
    patchUiState({ timerStartedAt: { ...(uiState.timerStartedAt ?? {}), [slideId]: Date.now() } });
  };

  const handleToggleReveal = (slideId: string) => {
    const current = uiState.revealed ?? {};
    patchUiState({ revealed: { ...current, [slideId]: !current[slideId] } });
  };

  const handleOpenAudienceWindow = () => {
    window.open(`${pathname}?view=audience`, "_blank", "noopener,noreferrer");
  };

  const slides = deck?.slides ?? [];
  const currentIndex = slides.findIndex((s) => s.id === currentSlideId);
  const currentSlide = currentIndex >= 0 ? slides[currentIndex] : null;

  const goNext = () => {
    if (!sessionId || currentIndex < 0) return;
    const next = slides[currentIndex + 1];
    if (next) visitSlide(sessionId, next.id);
  };

  const goPrev = () => {
    if (!sessionId || currentIndex < 0) return;
    const prev = slides[currentIndex - 1];
    if (prev) visitSlide(sessionId, prev.id);
  };

  // Điều hướng bằng phím tên lửa — cần thiết cho chế độ "Ẩn điều khiển"
  // (không còn nút Prev/Next trên màn hình) và tiện luôn cả khi đang fullscreen.
  useEffect(() => {
    if (mode !== "presenter") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentIndex, slides.length, sessionId]);

  const handleEnd = async () => {
    if (!sessionId) return;
    if (!confirm("Kết thúc buổi trình chiếu này? Bạn vẫn có thể xem lại kết quả sau.")) return;
    setEnding(true);
    try {
      await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/present/${sessionId}/end`), {
        method: "POST",
      });
      router.push(`/instructor/limio-live/${deckId}`);
    } catch {
      toast.error("Lỗi mạng");
      setEnding(false);
    }
  };

  if (!deck) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[rgb(var(--surface-muted))]">
        <p className="text-sm text-muted">Đang tải...</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[rgb(var(--surface-muted))] p-6">
        <div className="rounded-2xl bg-[rgb(var(--surface))] p-2 shadow-xl">
          <EmptyState
            icon={<Presentation size={40} className="mx-auto" />}
            title="Bài giảng chưa có slide nào"
            description="Quay lại soạn bài giảng để thêm slide trước khi trình chiếu."
            actions={[{ label: "Quay lại soạn", href: `/instructor/limio-live/${deckId}` }]}
          />
        </div>
      </div>
    );
  }

  if (mode === "audience" && endedAt) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[rgb(var(--surface-muted))]">
        <p className="text-lg text-muted">Buổi trình chiếu đã kết thúc.</p>
      </div>
    );
  }

  const hasSidebar = !!currentSlide && currentSlide.type !== "content";
  const presenterNote =
    mode === "presenter" && currentSlide?.type === "content"
      ? String(currentSlide.config?.presenterNote ?? "").trim()
      : "";

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col bg-[rgb(var(--surface-muted))] font-sans text-[rgb(var(--text))]">
      {/* Header — cùng tông sáng với canvas soạn bài (LiveDeckEditor), không
          còn nền tối "sân khấu" kiểu theater mode nữa. Ẩn hẳn khi bật
          "Ẩn điều khiển" (chromeHidden) — chỉ còn slide, điều hướng bằng phím. */}
      {!chromeHidden && (
        <header className="flex min-h-16 flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-token bg-[rgb(var(--surface))] px-6 py-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-bold tracking-wide text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            {mode === "presenter" ? "ĐANG TRÌNH CHIẾU" : "MÀN HÌNH CHIẾU"}
          </span>
          <span className="min-w-0 truncate text-sm text-muted">
            {deck.title} · Slide {currentIndex >= 0 ? currentIndex + 1 : "-"}/{slides.length}
            {currentSlide ? ` · ${TYPE_LABELS[currentSlide.type]}` : ""}
          </span>
          <div className="flex-grow" />
          <button
            onClick={toggleFullscreen}
            className="btn-secondary flex items-center gap-1.5 text-[13px]"
            aria-label={isFullscreen ? "Thoát fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFullscreen ? "Thoát fullscreen" : "Fullscreen"}
          </button>
          {mode === "presenter" && (
            <>
              <button onClick={handleOpenAudienceWindow} className="btn-secondary flex items-center gap-1.5 text-[13px]">
                <Monitor size={14} /> Mở màn hình chiếu
              </button>
              <button
                onClick={() => setChromeHidden(true)}
                className="btn-secondary flex items-center gap-1.5 text-[13px]"
              >
                <EyeOff size={14} /> Ẩn điều khiển
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={goPrev}
                  disabled={currentIndex <= 0}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-token bg-[rgb(var(--surface-muted))] text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface))] disabled:opacity-30"
                  aria-label="Slide trước"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={goNext}
                  disabled={currentIndex < 0 || currentIndex >= slides.length - 1}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-white shadow-sm transition hover:shadow-brand-glow disabled:opacity-30"
                  aria-label="Slide tiếp"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <button
                onClick={handleEnd}
                disabled={ending}
                className="rounded-lg border border-red-200 bg-[rgb(var(--surface))] px-3.5 py-2 text-[13px] font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
              >
                Kết thúc
              </button>
            </>
          )}
        </header>
      )}

      <main className="flex min-h-0 flex-1">
        <div className="flex flex-1 items-center justify-center p-9">
          {loadingSlide || !currentSlide ? (
            <p className="text-sm text-muted">Đang tải slide...</p>
          ) : (
            <div
              key={currentSlide.id}
              className={`box-border flex h-[600px] w-full flex-col rounded-[20px] bg-white text-[#20241F] shadow-[0_12px_32px_rgba(32,36,31,0.12)] ${
                (hasSidebar || presenterNote) && !chromeHidden ? "max-w-[920px] p-14" : "max-w-[1040px] overflow-hidden p-0"
              }`}
            >
              <SlideStage
                slide={currentSlide}
                runtime={runtime}
                timerStartedAt={uiState.timerStartedAt?.[currentSlide.id]}
                editable={mode === "presenter"}
                onStartTimer={() => handleStartTimer(currentSlide.id)}
                revealed={!!uiState.revealed?.[currentSlide.id]}
                onToggleReveal={() => handleToggleReveal(currentSlide.id)}
              />
            </div>
          )}
        </div>

        {!chromeHidden && (hasSidebar || presenterNote) && currentSlide && (
          <aside className="w-[300px] flex-shrink-0 border-l border-token bg-[rgb(var(--surface))] p-5">
            {hasSidebar ? (
              <FeedbackSidebar key={currentSlide.id} slide={currentSlide} runtime={runtime} />
            ) : (
              <PresenterNotesPanel key={currentSlide.id} note={presenterNote} />
            )}
          </aside>
        )}
      </main>

      {chromeHidden && (
        <button
          onClick={() => setChromeHidden(false)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-2 text-xs font-medium text-white opacity-30 transition hover:opacity-100"
          aria-label="Hiện điều khiển"
        >
          <Eye size={14} /> Hiện điều khiển
        </button>
      )}
    </div>
  );
}

// ── Center card ──────────────────────────────────────────────────────────

function SlideStage({
  slide,
  runtime,
  timerStartedAt,
  editable,
  onStartTimer,
  revealed,
  onToggleReveal,
}: {
  slide: Slide;
  runtime: Runtime | null;
  timerStartedAt?: number;
  editable: boolean;
  onStartTimer: () => void;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const config = slide.config ?? {};

  if (slide.type === "content") {
    return (
      <ContentSlideView
        config={config}
        timerSeconds={slide.timerSeconds}
        timerStartedAt={timerStartedAt}
        editable={editable}
        onStartTimer={onStartTimer}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {slide.timerSeconds != null && (
        <div className="mb-5">
          <SlideTimer seconds={slide.timerSeconds} startedAt={timerStartedAt} editable={editable} onStart={onStartTimer} />
        </div>
      )}

      {(slide.type === "quiz" || slide.type === "poll") && runtime?.kind === slide.type && (
        <QuestionSlideView
          question={config.question}
          options={(config.options ?? []).map((o: { text: string }) => o.text)}
          correctIndex={
            slide.type === "quiz"
              ? (config.options ?? []).findIndex((o: { correct?: boolean }) => o.correct)
              : -1
          }
          isQuiz={slide.type === "quiz"}
          refId={runtime.refId}
          revealed={revealed}
          onToggleReveal={onToggleReveal}
          showToggle={editable}
        />
      )}

      {slide.type === "word_cloud" && runtime?.kind === "word_cloud" && (
        <WordCloudSlideView prompt={config.prompt} refId={runtime.refId} />
      )}

      {slide.type === "collaborate_board" && runtime?.kind === "collaborate_board" && (
        <BoardSlideView prompt={config.prompt} code={runtime.code} />
      )}
    </div>
  );
}

// Đồng bộ qua LiveSession.uiState thay vì state cục bộ — startedAt là epoch ms
// do CỬA SỔ PRESENTER ghi lên server lúc bấm "Bắt đầu"; cửa sổ audience chỉ
// đọc lại (editable=false) qua polling, nên cả 2 cửa sổ luôn cùng 1 "nguồn
// thời gian thật" thay vì mỗi cửa sổ tự chạy setInterval riêng rồi lệch nhau.
function SlideTimer({
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
    <div className={`inline-flex items-center gap-3 rounded-xl border-2 px-4 py-2 ${style}`}>
      <Clock size={16} />
      <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      <span className="font-mono text-2xl font-bold leading-none">
        {mm}:{ss}
      </span>
      {state === "ready" && editable && (
        <button onClick={onStart} className="btn-primary btn-sm flex items-center gap-1">
          <Play size={12} /> Bắt đầu
        </button>
      )}
    </div>
  );
}

function ContentSlideView({
  config,
  timerSeconds,
  timerStartedAt,
  editable,
  onStartTimer,
}: {
  config: Record<string, any>;
  timerSeconds: number | null;
  timerStartedAt?: number;
  editable: boolean;
  onStartTimer: () => void;
}) {
  const bullets: string[] = config.bullets ?? [];

  // Slide "Nội dung" chèn 1 tài nguyên (video/pdf/markdown/...) — ưu tiên
  // trước cả layout thường lẫn full-bleed ảnh PDF nhập (xem LiveDeckEditor).
  if (config.resource) {
    return (
      <div className="relative flex h-full flex-col overflow-y-auto p-10">
        {timerSeconds != null && (
          <div className="mb-4">
            <SlideTimer seconds={timerSeconds} startedAt={timerStartedAt} editable={editable} onStart={onStartTimer} />
          </div>
        )}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-3xl">
            <ResourceContent type={config.resource.type} payload={config.resource.payload} />
          </div>
        </div>
      </div>
    );
  }

  // Slide nhập từ PDF (chỉ có ảnh, không tiêu đề/ý) — chiếu full-bleed thay
  // vì layout 2 cột sẽ để trống một nửa trơ trọi (xem LiveDeckEditor).
  const isImportedPage = !config.title && !config.subtitle && !bullets.length && !!config.imageUrl;
  if (isImportedPage) {
    return (
      <div className="relative flex h-full items-center justify-center bg-[#F1EFE6]">
        {timerSeconds != null && (
          <div className="absolute left-4 top-4">
            <SlideTimer seconds={timerSeconds} startedAt={timerStartedAt} editable={editable} onStart={onStartTimer} />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={config.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-[1.1] flex-col justify-center gap-5 p-14">
        {timerSeconds != null && (
          <SlideTimer seconds={timerSeconds} startedAt={timerStartedAt} editable={editable} onStart={onStartTimer} />
        )}
        <h1 className="text-[38px] font-extrabold leading-tight">{config.title}</h1>
        {config.subtitle && <p className="text-lg text-[#6B7268]">{config.subtitle}</p>}
        {bullets.length > 0 && (
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-[#3A3F38]">
            {bullets.map((b, idx) => (
              <li key={idx}>{b}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center bg-[#F1EFE6]">
        {config.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-[#9AA090]">Ảnh/sơ đồ minh hoạ</span>
        )}
      </div>
    </div>
  );
}

// ── Right sidebar — join box + live feedback ───────────────────────────────

function FeedbackSidebar({ slide, runtime }: { slide: Slide; runtime: Runtime | null }) {
  if (!runtime || runtime.kind === "content") return null;

  return (
    <div>
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-faint">
        Tham gia slide này
      </div>
      <JoinBox joinPath={runtime.joinPath} />

      <div className="mt-5 text-[11px] font-bold uppercase tracking-wide text-faint">
        Phản hồi
      </div>
      {(runtime.kind === "poll" || runtime.kind === "quiz") && (
        <LiveResponseStats refId={runtime.refId} slide={slide} />
      )}
      {runtime.kind === "word_cloud" && <LiveWordCloudStats refId={runtime.refId} />}
      {runtime.kind === "collaborate_board" && <LiveBoardStats code={runtime.code} />}
    </div>
  );
}

// Chỉ render ở cửa sổ presenter (xem điều kiện `presenterNote` ở component
// cha) — đây chính là lý do phải tách 2 cửa sổ: nội dung này không bao giờ đi
// qua cửa sổ audience/màn chiếu, kể cả qua props hay polling.
function PresenterNotesPanel({ note }: { note: string }) {
  return (
    <div>
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-faint">
        Ghi chú của bạn — không hiện lên màn chiếu
      </div>
      <div className="whitespace-pre-wrap rounded-2xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-[13.5px] leading-relaxed text-[rgb(var(--text))]">
        {note}
      </div>
    </div>
  );
}

function JoinBox({ joinPath }: { joinPath: string }) {
  const url = shareUrl(joinPath);
  const handleCopy = async () => {
    const ok = await copyText(url);
    if (ok) toast.success("Đã copy link!");
    else toast.error("Không sao chép được — bạn chọn link rồi copy tay giúp");
  };
  return (
    <button
      onClick={handleCopy}
      className="flex w-full items-center gap-3 rounded-2xl border border-[#E3E0D3] bg-[#F7F6F1] p-3 text-left transition hover:border-brand-400"
      title="Copy link"
    >
      <div className="flex-shrink-0 rounded-lg bg-white p-1.5">
        <QRCode value={url} size={64} level="M" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wide text-[#8A9088]">Quét QR hoặc bấm link</div>
        <div className="mt-0.5 truncate text-[13px] font-semibold text-[#20241F]">Bấm để copy link</div>
      </div>
    </button>
  );
}

function LiveResponseStats({ refId, slide }: { refId: string; slide: Slide }) {
  const [totalVotes, setTotalVotes] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/classroom/quick-poll/${refId}/results`))
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setTotalVotes(d.totalVotes ?? 0);
      })
      .catch(() => {});
    const es = new EventSource(apiUrl(`/api/classroom/quick-poll/${refId}/stream`));
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as { choice?: string };
        if (ev.choice) setTotalVotes((t) => t + 1);
      } catch {
        /* ignore */
      }
    };
    return () => {
      cancelled = true;
      es.close();
    };
  }, [refId]);

  return (
    <div>
      <div className="text-[28px] font-extrabold leading-none">
        {totalVotes}
        <span className="ml-1 text-sm font-semibold text-faint">phiếu</span>
      </div>
      <div className="mt-3 text-[12.5px] leading-relaxed text-faint">
        {slide.type === "quiz"
          ? "Đáp án đúng được đánh dấu khi bấm đóng câu hỏi."
          : "Thăm dò ý kiến — không chấm điểm, chỉ để biết cả lớp nghĩ gì."}
      </div>
    </div>
  );
}

function LiveWordCloudStats({ refId }: { refId: string }) {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetch(apiUrl(`/api/classroom/word-cloud/${refId}/results`))
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setTotal(d.totalSubmissions ?? 0);
        })
        .catch(() => {});
    refresh();
    const es = new EventSource(apiUrl(`/api/classroom/word-cloud/${refId}/stream`));
    es.onmessage = () => refresh();
    return () => {
      cancelled = true;
      es.close();
    };
  }, [refId]);

  return (
    <div>
      <div className="text-[28px] font-extrabold leading-none">
        {total}
        <span className="ml-1 text-sm font-semibold text-faint">câu trả lời</span>
      </div>
      <div className="mt-3 text-[12.5px] leading-relaxed text-faint">
        Cụm từ xuất hiện càng nhiều sẽ hiện càng to.
      </div>
    </div>
  );
}

function LiveBoardStats({ code }: { code: string }) {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/public/boards/${code}`))
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setTotal((d.notes ?? []).length);
      })
      .catch(() => {});
    const es = new EventSource(apiUrl(`/api/public/boards/${code}/stream`));
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === "note.created") setTotal((t) => t + 1);
      } catch {
        /* ignore */
      }
    };
    return () => {
      cancelled = true;
      es.close();
    };
  }, [code]);

  return (
    <div>
      <div className="text-[28px] font-extrabold leading-none">
        {total}
        <span className="ml-1 text-sm font-semibold text-faint">ghi chú</span>
      </div>
      <div className="mt-3 text-[12.5px] leading-relaxed text-faint">
        Bấm vào bảng để phóng to, ẩn ghi chú không phù hợp nếu cần.
      </div>
    </div>
  );
}

// ── Center card content per type ────────────────────────────────────────

function QuestionSlideView({
  question,
  options,
  correctIndex,
  isQuiz,
  refId,
  revealed,
  onToggleReveal,
  showToggle,
}: {
  question: string;
  options: string[];
  correctIndex: number;
  isQuiz: boolean;
  refId: string;
  revealed: boolean;
  onToggleReveal: () => void;
  showToggle: boolean;
}) {
  const [votesByOption, setVotesByOption] = useState<Record<string, number>>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const letters = ["A", "B", "C", "D", "E", "F"];

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/classroom/quick-poll/${refId}/results`))
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setTotalVotes(d.totalVotes ?? 0);
        setVotesByOption(d.votesByOption ?? {});
      })
      .catch(() => {});

    const es = new EventSource(apiUrl(`/api/classroom/quick-poll/${refId}/stream`));
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as { choice?: string };
        if (!ev.choice) return;
        setTotalVotes((t) => t + 1);
        setVotesByOption((v) => ({ ...v, [ev.choice!]: (v[ev.choice!] || 0) + 1 }));
      } catch {
        /* ignore */
      }
    };
    return () => {
      cancelled = true;
      es.close();
    };
  }, [refId]);

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <h2 className="flex-grow text-[26px] font-bold leading-tight">{question}</h2>
        {isQuiz && correctIndex >= 0 && showToggle && (
          <button
            onClick={onToggleReveal}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
              revealed ? "bg-red-100 text-red-700" : "bg-[rgb(var(--surface-muted))] text-[#6B7268] hover:bg-red-50"
            }`}
          >
            {revealed ? "Đã đóng" : "Đóng câu hỏi"}
          </button>
        )}
        {!isQuiz && (
          <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
            Không có đáp án đúng/sai
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5 overflow-y-auto">
        {options.map((opt, idx) => {
          const count = votesByOption[String(idx)] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isCorrect = revealed && idx === correctIndex;
          return (
            <div
              key={idx}
              className={`flex items-center gap-3 rounded-xl border-[1.5px] px-4 py-3.5 ${
                isCorrect ? "border-green-300 bg-green-50" : "border-[#E3E0D3] bg-white"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1EFE6] text-xs font-bold text-[#6B7268]">
                {letters[idx]}
              </span>
              <span className="flex-grow text-[15px] font-semibold">{opt}</span>
              {isCorrect && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5">
                  <path d="M4 12l5 5L20 6" />
                </svg>
              )}
              <span
                className={`w-16 shrink-0 text-right text-[13px] font-bold ${
                  isCorrect ? "text-green-700" : "text-[#6B7268]"
                }`}
              >
                {count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function WordCloudSlideView({ prompt, refId }: { prompt: string; refId: string }) {
  const [freq, setFreq] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      fetch(apiUrl(`/api/classroom/word-cloud/${refId}/results`))
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setFreq(d.wordFrequency ?? {});
        })
        .catch(() => {});
    };
    refresh();
    const es = new EventSource(apiUrl(`/api/classroom/word-cloud/${refId}/stream`));
    es.onmessage = () => refresh();
    return () => {
      cancelled = true;
      es.close();
    };
  }, [refId]);

  const max = Math.max(...Object.values(freq), 1);
  const sorted = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 50);
  const gradients = [
    "from-brand-500 to-pink-500",
    "from-blue-400 to-blue-500",
    "from-purple-400 to-purple-500",
    "from-pink-400 to-pink-500",
  ];

  return (
    <>
      <h2 className="mb-5 text-[26px] font-bold leading-tight">{prompt}</h2>
      <div className="flex flex-grow flex-wrap items-center justify-center gap-3 overflow-y-auto rounded-2xl bg-[#F7F6F1] p-8">
        {sorted.length > 0 ? (
          sorted.map(([word, f], idx) => (
            <span
              key={word}
              className={`rounded-full bg-gradient-to-r px-3.5 py-1.5 font-bold text-white ${gradients[idx % gradients.length]}`}
              style={{ fontSize: `${0.9 + (f / max) * (2.2 - 0.9)}rem` }}
            >
              {word}
            </span>
          ))
        ) : (
          <p className="text-sm text-faint">Chưa có câu trả lời nào...</p>
        )}
      </div>
    </>
  );
}

const STICKY_COLORS = ["#FEF3C7", "#DBEAFE", "#FCE7F3", "#DCFCE7", "#EDE9FE", "#FED7AA"];

function BoardSlideView({ prompt, code }: { prompt: string; code: string }) {
  const [notes, setNotes] = useState<Array<{ id: string; authorName: string; content: string }>>([]);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/public/boards/${code}`))
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list = d.notes ?? [];
        list.forEach((n: { id: string }) => seenIds.current.add(n.id));
        setNotes(list);
      })
      .catch(() => {});

    const es = new EventSource(apiUrl(`/api/public/boards/${code}/stream`));
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === "note.created" && !seenIds.current.has(ev.note.id)) {
          seenIds.current.add(ev.note.id);
          setNotes((prev) => [...prev, ev.note]);
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      cancelled = true;
      es.close();
    };
  }, [code]);

  const MAX_VISIBLE = 11;
  const visible = notes.slice(0, MAX_VISIBLE);
  const overflow = notes.length - visible.length;

  return (
    <>
      <h2 className="mb-1 text-[22px] font-bold leading-tight">{prompt}</h2>
      <p className="mb-4 text-[13.5px] text-[#6B7268]">Mỗi bạn dán 1 ghi chú — giống bảng Padlet</p>
      <div className="grid flex-grow auto-rows-min grid-cols-4 gap-3 overflow-y-auto">
        {visible.map((n, idx) => (
          <div
            key={n.id}
            className="rounded-[10px] p-3 text-[13px] leading-snug shadow-[0_2px_6px_rgba(32,36,31,0.08)]"
            style={{ background: STICKY_COLORS[idx % STICKY_COLORS.length] }}
          >
            <p className="mb-1 truncate text-[10px] font-bold text-black/50">{n.authorName}</p>
            {n.content}
          </div>
        ))}
        {overflow > 0 && (
          <div className="flex items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#D8D4C4] bg-[#FCFBF7] text-[12px] text-faint">
            + {overflow} ghi chú khác
          </div>
        )}
        {notes.length === 0 && (
          <div className="col-span-4 flex items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#D8D4C4] bg-[#FCFBF7] py-10 text-[13px] text-faint">
            Chưa có ghi chú nào...
          </div>
        )}
      </div>
    </>
  );
}
