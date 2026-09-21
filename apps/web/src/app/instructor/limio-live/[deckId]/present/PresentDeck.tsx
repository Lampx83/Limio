"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Clock, Play, Presentation, Monitor, Maximize2, Minimize2, StickyNote, ZoomIn, ZoomOut, QrCode } from "lucide-react";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { copyText } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import { openAudienceWindow } from "@/lib/limioLiveWindow";
import EmptyState from "@/components/ui/EmptyState";
import ResourceContent from "../../ResourceContent";
import { contentKind } from "../../slideKind";
import { slideThemeBg } from "../../slideThemes";
import BoardNotesView, { type BoardViewNote } from "../../BoardNotesView";

const QRCode = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => <div className="rounded-lg bg-white" style={{ width: 88, height: 88 }} />,
  }
);

// Excalidraw nặng, cần window — chỉ tải khi slide Whiteboard được chiếu.
const WhiteboardCanvas = dynamic(() => import("@/app/instructor/classroom/WhiteboardCanvas"), { ssr: false });

type SlideType = "content" | "quiz" | "poll" | "word_cloud" | "collaborate_board" | "whiteboard";

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
  theme?: string;
  slides: Slide[];
}

type Runtime =
  | { kind: "content" }
  | { kind: "poll" | "quiz"; refId: string; joinPath: string }
  | { kind: "word_cloud"; refId: string; joinPath: string }
  | { kind: "collaborate_board" | "whiteboard"; refId: string; code: string; joinPath: string };

const SIDE_MIN = 240;
const SIDE_MAX = 720;
const NOTE_FONT_MIN = 10;
const NOTE_FONT_MAX = 40;

const TYPE_LABELS: Record<SlideType, string> = {
  content: "Trình bày",
  quiz: "Trắc nghiệm",
  poll: "Vote",
  word_cloud: "Word Cloud",
  collaborate_board: "Dán Note",
  whiteboard: "Whiteboard",
};

interface UiState {
  timerStartedAt?: Record<string, number>;
  revealed?: Record<string, boolean>;
  zoom?: number;
}

export default function PresentDeck({ deckId }: { deckId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: "presenter" | "audience" = searchParams.get("view") === "audience" ? "audience" : "presenter";
  // ?mode=slideshow = "Trình chiếu" kiểu PowerPoint: fullscreen, KHÔNG ghi chú, không
  // cửa sổ phụ. Mặc định (không tham số) = Presenter view: có ghi chú, không fullscreen.
  const slideshow = mode === "presenter" && searchParams.get("mode") === "slideshow";

  const [deck, setDeck] = useState<Deck | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSlideId, setCurrentSlideId] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [uiState, setUiState] = useState<UiState>({});
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [loadingSlide, setLoadingSlide] = useState(true);
  const [ending, setEnding] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Fullscreen API bị trình duyệt từ chối (webview nhúng, chính sách, thiếu cử chỉ) → không
  // để thông báo phủ màn chiếu mãi mãi: đổi sang hướng dẫn thủ công và cho bấm để đóng.
  const [fsBlocked, setFsBlocked] = useState(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const fsToastedRef = useRef(false);
  const [sideOpen, setSideOpen] = useState(false);
  // Chiều rộng cột phải (QR/ghi chú) ở lg+: presenter kéo mép trái để co dãn, nhớ lại giữa các lần mở.
  const [sideWidth, setSideWidth] = useState(300);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("limio-live:sideWidth"));
      if (v >= SIDE_MIN && v <= SIDE_MAX) setSideWidth(v);
    } catch {}
  }, []);
  const startSideResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sideWidth;
    let w = startW;
    const move = (ev: PointerEvent) => {
      w = Math.min(SIDE_MAX, Math.max(SIDE_MIN, startW + (startX - ev.clientX)));
      setSideWidth(w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      try {
        localStorage.setItem("limio-live:sideWidth", String(Math.round(w)));
      } catch {}
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

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
    // Ngoài Fullscreen API còn nhận diện toàn màn hình do người dùng tự bật (F11 /
    // Ctrl+Cmd+F): cửa sổ phủ kín cả màn hình thì innerSize == screenSize.
    const onFsChange = () =>
      setIsFullscreen(
        !!document.fullscreenElement ||
          (window.innerWidth >= window.screen.width - 1 && window.innerHeight >= window.screen.height - 1)
      );
    onFsChange(); // vào từ editor bằng SPA-navigation: fullscreen đã bật sẵn, sẽ không có sự kiện đổi
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("resize", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("resize", onFsChange);
    };
  }, []);

  // Slideshow: thoát fullscreen (Esc) = kết thúc trình chiếu, quay lại soạn —
  // đúng thói quen PowerPoint. Chỉ áp dụng khi đã từng vào fullscreen được.
  const enteredFsRef = useRef(false);
  useEffect(() => {
    if (isFullscreen) enteredFsRef.current = true;
    else if (slideshow && enteredFsRef.current) {
      enteredFsRef.current = false;
      router.push(`/instructor/limio-live/${deckId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        // Chỉ báo 1 lần (bấm nhiều lần không được xếp chồng nhiều thông báo giống nhau).
        if (!fsToastedRef.current) {
          fsToastedRef.current = true;
          toast.error("Trình duyệt không cho fullscreen tự động — dùng F11 (Windows) hoặc Ctrl+Cmd+F (Mac)");
        }
        setFsBlocked(true);
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
        // Slide bị ẩn (config.hidden) không xuất hiện khi trình chiếu.
        deckData.slides = deckData.slides.filter((sl) => !sl.config?.hidden);
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
          // ?from=start | <slideId> (nút "Từ đầu"/"Từ slide hiện tại" ở editor): nhảy tới
          // slide đó thay vì resume chỗ cũ; xong dọn tham số để F5 không nhảy lại.
          const from = searchParams.get("from");
          const fromId = from === "start" ? deckData.slides[0]?.id : deckData.slides.find((sl) => sl.id === from)?.id;
          if (from) {
            const url = new URL(window.location.href);
            url.searchParams.delete("from");
            window.history.replaceState(null, "", url.toString());
          }
          const target = fromId ?? session.currentSlideId;
          if (target) {
            await visitSlide(session.id, target);
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

  // Zoom nội dung slide (chữ + bố cục) do presenter chỉnh, ghi vào uiState để
  // cửa sổ màn chiếu hiển thị cùng tỉ lệ.
  const zoom = uiState.zoom ?? 1;
  const setZoom = (z: number) => {
    const next = Math.min(2, Math.max(0.5, Math.round(z * 10) / 10));
    if (next !== zoom) patchUiState({ zoom: next });
  };

  const handleOpenAudienceWindow = () => {
    openAudienceWindow(deckId);
  };

  // ── Cuộn song song: presenter cuộn slide → màn chiếu cuộn theo. Hai cửa sổ cùng
  // trình duyệt nên dùng BroadcastChannel (tức thì, không qua server/polling).
  // Gửi TỈ LỆ cuộn (0..1) chứ không gửi px vì 2 cửa sổ khác kích thước; vùng cuộn
  // được nhận diện bằng thứ tự trong danh sách phần tử cuộn được của khung slide.
  const cardRef = useRef<HTMLDivElement>(null);
  const chanRef = useRef<BroadcastChannel | null>(null);
  const pendingScrollRef = useRef<{ slideId: string; idx: number; ratio: number } | null>(null);
  const currentSlideIdRef = useRef<string | null>(null);
  currentSlideIdRef.current = currentSlideId;
  const scrollRafRef = useRef(0);

  const listScrollables = (root: HTMLElement) =>
    [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))].filter(
      (el) => el.scrollHeight > el.clientHeight + 1 && ["auto", "scroll"].includes(getComputedStyle(el).overflowY)
    );

  const applyPendingScroll = () => {
    const m = pendingScrollRef.current;
    const card = cardRef.current;
    if (!m || !card || m.slideId !== currentSlideIdRef.current) return;
    const el = listScrollables(card)[m.idx];
    if (el) el.scrollTop = m.ratio * (el.scrollHeight - el.clientHeight);
  };

  useEffect(() => {
    if (!sessionId || typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(`limio-live-${sessionId}`);
    chanRef.current = ch;
    if (mode === "audience") {
      ch.onmessage = (e) => {
        if (e.data?.type === "qr") {
          setQrRemote(!!e.data.open);
          return;
        }
        if (e.data?.type !== "scroll") return;
        pendingScrollRef.current = e.data;
        applyPendingScroll();
      };
    }
    return () => {
      ch.close();
      chanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, mode]);

  // Slide mới vừa hiện ở màn chiếu (poll trễ hơn tin nhắn cuộn) → áp lại vị trí đang chờ.
  useEffect(() => {
    if (mode !== "audience") return;
    const t = setTimeout(applyPendingScroll, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlideId, runtime, loadingSlide]);

  const handleCardScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (mode !== "presenter" || !chanRef.current || !currentSlide || scrollRafRef.current) return;
    const el = e.target as HTMLElement;
    const slideId = currentSlide.id;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const card = cardRef.current;
      if (!card) return;
      const idx = listScrollables(card).indexOf(el);
      const max = el.scrollHeight - el.clientHeight;
      if (idx < 0 || max <= 0) return;
      chanRef.current?.postMessage({ type: "scroll", slideId, idx, ratio: el.scrollTop / max });
    });
  };

  const slides = deck?.slides ?? [];
  const currentIndex = slides.findIndex((s) => s.id === currentSlideId);
  const currentSlide = currentIndex >= 0 ? slides[currentIndex] : null;

  // QR phóng to: presenter bấm nút/phím Q → màn chiếu (cửa sổ khác) hiện QR lớn toàn màn hình,
  // không cần chạm chuột vào màn chiếu. Reset khi đổi slide.
  const [qrBig, setQrBig] = useState(false);
  const [qrRemote, setQrRemote] = useState(false);
  const canQr = !!currentSlide && currentSlide.type !== "content" && !!runtime && runtime.kind !== "content";
  const toggleQr = () => {
    if (mode !== "presenter" || !canQr) return;
    const next = !qrBig;
    setQrBig(next);
    chanRef.current?.postMessage({ type: "qr", open: next });
  };
  useEffect(() => {
    setQrBig(false);
    setQrRemote(false);
    if (mode === "presenter") chanRef.current?.postMessage({ type: "qr", open: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlideId]);

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
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentIndex, slides.length, sessionId]);

  // Phím tắt: F fullscreen, +/-/0 zoom (presenter).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (mode === "presenter" && (e.key === "+" || e.key === "=")) setZoom(zoom + 0.1);
      else if (mode === "presenter" && (e.key === "-" || e.key === "_")) setZoom(zoom - 0.1);
      else if (mode === "presenter" && e.key === "0") setZoom(1);
      else if (mode === "presenter" && (e.key === "q" || e.key === "Q")) toggleQr();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, zoom, sessionId]);

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

  // Presenter view kiểu PowerPoint: đồng hồ đếm giờ trình bày (từ lúc mở) + giờ hiện tại.
  const [now, setNow] = useState(() => Date.now());
  const startedAtRef = useRef(Date.now());
  const showPreview = mode === "presenter" && !slideshow;
  useEffect(() => {
    if (!showPreview) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [showPreview]);
  const elapsedSec = Math.max(0, Math.floor((now - startedAtRef.current) / 1000));
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const elapsedLabel =
    elapsedSec >= 3600
      ? `${Math.floor(elapsedSec / 3600)}:${pad2(Math.floor((elapsedSec % 3600) / 60))}:${pad2(elapsedSec % 60)}`
      : `${pad2(Math.floor(elapsedSec / 60))}:${pad2(elapsedSec % 60)}`;
  const clockLabel = new Date(now).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

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

  // Focus mode = fullscreen thật HOẶC đã ẩn điều khiển: bỏ header Limio, bỏ
  // sidebar (QR/ghi chú), slide chiếm hết màn hình; chỉ còn thanh điều khiển
  // mảnh (trừ khi cũng ẩn nốt).
  const focus = isFullscreen || slideshow;
  const hasSidebar = !!currentSlide && currentSlide.type !== "content";
  const presenterNote =
    mode === "presenter" && !slideshow && currentSlide ? String(currentSlide.config?.presenterNote ?? "").trim() : "";
  const showSidebar = !focus && (hasSidebar || !!presenterNote || showPreview) && !!currentSlide;

  return (
    <div
      onClick={() => {
        if (mode === "audience" && fsBlocked) {
          setOverlayDismissed(true);
          return;
        }
        if ((mode === "audience" || slideshow) && !document.fullscreenElement) toggleFullscreen();
      }}
      className={`flex flex-col bg-[rgb(var(--surface-muted))] font-sans text-[rgb(var(--text))] ${
        focus ? "fixed inset-0 z-[100]" : "relative h-[calc(100vh-4rem)]"
      }`}
    >
      {(
        <header
          className={`flex flex-shrink-0 flex-nowrap items-center gap-3 border-b border-token bg-[rgb(var(--surface))] px-4 ${
            focus ? "h-12" : "h-14"
          }`}
        >
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-bold tracking-wide text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            {mode === "presenter" ? "ĐANG TRÌNH CHIẾU" : "MÀN HÌNH CHIẾU"}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-muted">
            {deck.title}
            {currentSlide ? ` · ${currentSlide.type === "content" ? contentKind(currentSlide.config).label : currentSlide.type === "collaborate_board" && currentSlide.config?.mode === "drawing" ? "Draw-it (vẽ)" : TYPE_LABELS[currentSlide.type]}` : ""}
          </span>

          {/* Cụm điều khiển 1 hàng: nút chức năng (icon, chữ hiện từ xl) | điều
              hướng slide | Kết thúc. Nhóm trong 1 viên thuốc để không tràn dòng. */}
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface-muted))] p-1">
            <ToolbarButton
              onClick={toggleFullscreen}
              label={isFullscreen ? "Thoát fullscreen" : "Fullscreen"}
              icon={isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            />
            {mode === "presenter" && (
              <>
                {canQr && focus && (
                  <ToolbarButton onClick={toggleQr} active={qrBig} label="Bật/ẩn QR trên màn chiếu (Q)" icon={<QrCode size={15} />} />
                )}
                {!slideshow && (
                  <ToolbarButton onClick={handleOpenAudienceWindow} label="Mở màn hình chiếu" icon={<Monitor size={15} />} />
                )}
                <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/15" aria-hidden />
                <button
                  onClick={() => setZoom(zoom - 0.1)}
                  disabled={zoom <= 0.5}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[rgb(var(--surface))] disabled:opacity-30"
                  aria-label="Thu nhỏ"
                  title="Thu nhỏ (−)"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="min-w-[2.75rem] rounded-full px-1 text-center text-[12px] font-semibold tabular-nums hover:bg-[rgb(var(--surface))]"
                  title="Về 100% (0)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={() => setZoom(zoom + 0.1)}
                  disabled={zoom >= 2}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[rgb(var(--surface))] disabled:opacity-30"
                  aria-label="Phóng to"
                  title="Phóng to (+)"
                >
                  <ZoomIn size={16} />
                </button>
                <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/15" aria-hidden />
                <button
                  onClick={goPrev}
                  disabled={currentIndex <= 0}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface))] disabled:opacity-30"
                  aria-label="Slide trước"
                  title="Slide trước (←)"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="min-w-[3.25rem] text-center text-[13px] font-semibold tabular-nums">
                  {currentIndex >= 0 ? currentIndex + 1 : "-"}/{slides.length}
                </span>
                <button
                  onClick={goNext}
                  disabled={currentIndex < 0 || currentIndex >= slides.length - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-white shadow-sm transition hover:shadow-brand-glow disabled:opacity-30"
                  aria-label="Slide tiếp"
                  title="Slide tiếp (→)"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
          {mode === "presenter" && (
            <button
              onClick={handleEnd}
              disabled={ending}
              className="shrink-0 rounded-full border border-red-200 px-3.5 py-1.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
            >
              Kết thúc
            </button>
          )}
        </header>
      )}

      <main className="flex min-h-0 flex-1">
        <div className={`flex min-w-0 flex-1 flex-col ${focus ? "p-2" : showPreview ? "px-5 pb-2 pt-5" : "p-5"}`}>
          {loadingSlide || !currentSlide ? (
            <p className="my-auto self-center text-sm text-muted">Đang tải slide...</p>
          ) : (
            <div
              key={currentSlide.id}
              ref={cardRef}
              onScrollCapture={handleCardScroll}
              style={{ background: slideThemeBg(deck.theme) }}
              className={`box-border flex min-h-0 w-full flex-1 flex-col text-[#20241F] ${
                focus ? "rounded-xl" : "rounded-[20px] shadow-[0_12px_32px_rgba(32,36,31,0.12)]"
              } ${currentSlide.type === "content" ? "p-0" : currentSlide.type === "whiteboard" ? "p-3" : "p-12"} ${
                currentSlide.type === "word_cloud" || currentSlide.type === "collaborate_board" ? "overflow-y-auto" : "overflow-hidden"
              }`}
            >
              <div className="flex min-h-0 flex-1 flex-col" style={{ zoom }}>
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
            </div>
          )}
          {showPreview && currentSlide && (
            <div className="flex flex-shrink-0 items-center gap-4 px-1 pt-2 text-[13px] text-[rgb(var(--text))]">
              <div className="flex items-center gap-1">
                <button
                  onClick={goPrev}
                  disabled={currentIndex <= 0}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgb(var(--surface))] disabled:opacity-30"
                  aria-label="Slide trước"
                  title="Slide trước (←)"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={goNext}
                  disabled={currentIndex < 0 || currentIndex >= slides.length - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgb(var(--surface))] disabled:opacity-30"
                  aria-label="Slide tiếp"
                  title="Slide tiếp (→)"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <span className="tabular-nums">
                Slide: <b>{currentIndex + 1}</b> / {slides.length}
              </span>
              <span className="flex items-center gap-1 tabular-nums" title="Thời gian trình bày">
                <Clock size={14} /> {elapsedLabel}
              </span>
              <span className="ml-auto tabular-nums text-muted" title="Giờ hiện tại">
                {clockLabel}
              </span>
            </div>
          )}
        </div>

        {showSidebar && currentSlide && (
          <>
          {/* Dưới lg cột phải là ngăn kéo gấp gọn (QR/thống kê/ghi chú). */}
          {sideOpen && <div className="fixed inset-0 z-30 animate-overlay-in bg-black/30 lg:hidden" onClick={() => setSideOpen(false)} aria-hidden />}
          <button
            onClick={() => setSideOpen(true)}
            className="fixed bottom-4 right-4 z-20 rounded-full bg-[rgb(var(--surface))] px-4 py-2.5 text-sm font-semibold shadow-lg ring-1 ring-black/10 lg:hidden"
          >
            QR &amp; ghi chú
          </button>
          <div
            onPointerDown={startSideResize}
            onDoubleClick={() => {
              setSideWidth(300);
              try {
                localStorage.removeItem("limio-live:sideWidth");
              } catch {}
            }}
            role="separator"
            aria-orientation="vertical"
            title="Kéo để co dãn ô ghi chú (bấm đúp để về mặc định)"
            className="hidden w-1.5 flex-shrink-0 cursor-col-resize bg-transparent transition hover:bg-brand-300/60 active:bg-brand-400/70 lg:block"
          />
          <aside
            style={{ "--side-w": `${sideWidth}px` } as React.CSSProperties}
            className={`fixed bottom-0 right-0 top-16 z-40 w-[300px] max-w-[88vw] flex-shrink-0 lg:w-[var(--side-w)] flex flex-col overflow-y-auto border-l border-token bg-[rgb(var(--surface))] p-5 shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:shadow-none ${
              sideOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <button onClick={() => setSideOpen(false)} className="mb-3 text-xs font-medium text-muted lg:hidden">
              ✕ Gấp gọn
            </button>
            {hasSidebar && (
              <FeedbackSidebar
                key={currentSlide.id}
                slide={currentSlide}
                runtime={runtime}
                qrOnScreen={qrBig}
                onToggleQr={mode === "presenter" ? toggleQr : undefined}
              />
            )}
            {(presenterNote || showPreview) && (
              <div className={`flex min-h-[200px] flex-1 flex-col ${hasSidebar ? "mt-6" : ""}`}>
                <PresenterNotesPanel key={currentSlide.id} note={presenterNote} />
              </div>
            )}
          </aside>
          </>
        )}
      </main>

      {showPreview && <Filmstrip slides={slides} currentId={currentSlideId} theme={deck.theme} onPick={(id) => sessionId && visitSlide(sessionId, id)} />}

      {slideshow && canQr && runtime && (
        <SlideshowQr
          url={shareUrl(runtime.joinPath)}
          code={runtime.kind === "collaborate_board" || runtime.kind === "whiteboard" ? runtime.code : undefined}
          big={qrBig}
          onToggle={() => setQrBig((v) => !v)}
        />
      )}

      {canQr && runtime && mode === "audience" && qrRemote && (
        <JoinEnlarged
          url={shareUrl(runtime.joinPath)}
          code={runtime.kind === "collaborate_board" || runtime.kind === "whiteboard" ? runtime.code : undefined}
          onClose={() => {
            setQrRemote(false);
            setQrBig(false);
          }}
        />
      )}

      {mode === "audience" && !isFullscreen && !overlayDismissed && (
        <div className="pointer-events-none fixed inset-0 z-[130] flex items-center justify-center bg-[#20241F]/50 p-10 text-center">
          <div className="max-w-4xl [text-shadow:0_2px_14px_rgba(0,0,0,0.7)]">
            <Monitor size={72} className="mx-auto mb-6 text-white/80" />
            {fsBlocked ? (
              <>
                <p className="text-[36px] font-bold leading-snug text-white">
                  Trình duyệt không cho fullscreen tự động. Hãy nhấn F11 (Windows) hoặc Ctrl + Cmd + F (Mac) để phóng toàn màn hình.
                </p>
                <p className="mt-6 text-xl text-white/70">Bấm chuột vào đây để đóng thông báo này.</p>
              </>
            ) : (
              <>
                <p className="text-[40px] font-bold leading-snug text-white">
                  Hãy kéo màn hình này sang màn chiếu ở chế độ extended window, rồi bấm chuột vào bất cứ đâu trong màn hình này để tự động fullscreen.
                </p>
                <p className="mt-6 text-xl text-white/60">Hoặc nhấn phím F.</p>
              </>
            )}
          </div>
        </div>
      )}
      {slideshow && !isFullscreen && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[105] -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white shadow-lg">
          Bấm vào đây hoặc nhấn F để fullscreen
        </div>
      )}

    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  icon,
  active = false,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition ${
        active ? "bg-brand-600 text-white shadow-sm" : "text-[rgb(var(--text))] hover:bg-[rgb(var(--surface))]"
      }`}
    >
      {icon}
      <span className="hidden xl:inline">{label.replace(/ \([A-Z]\)$/, "")}</span>
    </button>
  );
}

// Focus mode bỏ cột bên phải nhưng học viên vẫn cần QR để vào slide: thu nhỏ
// thành thẻ ở góc dưới phải, bấm để phóng to cho cả lớp quét.
// Chế độ Trình chiếu (Từ đầu / Từ slide này — 1 cửa sổ): QR nằm ở góc dưới phải cho slide có học
// viên tham gia; bấm vào (hoặc phím Q) để phóng to, bấm lần nữa để thu nhỏ.
function SlideshowQr({ url, code, big, onToggle }: { url: string; code?: string; big: boolean; onToggle: () => void }) {
  if (big) return <JoinEnlarged url={url} code={code} onClose={onToggle} />;
  return (
    <button
      onClick={onToggle}
      aria-label="Phóng to mã QR"
      title="Bấm để phóng to (Q)"
      className="fixed bottom-6 right-6 z-[105] flex flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-black/10 transition hover:shadow-xl"
    >
      <QRCode value={url} size={104} level="M" />
      {code && <span className="font-mono text-base font-extrabold leading-none tracking-[0.2em] text-[#20241F]">{code}</span>}
    </button>
  );
}

// QR phóng to = popup giữa màn hình: nền mờ nhẹ và khung trong suốt 50% để vẫn thấy nội dung slide
// bên dưới; riêng ô chứa mã QR luôn nền trắng đặc để máy quét đọc được.
function JoinEnlarged({ url, code, onClose }: { url: string; code?: string; onClose: () => void }) {
  const qrSize = Math.min(380, typeof window !== "undefined" ? window.innerHeight - 260 : 340);
  return (
    <div className="fixed inset-0 z-[140] flex animate-overlay-in items-center justify-center bg-black/25 p-6" onClick={onClose}>
      <div
        className="animate-dialog-in rounded-3xl bg-white/50 p-5 text-center shadow-2xl ring-1 ring-white/60 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-sm">
          <QRCode value={url} size={qrSize} level="M" />
        </div>
        {code && (
          <>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#20241F]/70">Mã tham gia</p>
            <p className="font-mono text-5xl font-extrabold tracking-[0.25em] text-[#20241F]">{code}</p>
          </>
        )}
        <p className="mt-3 max-w-[420px] break-all text-base font-semibold text-[#20241F]">{url}</p>
        <button onClick={onClose} className="btn-secondary mt-4 text-sm">
          Đóng
        </button>
      </div>
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
  const scrolls = slide.type === "word_cloud" || slide.type === "collaborate_board";

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
    <div className={`flex flex-col ${scrolls ? "shrink-0" : "min-h-0 flex-1"}`}>
      {slide.timerSeconds != null && (
        <div className="mb-6">
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

      {slide.type === "whiteboard" && runtime?.kind === "whiteboard" && (
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-black/10 bg-white">
          <WhiteboardCanvas code={runtime.code} authorName="Giáo viên" showAuthors />
        </div>
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

function ContentSlideView({
  config,
  timerSeconds,
  timerStartedAt,
  editable,
  onStartTimer,
  lazyImages,
}: {
  config: Record<string, any>;
  timerSeconds: number | null;
  timerStartedAt?: number;
  editable: boolean;
  onStartTimer: () => void;
  lazyImages?: boolean;
}) {
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

  // Slide "Nội dung" chèn 1 tài nguyên (video/pdf/markdown/...) — ưu tiên
  // trước cả layout thường lẫn full-bleed ảnh PDF nhập (xem LiveDeckEditor).
  if (config.resource) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-10 pb-28">
          <div className="mx-auto w-full max-w-6xl">
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
          <img src={config.imageUrl} alt="" loading={lazyImages ? "lazy" : undefined} className="mx-auto block h-auto w-full max-w-[1600px]" />
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

// Dải slide ở đáy presenter view (như PowerPoint): thumbnail mọi slide, slide đang chiếu
// được tô viền, bấm để nhảy tới. Slide "Nội dung" dựng thật ở khung 1280x720 rồi thu
// nhỏ; slide tương tác cần runtime do server tạo khi mở slide (và slide nhúng tài
// nguyên video/PDF quá nặng để dựng ×N) nên chỉ hiện thẻ tóm tắt.
const THUMB_W = 1280;
const THUMB_H = 720;
const FILM_ITEM_W = 176;

function Filmstrip({
  slides,
  currentId,
  theme,
  onPick,
}: {
  slides: Slide[];
  currentId: string | null;
  theme: string | undefined | null;
  onPick: (id: string) => void;
}) {
  const curRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    curRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [currentId]);

  return (
    <div className="flex-shrink-0 overflow-x-auto border-t border-token bg-[rgb(var(--surface))] px-4 py-2.5">
      <div className="flex gap-3">
        {slides.map((sl, i) => {
          const active = sl.id === currentId;
          const cfg = sl.config ?? {};
          const plain = sl.type === "content" && !cfg.resource;
          const summary = String(cfg.question ?? cfg.prompt ?? cfg.title ?? "").trim();
          return (
            <button
              key={sl.id}
              ref={active ? curRef : undefined}
              onClick={() => onPick(sl.id)}
              title={`Slide ${i + 1}`}
              style={{ width: FILM_ITEM_W }}
              className="flex flex-shrink-0 items-start gap-1.5 text-left"
            >
              <span className={`w-4 pt-0.5 text-right text-[11px] font-bold tabular-nums ${active ? "text-brand-600" : "text-faint"}`}>
                {i + 1}
              </span>
              <span
                className={`relative block aspect-video min-w-0 flex-1 overflow-hidden rounded-md ${
                  active ? "ring-2 ring-brand-500" : "ring-1 ring-black/10 hover:ring-2 hover:ring-brand-300"
                }`}
                style={{ background: slideThemeBg(theme) }}
              >
                {plain ? (
                  <ThumbScaled width={FILM_ITEM_W - 22}>
                    <ContentSlideView config={cfg} timerSeconds={null} editable={false} onStartTimer={() => {}} lazyImages />
                  </ThumbScaled>
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 p-1.5 text-center text-[#20241F]">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[#6B7268]">
                      {sl.type === "content" ? "Học liệu" : sl.type === "collaborate_board" && cfg.mode === "drawing" ? "Draw-it (vẽ)" : TYPE_LABELS[sl.type]}
                    </span>
                    {summary && <span className="line-clamp-2 text-[10px] font-semibold leading-tight">{summary}</span>}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThumbScaled({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <span
      className="pointer-events-none absolute left-0 top-0 flex origin-top-left flex-col text-[#20241F]"
      style={{ width: THUMB_W, height: THUMB_H, transform: `scale(${width / THUMB_W})` }}
      aria-hidden
    >
      {children}
    </span>
  );
}

// ── Right sidebar — join box + live feedback ───────────────────────────────

function FeedbackSidebar({
  slide,
  runtime,
  qrOnScreen,
  onToggleQr,
}: {
  slide: Slide;
  runtime: Runtime | null;
  qrOnScreen?: boolean;
  onToggleQr?: () => void;
}) {
  if (!runtime || runtime.kind === "content") return null;

  return (
    <div>
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-faint">
        Tham gia slide này
      </div>
      <JoinBox
        joinPath={runtime.joinPath}
        code={runtime.kind === "collaborate_board" || runtime.kind === "whiteboard" ? runtime.code : undefined}
        qrOnScreen={qrOnScreen}
        onToggleQr={onToggleQr}
      />

      <div className="mt-5 text-[11px] font-bold uppercase tracking-wide text-faint">
        Phản hồi
      </div>
      {(runtime.kind === "poll" || runtime.kind === "quiz") && (
        <LiveResponseStats refId={runtime.refId} slide={slide} />
      )}
      {runtime.kind === "word_cloud" && <LiveWordCloudStats refId={runtime.refId} />}
      {runtime.kind === "collaborate_board" && <LiveBoardStats code={runtime.code} />}
      {runtime.kind === "whiteboard" && (
        <p className="text-xs leading-relaxed text-muted">
          Cả lớp cùng vẽ lên một khung. Tên người vẽ hiện cạnh nét vẽ.
        </p>
      )}
    </div>
  );
}

// Chỉ render ở cửa sổ presenter (xem điều kiện `presenterNote` ở component
// cha) — đây chính là lý do phải tách 2 cửa sổ: nội dung này không bao giờ đi
// qua cửa sổ audience/màn chiếu, kể cả qua props hay polling.
function PresenterNotesPanel({ note }: { note: string }) {
  // Cỡ chữ riêng của ghi chú (không đụng zoom slide), nhớ trong localStorage.
  const [size, setSize] = useState(13.5);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("limio-live:noteFont"));
      if (v >= NOTE_FONT_MIN && v <= NOTE_FONT_MAX) setSize(v);
    } catch {}
  }, []);
  const change = (next: number) => {
    const v = Math.min(NOTE_FONT_MAX, Math.max(NOTE_FONT_MIN, next));
    setSize(v);
    try {
      localStorage.setItem("limio-live:noteFont", String(v));
    } catch {}
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wide text-faint">
          Ghi chú của bạn — không hiện lên màn chiếu
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-token bg-[rgb(var(--surface-muted))] p-0.5">
          <button
            onClick={() => change(size - 2)}
            disabled={size <= NOTE_FONT_MIN}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[rgb(var(--surface))] disabled:opacity-30"
            aria-label="Thu nhỏ chữ ghi chú"
            title="Thu nhỏ chữ ghi chú"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => change(13.5)}
            className="min-w-[2.5rem] rounded-full px-1 text-center text-[11px] font-semibold tabular-nums hover:bg-[rgb(var(--surface))]"
            title="Về cỡ mặc định"
          >
            {Math.round((size / 13.5) * 100)}%
          </button>
          <button
            onClick={() => change(size + 2)}
            disabled={size >= NOTE_FONT_MAX}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[rgb(var(--surface))] disabled:opacity-30"
            aria-label="Phóng to chữ ghi chú"
            title="Phóng to chữ ghi chú"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
      <div
        style={{ fontSize: size }}
        className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-token bg-[rgb(var(--surface-muted))] p-4 leading-relaxed text-[rgb(var(--text))]"
      >
        {note || <span className="text-faint">Slide này chưa có ghi chú.</span>}
      </div>
    </div>
  );
}

function JoinBox({
  joinPath,
  code,
  qrOnScreen,
  onToggleQr,
}: {
  joinPath: string;
  code?: string;
  qrOnScreen?: boolean;
  onToggleQr?: () => void;
}) {
  const url = shareUrl(joinPath);
  const [big, setBig] = useState(false);
  const handleCopy = async () => {
    const ok = await copyText(url);
    if (ok) toast.success("Đã copy link!");
    else toast.error("Không sao chép được — bạn chọn link rồi copy tay giúp");
  };
  return (
    <div className="rounded-2xl border border-[#E3E0D3] bg-[#F7F6F1] p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setBig(true)}
          className="group relative flex-shrink-0 rounded-lg bg-white p-1.5 transition hover:ring-2 hover:ring-brand-400"
          title="Phóng to mã QR"
          aria-label="Phóng to mã QR"
        >
          <QRCode value={url} size={72} level="M" />
          <span className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100">
            <Maximize2 size={11} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-wide text-[#8A9088]">Mã tham gia</div>
          {code ? (
            <div className="font-mono text-2xl font-extrabold leading-tight tracking-widest text-[#20241F]">{code}</div>
          ) : (
            <div className="text-[13px] font-semibold text-[#20241F]">Quét QR để vào</div>
          )}
        </div>
      </div>
      <button
        onClick={handleCopy}
        className="mt-2.5 w-full break-all rounded-lg bg-white px-2.5 py-1.5 text-left text-[11.5px] text-[#3A3F38] transition hover:ring-1 hover:ring-brand-400"
        title="Bấm để copy link"
      >
        {url}
      </button>
      {onToggleQr && (
        <button
          onClick={onToggleQr}
          aria-pressed={!!qrOnScreen}
          className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
            qrOnScreen
              ? "border border-red-200 bg-white text-red-600 hover:bg-red-50"
              : "bg-brand-600 text-white shadow-sm hover:bg-brand-700"
          }`}
        >
          <QrCode size={16} />
          {qrOnScreen ? "Đóng QR trên màn chiếu" : "Hiện QR trên màn chiếu"}
        </button>
      )}
      {big && <JoinEnlarged url={url} code={code} onClose={() => setBig(false)} />}
    </div>
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
      <div className="mb-8 flex items-center gap-4">
        <h2 className="flex-grow text-[48px] font-bold leading-tight">{question}</h2>
        {isQuiz && correctIndex >= 0 && showToggle && (
          <button
            onClick={onToggleReveal}
            className={`shrink-0 rounded-full px-5 py-2 text-lg font-bold transition ${
              revealed ? "bg-red-100 text-red-700" : "bg-[rgb(var(--surface-muted))] text-[#6B7268] hover:bg-red-50"
            }`}
          >
            {revealed ? "Đã đóng" : "Đóng câu hỏi"}
          </button>
        )}
        {!isQuiz && (
          <span className="shrink-0 rounded-full bg-blue-100 px-5 py-2 text-lg font-bold text-blue-700">
            Không có đáp án đúng/sai
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto">
        {options.map((opt, idx) => {
          const count = votesByOption[String(idx)] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isCorrect = revealed && idx === correctIndex;
          return (
            <div
              key={idx}
              className={`relative flex items-center gap-5 overflow-hidden rounded-2xl border-2 px-6 py-5 ${
                isCorrect ? "border-green-400 bg-green-50" : "border-[#E3E0D3] bg-white"
              }`}
            >
              <div
                className={`absolute inset-y-0 left-0 transition-[width] duration-500 ease-out ${
                  isCorrect ? "bg-green-300/60" : "bg-brand-gradient opacity-25"
                }`}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F1EFE6] text-xl font-bold text-[#6B7268]">
                {letters[idx]}
              </span>
              <span className="relative flex-grow text-[32px] font-semibold leading-snug">{opt}</span>
              {isCorrect && (
                <svg className="relative" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5">
                  <path d="M4 12l5 5L20 6" />
                </svg>
              )}
              <span
                className={`relative w-40 shrink-0 text-right text-[28px] font-bold ${
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
      <h2 className="mb-6 text-[48px] font-bold leading-tight">{prompt}</h2>
      <div className="flex min-h-[50vh] flex-wrap content-center items-center justify-center gap-5 rounded-2xl bg-[#F7F6F1] p-10">
        {sorted.length > 0 ? (
          sorted.map(([word, f], idx) => (
            <span
              key={word}
              className={`rounded-full bg-gradient-to-r px-6 py-3 font-bold text-white ${gradients[idx % gradients.length]}`}
              style={{ fontSize: `${1.8 + (f / max) * (4.4 - 1.8)}rem` }}
            >
              {word}
            </span>
          ))
        ) : (
          <p className="text-2xl text-faint">Chưa có câu trả lời nào...</p>
        )}
      </div>
    </>
  );
}

function BoardSlideView({ prompt, code }: { prompt: string; code: string }) {
  const [notes, setNotes] = useState<BoardViewNote[]>([]);
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/public/boards/${code}`))
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setNotes(d.notes ?? []);
        setColumns(d.columns ?? []);
      })
      .catch(() => {});

    const es = new EventSource(apiUrl(`/api/public/boards/${code}/stream`));
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as { type?: string; note?: BoardViewNote; noteId?: string; hidden?: boolean };
        setNotes((prev) => {
          if (ev.type === "note.created" && ev.note) {
            return prev.some((n) => n.id === ev.note!.id) ? prev : [...prev, ev.note];
          }
          if (ev.type === "note.updated" && ev.note) {
            return prev.map((n) => (n.id === ev.note!.id ? { ...n, ...ev.note } : n));
          }
          if (ev.type === "note.deleted" && ev.noteId) return prev.filter((n) => n.id !== ev.noteId);
          if (ev.type === "note.moderated" && ev.noteId && ev.hidden) return prev.filter((n) => n.id !== ev.noteId);
          if (ev.type === "board.reset") return [];
          return prev;
        });
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
    <>
      <h2 className="mb-2 text-[44px] font-bold leading-tight">{prompt}</h2>
      <p className="mb-5 text-xl text-[#6B7268]">Mỗi bạn dán 1 ghi chú — giống bảng Padlet</p>
      <div>
        <BoardNotesView notes={notes} columns={columns} />
      </div>
    </>
  );
}
