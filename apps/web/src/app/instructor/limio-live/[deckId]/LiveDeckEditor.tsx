"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { openAudienceWindow } from "@/lib/limioLiveWindow";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FileText,
  ListChecks,
  BarChart3,
  Cloud,
  StickyNote,
  Plus,
  Trash2,
  Clock,
  Presentation,
  FileUp,
  LayoutGrid,
  X,
  SlidersHorizontal,
  Eye,
  ClipboardX,
  ZoomIn,
  ZoomOut,
  MonitorPlay,
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "../ResourceContent";
import BoardNotesView from "../BoardNotesView";
import PanelToggle from "@/components/ui/PanelToggle";
import { SLIDE_THEMES, slideThemeBg } from "../slideThemes";
import { columnHeaderColor } from "../../classroom/boardNoteStyle";
import { ResourceTypePicker, ResourceAuthorForm } from "../ResourceEditor";

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
  theme?: string;
  slides: Slide[];
}

const SLIDE_TYPE_META: Record<
  SlideType,
  { label: string; icon: typeof FileText; badge: string }
> = {
  content: {
    label: "Nội dung",
    icon: FileText,
    badge: "bg-[rgb(var(--surface-muted))] text-[rgb(var(--text))]",
  },
  quiz: { label: "Trắc nghiệm", icon: ListChecks, badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  poll: { label: "Thăm dò", icon: BarChart3, badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
  word_cloud: { label: "Word Cloud", icon: Cloud, badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  collaborate_board: {
    label: "Collaborate Board",
    icon: StickyNote,
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
};

const SLIDE_ORDER: SlideType[] = ["content", "quiz", "poll", "word_cloud", "collaborate_board"];

const MAX_PDF_MB = 10;
const MAX_PDF_PAGES = 30;

function slideSummary(slide: Slide): string {
  const c = slide.config ?? {};
  switch (slide.type) {
    case "content":
      if (c.title) return c.title;
      if (c.resource) return `(${RESOURCE_TYPE_LABELS[c.resource.type as ResourceType]})`;
      if (c.imageUrl) return "(Trang nhập từ PDF)";
      return "(chưa có tiêu đề)";
    case "quiz":
    case "poll":
      return c.question || "(chưa có câu hỏi)";
    case "word_cloud":
    case "collaborate_board":
      return c.prompt || "(chưa có prompt)";
    default:
      return "";
  }
}

function defaultConfigFor(type: SlideType): Record<string, any> {
  switch (type) {
    case "content":
      return { title: "", subtitle: "", bullets: [""] };
    case "quiz":
      return { question: "", options: [{ text: "", correct: true }, { text: "" }] };
    case "poll":
      return { question: "", options: [{ text: "" }, { text: "" }] };
    case "word_cloud":
      return { prompt: "" };
    case "collaborate_board":
      return { prompt: "", mode: "free", allowViewOthers: true, blockPaste: false };
  }
}

export default function LiveDeckEditor({ deckId, initialDeck }: { deckId: string; initialDeck?: Deck }) {
  const router = useRouter();
  // initialDeck do server component nạp sẵn → có nội dung ngay ở lần vẽ đầu,
  // không còn chờ JS tải xong rồi mới gọi API (thác nước "Đang tải...").
  const [deck, setDeck] = useState<Deck | null>(initialDeck ?? null);
  const [titleDraft, setTitleDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [slidesOpen, setSlidesOpen] = useState(false);
  // Desktop: cột cài đặt gấp/mở được để nhường chỗ cho slide (nhớ lựa chọn).
  const [railCollapsed, setRailCollapsed] = useState(false);
  useEffect(() => {
    try {
      setRailCollapsed(localStorage.getItem("limio-live.settings-rail-collapsed") === "1");
    } catch {
      /* localStorage bị chặn — dùng mặc định */
    }
  }, []);
  const [editorZoom, setEditorZoom] = useState(1);
  useEffect(() => {
    try {
      const v = parseFloat(localStorage.getItem("limio-live.editor-zoom") ?? "");
      if (v >= 0.5 && v <= 2) setEditorZoom(v);
    } catch {
      /* mặc định 100% */
    }
  }, []);
  const setZoomLevel = (z: number) => {
    const next = Math.min(2, Math.max(0.5, Math.round(z * 10) / 10));
    setEditorZoom(next);
    try {
      localStorage.setItem("limio-live.editor-zoom", String(next));
    } catch {
      /* không lưu được thì thôi */
    }
  };
  const [slidesCollapsed, setSlidesCollapsed] = useState(false);
  useEffect(() => {
    try {
      setSlidesCollapsed(localStorage.getItem("limio-live.slides-rail-collapsed") === "1");
    } catch {
      /* mặc định */
    }
  }, []);
  const toggleSlidesRail = (collapsed: boolean) => {
    setSlidesCollapsed(collapsed);
    try {
      localStorage.setItem("limio-live.slides-rail-collapsed", collapsed ? "1" : "0");
    } catch {
      /* không lưu được thì thôi */
    }
  };
  const toggleRail = (collapsed: boolean) => {
    setRailCollapsed(collapsed);
    try {
      localStorage.setItem("limio-live.settings-rail-collapsed", collapsed ? "1" : "0");
    } catch {
      /* không lưu được thì thôi */
    }
  };
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(initialDeck?.slides[0]?.id ?? null);
  const [pickingType, setPickingType] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // 3 cột rail-preview-rail cần rộng hơn max-w-6xl mặc định của instructor
  // layout — cùng cơ chế full-bleed với PresentDeck (xem globals.css).
  useEffect(() => {
    document.body.classList.add("limio-live-immersive");
    return () => document.body.classList.remove("limio-live-immersive");
  }, []);

  const load = async () => {
    const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}`));
    if (!res.ok) { toast.error("Không tải được bài giảng"); return; }
    const data: Deck = await res.json();
    setDeck(data);
    setTitleDraft(data.title);
    setSelectedSlideId((prev) => prev ?? data.slides[0]?.id ?? null);
  };

  useEffect(() => {
    if (initialDeck) {
      setTitleDraft(initialDeck.title);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  const handleSaveTitle = async () => {
    if (!deck || !titleDraft.trim() || titleDraft === deck.title) return;
    const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft.trim() }),
    });
    if (!res.ok) { toast.error("Lưu tên thất bại"); return; }
    setDeck((prev) => (prev ? { ...prev, title: titleDraft.trim() } : prev));
    setLastSavedAt(new Date());
  };

  const handleSetTheme = async (theme: string) => {
    if (!deck || deck.theme === theme) return;
    const prev = deck.theme;
    setDeck({ ...deck, theme });
    const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
    if (!res.ok) {
      toast.error("Lưu giao diện thất bại");
      setDeck((d) => (d ? { ...d, theme: prev } : d));
      return;
    }
    setLastSavedAt(new Date());
  };

  // "Trình chiếu" (kiểu PowerPoint): vào fullscreen NGAY trong cú click rồi điều
  // hướng SPA — fullscreen sống sót qua điều hướng client nên trang trình chiếu
  // hiện luôn toàn màn hình, không ghi chú.
  const handleStartSlideshow = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* bị chặn — trang trình chiếu sẽ gợi ý bấm để fullscreen */
    }
    router.push(`/instructor/limio-live/${deckId}/present?mode=slideshow`);
  };

  // "Presenter view": mở cửa sổ màn chiếu (popup, cần gọi đồng bộ trong click)
  // rồi vào trang presenter — có ghi chú, không fullscreen.
  const handleStartPresenterView = () => {
    openAudienceWindow(deckId);
    router.push(`/instructor/limio-live/${deckId}/present`);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = async (e: DragEndEvent) => {
    if (!deck) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = deck.slides.findIndex((s) => s.id === active.id);
    const newIdx = deck.slides.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const nextSlides = arrayMove(deck.slides, oldIdx, newIdx);
    setDeck({ ...deck, slides: nextSlides });
    const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/slides/reorder`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedSlideIds: nextSlides.map((s) => s.id) }),
    });
    if (!res.ok) {
      toast.error("Sắp xếp thất bại — đã rollback");
      load();
    } else {
      setLastSavedAt(new Date());
    }
  };

  const handleAddSlide = async (type: SlideType) => {
    setPickingType(false);
    const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/slides`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, config: defaultConfigFor(type) }),
    });
    if (!res.ok) { toast.error("Thêm slide thất bại"); return; }
    const slide: Slide = await res.json();
    setDeck((prev) => (prev ? { ...prev, slides: [...prev.slides, slide] } : prev));
    setSelectedSlideId(slide.id);
    setLastSavedAt(new Date());
  };

  // PDF được rasterize thành ảnh ngay trên client (pdfjs-dist) — cùng cơ chế
  // với Whiteboard.tsx — rồi mỗi trang upload thành 1 slide content full-bleed.
  const handlePdfFileSelected = async (file: File) => {
    setPickingType(false);
    if (file.type !== "application/pdf") {
      toast.error("Chỉ nhận file PDF");
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      toast.error(`File quá lớn — tối đa ${MAX_PDF_MB}MB`);
      return;
    }

    setPdfProgress({ current: 0, total: 0 });
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;

      if (doc.numPages > MAX_PDF_PAGES) {
        toast.error(`PDF có ${doc.numPages} trang — tối đa ${MAX_PDF_PAGES} trang`);
        setPdfProgress(null);
        return;
      }

      const imageUrls: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        setPdfProgress({ current: i, total: doc.numPages });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfPage: any = await doc.getPage(i);
        const viewport = pdfPage.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob_failed"))), "image/png");
        });

        const form = new FormData();
        form.append("file", blob, `page-${i}.png`);
        const uploadRes = await fetch(apiUrl("/api/instructor/limio-live/slide-images"), {
          method: "POST",
          body: form,
        });
        if (!uploadRes.ok) throw new Error("upload_failed");
        const uploaded = await uploadRes.json();
        imageUrls.push(uploaded.url);
      }

      const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/slides/import-pdf`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls }),
      });
      if (!res.ok) { toast.error("Tạo slide từ PDF thất bại"); return; }
      const { slides } = (await res.json()) as { slides: Slide[] };
      setDeck((prev) => (prev ? { ...prev, slides: [...prev.slides, ...slides] } : prev));
      setSelectedSlideId(slides[0]?.id ?? null);
      setLastSavedAt(new Date());
      toast.success(`Đã nhập ${slides.length} slide từ PDF`);
    } catch {
      toast.error("Lỗi xử lý PDF — thử lại hoặc tách thành ảnh riêng");
    } finally {
      setPdfProgress(null);
    }
  };

  const handleDeleteSlide = async (slideId: string) => {
    if (!confirm("Xoá slide này?")) return;
    const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/slides/${slideId}`), {
      method: "DELETE",
    });
    if (!res.ok) { toast.error("Xoá thất bại"); return; }
    setDeck((prev) => {
      if (!prev) return prev;
      const nextSlides = prev.slides.filter((s) => s.id !== slideId);
      if (selectedSlideId === slideId) {
        setSelectedSlideId(nextSlides[0]?.id ?? null);
      }
      return { ...prev, slides: nextSlides };
    });
    setLastSavedAt(new Date());
  };

  const handleSaveSlide = async (slideId: string, patch: { config?: Record<string, any>; timerSeconds?: number | null }) => {
    // Lạc quan: cập nhật giao diện ngay (thanh thumb, preview), server xác nhận
    // sau; lỗi thì nạp lại từ server để không lệch dữ liệu.
    setDeck((prev) =>
      prev ? { ...prev, slides: prev.slides.map((s) => (s.id === slideId ? { ...s, ...patch } : s)) } : prev
    );
    const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/slides/${slideId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) { toast.error("Lưu thất bại"); load(); return; }
    const saved: Slide = await res.json();
    setDeck((prev) => (prev ? { ...prev, slides: prev.slides.map((s) => (s.id === saved.id ? saved : s)) } : prev));
    setLastSavedAt(new Date());
  };

  if (!deck) return <p className="text-sm text-muted">Đang tải...</p>;

  const selectedSlide = deck.slides.find((s) => s.id === selectedSlideId) ?? null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-16 flex-shrink-0 items-center gap-2 border-b border-token bg-[rgb(var(--surface))] px-3 sm:gap-4 sm:px-6">
        <Link href="/instructor/limio-live" className="hidden text-sm text-muted hover:text-brand-600 sm:inline">
          Limio-Live
        </Link>
        <span className="hidden text-token sm:inline">/</span>
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={handleSaveTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="min-w-0 max-w-[40vw] rounded-lg px-2 py-1.5 text-[15px] font-bold hover:bg-[rgb(var(--surface-muted))] focus:bg-[rgb(var(--surface-muted))] focus:outline-none sm:max-w-none"
          style={{ width: `${Math.max(titleDraft.length, 8)}ch` }}
        />
        {lastSavedAt && (
          <span className="hidden text-xs text-faint sm:inline">
            Đã lưu ·{" "}
            {lastSavedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <div className="flex-grow" />
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5" role="radiogroup" aria-label="Giao diện slide">
          <span className="mr-1 hidden text-xs text-faint sm:inline">Giao diện</span>
          {SLIDE_THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={(deck.theme ?? "white") === t.id}
              title={t.label}
              onClick={() => handleSetTheme(t.id)}
              className={`h-5 w-5 rounded-full border transition sm:h-6 sm:w-6 ${
                (deck.theme ?? "white") === t.id ? "ring-2 ring-brand-500 ring-offset-2" : "border-token hover:scale-110"
              }`}
              style={{ background: t.swatch }}
            />
          ))}
        </div>
        <button
          onClick={handleStartPresenterView}
          className="btn-secondary flex items-center gap-2 px-3 text-sm font-semibold"
          title="Mở màn chiếu ở cửa sổ riêng, bạn xem ghi chú ở cửa sổ này"
        >
          <MonitorPlay size={15} /> <span className="hidden md:inline">Presenter view</span>
        </button>
        <button
          onClick={handleStartSlideshow}
          className="btn flex items-center gap-2 bg-brand-gradient px-3 text-sm font-semibold text-white shadow-sm hover:shadow-brand-glow sm:px-4"
          title="Trình chiếu toàn màn hình (không ghi chú)"
        >
          <Presentation size={15} /> <span className="hidden sm:inline">Trình chiếu</span>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Left rail — slide list */}
        {slidesOpen && (
          <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSlidesOpen(false)} aria-hidden />
        )}
        <button
          onClick={() => setSlidesOpen(true)}
          className="fixed bottom-4 left-20 z-20 flex items-center gap-1.5 rounded-full bg-[rgb(var(--surface))] px-4 py-2.5 text-sm font-semibold shadow-lg ring-1 ring-black/10 lg:hidden"
        >
          Slide ({deck.slides.length})
        </button>
        <div
          className={`fixed bottom-0 left-0 top-16 z-40 w-56 max-w-[85vw] flex-shrink-0 overflow-y-auto border-r border-token bg-[rgb(var(--surface-muted))] p-3 shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:shadow-none ${
            slidesOpen ? "translate-x-0" : "-translate-x-full"
          } ${slidesCollapsed ? "lg:w-[60px] lg:px-2" : ""}`}
        >
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handlePdfFileSelected(file);
            }}
          />

          {slidesCollapsed && (
            <PanelToggle
              side="left"
              collapsed
              onClick={() => toggleSlidesRail(false)}
              label="Mở rộng danh sách slide"
              className="mx-auto mb-2 hidden lg:flex"
            />
          )}
          {pdfProgress ? (
            <div className="mb-3.5 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 text-center text-xs text-muted">
              Đang xử lý PDF...{" "}
              {pdfProgress.total > 0 && `trang ${pdfProgress.current}/${pdfProgress.total}`}
            </div>
          ) : !pickingType ? (
            <div className="mb-3 flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (slidesCollapsed) toggleSlidesRail(false);
                  setPickingType(true);
                }}
                title="Thêm slide"
                className="btn-secondary flex flex-1 items-center justify-center gap-1.5"
              >
                <Plus size={15} />
                <span className={slidesCollapsed ? "lg:hidden" : ""}>Thêm slide</span>
              </button>
              <PanelToggle
                side="left"
                collapsed={false}
                onClick={() => toggleSlidesRail(true)}
                label="Thu gọn danh sách slide"
                className={`hidden lg:flex ${slidesCollapsed ? "lg:hidden" : ""}`}
              />
            </div>
          ) : (
            <div className="mb-3.5 rounded-xl border border-token bg-[rgb(var(--surface))] p-2">
              <div className="grid grid-cols-1 gap-1">
                {SLIDE_ORDER.map((type) => {
                  const meta = SLIDE_TYPE_META[type];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => handleAddSlide(type)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition hover:bg-[rgb(var(--surface-muted))]"
                    >
                      <Icon size={14} /> {meta.label}
                    </button>
                  );
                })}
                <div className="my-1 h-px bg-token" />
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-[rgb(var(--surface-muted))]"
                >
                  <FileUp size={14} className="mt-0.5 shrink-0 text-brand-700" />
                  <span>
                    <span className="block text-sm font-medium text-brand-700">
                      Tách PDF thành nhiều slide
                    </span>
                    <span className="block text-[11px] leading-snug text-faint">
                      Mỗi trang PDF → 1 slide riêng, nối vào cuối bài giảng. Tối đa {MAX_PDF_PAGES} trang, {MAX_PDF_MB}MB.
                    </span>
                  </span>
                </button>
              </div>
              <button onClick={() => setPickingType(false)} className="btn-text mt-1 w-full text-xs">
                Huỷ
              </button>
            </div>
          )}

          {deck.slides.length === 0 ? (
            <p className="px-1 text-xs text-muted">Chưa có slide nào.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={deck.slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {deck.slides.map((slide, idx) => (
                  <SlideThumb
                    key={slide.id}
                    slide={slide}
                    index={idx}
                    isActive={slide.id === selectedSlideId}
                    collapsed={slidesCollapsed}
                    onSelect={() => {
                      setSelectedSlideId(slide.id);
                      setSlidesOpen(false);
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Center — live WYSIWYG preview */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 overflow-y-auto p-8 pb-20">
            {selectedSlide ? (
              <div
                key={selectedSlide.id}
                className="m-auto box-border flex min-h-[518px] w-full max-w-[920px] flex-col rounded-[20px] p-12 text-[#20241F] shadow-[0_12px_32px_rgba(32,36,31,0.10)]"
                style={{ background: slideThemeBg(deck.theme), zoom: editorZoom }}
              >
                <SlideCenterEditor slide={selectedSlide} onSave={(patch) => handleSaveSlide(selectedSlide.id, patch)} />
              </div>
            ) : (
              <p className="m-auto text-sm text-muted">Chưa có slide nào — bấm "+ Thêm slide" bên trái.</p>
            )}
          </div>
          {selectedSlide && (
            <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-token bg-[rgb(var(--surface))] p-1 shadow-lg lg:bottom-4">
              <button
                onClick={() => setZoomLevel(editorZoom - 0.1)}
                disabled={editorZoom <= 0.5}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30"
                aria-label="Thu nhỏ"
                title="Thu nhỏ"
              >
                <ZoomOut size={16} />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="min-w-[3rem] rounded-full px-1 text-center text-xs font-semibold tabular-nums hover:bg-[rgb(var(--surface-muted))]"
                title="Về 100%"
              >
                {Math.round(editorZoom * 100)}%
              </button>
              <button
                onClick={() => setZoomLevel(editorZoom + 0.1)}
                disabled={editorZoom >= 2}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30"
                aria-label="Phóng to"
                title="Phóng to"
              >
                <ZoomIn size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Right rail — type legend + settings */}
        {selectedSlide && railCollapsed && (
          <PanelToggle
            side="right"
            collapsed
            onClick={() => toggleRail(false)}
            label="Mở cột cài đặt"
            className="absolute right-5 top-5 z-10 hidden lg:flex"
          />
        )}
        {selectedSlide && (
          <>
          {/* Dưới lg cột phải thành ngăn kéo: mặc định gấp, bấm nút nổi để kéo ra. */}
          {settingsOpen && (
            <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSettingsOpen(false)} aria-hidden />
          )}
          <button
            onClick={() => {
              setSettingsOpen(true);
              toggleRail(false);
            }}
            className="fixed bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-full bg-[rgb(var(--surface))] px-4 py-2.5 text-sm font-semibold shadow-lg ring-1 ring-black/10 lg:hidden"
          >
            <SlidersHorizontal size={15} /> Cài đặt
          </button>
          <div
            className={`fixed bottom-0 right-0 top-16 z-40 w-[300px] max-w-[88vw] flex-shrink-0 overflow-y-auto border-l border-token bg-[rgb(var(--surface))] p-5 shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:shadow-none ${
              settingsOpen ? "translate-x-0" : "translate-x-full"
            } ${railCollapsed ? "lg:hidden" : ""}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-faint">Cài đặt slide</span>
              <PanelToggle
                side="right"
                collapsed={false}
                onClick={() => {
                  setSettingsOpen(false);
                  toggleRail(true);
                }}
                label="Gấp gọn cột cài đặt"
              />
            </div>
            {(() => {
              const meta = SLIDE_TYPE_META[selectedSlide.type];
              const Icon = meta.icon;
              const idx = deck.slides.findIndex((sl) => sl.id === selectedSlide.id);
              return (
                <div className="mb-5 flex items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.badge}`}>
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Slide {idx + 1}</p>
                    <p className="truncate text-[15px] font-bold leading-tight">{meta.label}</p>
                  </div>
                </div>
              );
            })()}
            <SettingsPanel
              key={selectedSlide.id}
              slide={selectedSlide}
              onSave={(patch) => handleSaveSlide(selectedSlide.id, patch)}
            />

            <button
              onClick={() => handleDeleteSlide(selectedSlide.id)}
              className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
            >
              <Trash2 size={13} /> Xoá slide này
            </button>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Left rail thumb ──────────────────────────────────────────────────────

const SlideThumb = memo(function SlideThumb({
  slide,
  index,
  isActive,
  collapsed,
  onSelect,
}: {
  slide: Slide;
  index: number;
  isActive: boolean;
  collapsed: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const meta = SLIDE_TYPE_META[slide.type];
  const Icon = meta.icon;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      onClick={onSelect}
      title={`${index + 1}. ${meta.label} — ${slideSummary(slide)}`}
      className={`group mb-1.5 flex cursor-pointer items-center gap-2 rounded-xl border bg-[rgb(var(--surface))] p-1.5 transition ${
        collapsed ? "lg:flex-col lg:justify-center lg:gap-0.5 lg:p-1" : ""
      } ${
        isActive
          ? "border-brand-600 shadow-[0_0_0_3px_rgb(163,230,53,0.3)]"
          : "border-token hover:border-brand-300"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className={`cursor-grab text-xs text-faint active:cursor-grabbing ${collapsed ? "lg:hidden" : ""}`}
        aria-label="Kéo để sắp xếp"
        type="button"
      >
        ⠿
      </button>
      <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.badge}`}>
        <Icon size={16} />
        {slide.timerSeconds != null && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[rgb(var(--surface))] text-faint ring-1 ring-black/10">
            <Clock size={9} />
          </span>
        )}
      </span>
      <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
        <p className="truncate text-[12.5px] font-medium leading-tight text-[rgb(var(--text))]">{slideSummary(slide)}</p>
        <p className="mt-0.5 text-[10px] font-semibold text-faint">
          {index + 1} · {meta.label}
          {slide.timerSeconds != null && ` · ${Math.round(slide.timerSeconds / 60)}p`}
        </p>
      </div>
      {collapsed && (
        <span className="hidden text-[10px] font-bold text-faint lg:block" aria-hidden>
          {index + 1}
        </span>
      )}
    </div>
  );
});

// ── Center WYSIWYG editor per type ──────────────────────────────────────

function SlideCenterEditor({
  slide,
  onSave,
}: {
  slide: Slide;
  onSave: (patch: { config: Record<string, any> }) => void;
}) {
  const config = slide.config ?? {};

  if (slide.type === "content") return <ContentEditor config={config} onSave={onSave} />;
  if (slide.type === "quiz" || slide.type === "poll")
    return <QuestionEditor type={slide.type} config={config} onSave={onSave} />;
  if (slide.type === "word_cloud") return <WordCloudEditor config={config} onSave={onSave} />;
  return <BoardEditor config={config} onSave={onSave} />;
}

// Ô nhập tự giãn theo nội dung (không cuộn trong ô, không chồng lên phần bên
// dưới): đo scrollHeight mỗi lần đổi giá trị.
function AutoTextarea({ value, className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} value={value} rows={1} className={`${className ?? ""} overflow-hidden`} {...rest} />;
}

const bareInputClass =
  "w-full resize-none border-none bg-transparent p-0 outline-none focus:ring-0 placeholder:text-[#9AA090]";

function ContentEditor({
  config,
  onSave,
}: {
  config: Record<string, any>;
  onSave: (patch: { config: Record<string, any> }) => void;
}) {
  const [title, setTitle] = useState(config.title ?? "");
  const [subtitle, setSubtitle] = useState(config.subtitle ?? "");
  const [bullets, setBullets] = useState<string[]>(config.bullets?.length ? config.bullets : [""]);
  const [imageUrl, setImageUrl] = useState(config.imageUrl ?? "");

  // Slide "Nội dung" có thể chèn 1 tài nguyên kiểu ContentItem của Lesson
  // (video/pdf/markdown/...) thay vì layout tiêu đề+ý+ảnh thường — xem
  // ResourceContent.tsx/ResourceEditor.tsx. Cùng payload shape với
  // contentSchemas.ts (packages/core-lms) để dùng chung validate.
  const [pickingResource, setPickingResource] = useState(false);
  const [resource, setResource] = useState<{ type: ResourceType; payload: Record<string, any> } | null>(
    config.resource ?? null
  );

  // Slide nhập từ PDF (mỗi trang → 1 slide, chỉ có ảnh, không tiêu đề/ý) —
  // hiện full-bleed thay vì layout 2 cột trống một nửa. GV vẫn có thể bấm để
  // quay lại layout thường nếu muốn thêm chú thích.
  const isImportedPage = !config.title && !config.subtitle && !config.bullets?.length && !!config.imageUrl;
  const [showTextFields, setShowTextFields] = useState(!isImportedPage);

  const commit = (patch: Partial<{ title: string; subtitle: string; bullets: string[]; imageUrl: string }>) => {
    const next = {
      title: patch.title ?? title,
      subtitle: patch.subtitle ?? subtitle,
      bullets: (patch.bullets ?? bullets).map((b) => b.trim()).filter(Boolean),
      ...((patch.imageUrl ?? imageUrl).trim() ? { imageUrl: (patch.imageUrl ?? imageUrl).trim() } : {}),
      ...(config.presenterNote ? { presenterNote: config.presenterNote } : {}),
    };
    onSave({ config: next });
  };

  const commitResource = (next: { type: ResourceType; payload: Record<string, any> } | null) => {
    setResource(next);
    onSave({ config: { title, subtitle, bullets, ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}), resource: next ?? undefined, ...(config.presenterNote ? { presenterNote: config.presenterNote } : {}) } });
  };

  if (resource) {
    return (
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            {RESOURCE_TYPE_LABELS[resource.type]}
          </span>
          <div className="flex gap-3">
            <button onClick={() => setPickingResource(true)} className="text-xs font-medium text-brand-700 hover:underline">
              Đổi loại tài nguyên
            </button>
            <button onClick={() => commitResource(null)} className="text-xs font-medium text-faint hover:text-red-600">
              Quay lại nội dung thường
            </button>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto">
          <ResourceAuthorForm
            type={resource.type}
            payload={resource.payload}
            onChange={(payload) => commitResource({ type: resource.type, payload })}
          />
        </div>
        {pickingResource && (
          <ResourceTypePicker
            onPick={(type) => {
              setPickingResource(false);
              commitResource({ type, payload: {} });
            }}
            onClose={() => setPickingResource(false)}
          />
        )}
      </div>
    );
  }

  if (!showTextFields && imageUrl) {
    return (
      <div className="relative flex flex-grow items-center justify-center rounded-2xl bg-[#F1EFE6]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        <button
          onClick={() => setShowTextFields(true)}
          className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-[#3A3F38] shadow hover:bg-white"
        >
          + Thêm tiêu đề / ghi chú
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-grow gap-7">
      <div className="flex flex-[1.1] flex-col justify-center gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => commit({})}
          placeholder="Tiêu đề slide"
          className={`${bareInputClass} text-[30px] font-extrabold leading-tight`}
        />
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          onBlur={() => commit({})}
          placeholder="Phụ đề (tuỳ chọn)"
          className={`${bareInputClass} text-sm text-[#6B7268]`}
        />
        <div className="mt-1.5 space-y-1.5">
          {bullets.map((b, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#3A3F38]" />
              <input
                value={b}
                onChange={(e) => {
                  const next = [...bullets];
                  next[idx] = e.target.value;
                  setBullets(next);
                }}
                onBlur={() => commit({})}
                placeholder={`Ý ${idx + 1}`}
                className={`${bareInputClass} text-[13.5px] leading-relaxed text-[#3A3F38]`}
              />
              {bullets.length > 1 && (
                <button
                  onClick={() => {
                    const next = bullets.filter((_, i) => i !== idx);
                    setBullets(next);
                    commit({ bullets: next });
                  }}
                  className="text-xs text-faint hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {bullets.length < 3 && (
          <button
            onClick={() => setBullets([...bullets, ""])}
            className="w-fit text-xs font-medium text-brand-700 hover:underline"
          >
            + Thêm ý
          </button>
        )}
        <button
          onClick={() => setPickingResource(true)}
          className="mt-2 w-fit rounded-full border border-token px-2.5 py-1 text-xs font-medium text-muted transition hover:border-brand-300 hover:text-brand-700"
        >
          Chèn tài nguyên (video, PDF, HTML...)
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-[#F1EFE6] p-4">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        ) : (
          <span className="text-xs text-[#9AA090]">Ảnh/sơ đồ minh hoạ</span>
        )}
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          onBlur={() => commit({})}
          placeholder="Dán URL ảnh..."
          className="w-full rounded-md border border-[#D8D4C4] bg-white/70 px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>
      {pickingResource && (
        <ResourceTypePicker
          onPick={(type) => {
            setPickingResource(false);
            commitResource({ type, payload: {} });
          }}
          onClose={() => setPickingResource(false)}
        />
      )}
    </div>
  );
}

function QuestionEditor({
  type,
  config,
  onSave,
}: {
  type: "quiz" | "poll";
  config: Record<string, any>;
  onSave: (patch: { config: Record<string, any> }) => void;
}) {
  const [question, setQuestion] = useState(config.question ?? "");
  const [options, setOptions] = useState<Array<{ text: string; correct?: boolean }>>(
    config.options?.length ? config.options : [{ text: "" }, { text: "" }]
  );
  const letters = ["A", "B", "C", "D", "E", "F"];

  const commit = (patch: { question?: string; options?: Array<{ text: string; correct?: boolean }> }) => {
    const q = patch.question ?? question;
    const opts = patch.options ?? options;
    onSave({
      config: {
        ...(config.presenterNote ? { presenterNote: config.presenterNote } : {}),
        question: q.trim(),
        options:
          type === "quiz"
            ? opts.map((o) => ({ text: o.text.trim(), correct: !!o.correct }))
            : opts.map((o) => ({ text: o.text.trim() })),
      },
    });
  };

  const filledCount = options.filter((o) => o.text.trim()).length;
  const correctCount = options.filter((o) => o.correct).length;

  return (
    <div className="flex h-full flex-col">
      <AutoTextarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onBlur={() => commit({})}
        placeholder="Nhập câu hỏi..."
        className={`${bareInputClass} mb-5 shrink-0 text-[20px] font-bold leading-snug`}
      />
      <div className="flex flex-col gap-2">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-xl border-[1.5px] border-[#E3E0D3] px-3 py-2.5">
            {type === "quiz" ? (
              <button
                onClick={() => {
                  const next = options.map((o, i) => ({ ...o, correct: i === idx }));
                  setOptions(next);
                  commit({ options: next });
                }}
                title="Đánh dấu đáp án đúng"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                  opt.correct ? "bg-green-500 text-white" : "bg-[#F1EFE6] text-[#6B7268] hover:bg-green-100"
                }`}
              >
                {letters[idx]}
              </button>
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1EFE6] text-xs font-bold text-[#6B7268]">
                {letters[idx]}
              </span>
            )}
            <input
              value={opt.text}
              onChange={(e) => {
                const next = [...options];
                next[idx] = { ...next[idx], text: e.target.value };
                setOptions(next);
              }}
              onBlur={() => commit({})}
              placeholder={`Lựa chọn ${letters[idx]}`}
              className={`${bareInputClass} flex-grow text-[15px] font-semibold`}
            />
            {options.length > 2 && (
              <button
                onClick={() => {
                  const next = options.filter((_, i) => i !== idx);
                  setOptions(next);
                  commit({ options: next });
                }}
                className="shrink-0 text-xs text-faint hover:text-red-600"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {options.length < 6 && (
        <button
          onClick={() => setOptions([...options, { text: "" }])}
          className="mt-2.5 w-fit text-xs font-medium text-brand-700 hover:underline"
        >
          + Thêm lựa chọn
        </button>
      )}
      {(filledCount < 2 || (type === "quiz" && correctCount !== 1)) && (
        <p className="mt-3 text-xs text-amber-700">
          {filledCount < 2
            ? "⚠ Cần ít nhất 2 lựa chọn có nội dung."
            : "⚠ Bấm vào chữ cái để chọn đúng 1 đáp án đúng."}
        </p>
      )}
    </div>
  );
}

function WordCloudEditor({
  config,
  onSave,
}: {
  config: Record<string, any>;
  onSave: (patch: { config: Record<string, any> }) => void;
}) {
  const [prompt, setPrompt] = useState(config.prompt ?? "");

  return (
    <div className="flex h-full flex-col">
      <AutoTextarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => onSave({ config: { ...config, prompt: prompt.trim() } })}
        placeholder="Nhập câu hỏi / prompt cho Word Cloud..."
        className={`${bareInputClass} mb-5 text-[22px] font-bold leading-snug`}
      />
      <div className="flex flex-grow items-center justify-center rounded-2xl bg-[#F7F6F1] p-8 text-sm text-[#9AA090]">
        Cụm từ học viên gửi sẽ hiện ở đây khi trình chiếu.
      </div>
    </div>
  );
}

const SAMPLE_STICKY = [
  { bg: "#FEF3C7", text: "Ví dụ ghi chú 1" },
  { bg: "#DBEAFE", text: "Ví dụ ghi chú 2" },
  { bg: "#FCE7F3", text: "Ví dụ ghi chú 3" },
];

function BoardEditor({
  config,
  onSave,
}: {
  config: Record<string, any>;
  onSave: (patch: { config: Record<string, any> }) => void;
}) {
  const [prompt, setPrompt] = useState(config.prompt ?? "");
  const grouped = config.mode === "grouped";
  const cols: string[] = (config.columns ?? []).filter((c: string) => c.trim());

  return (
    <div className="flex h-full flex-col">
      {config.title && <p className="mb-1 text-xs font-bold uppercase tracking-wider text-faint">{config.title}</p>}
      <AutoTextarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => onSave({ config: { ...config, prompt: prompt.trim() } })}
        placeholder="Nhập câu hỏi / hướng dẫn cho bảng cộng tác..."
        className={`${bareInputClass} mb-4 text-[20px] font-bold leading-snug`}
      />
      <div className="min-h-0 flex-1">
        <BoardNotesView
          scale="editor"
          columns={grouped ? cols : []}
          notes={
            grouped
              ? cols.flatMap((c, i) => [
                  { id: `sample-${i}-a`, authorName: "Học viên", content: SAMPLE_STICKY[i % 3]!.text, color: SAMPLE_STICKY[i % 3]!.bg, column: c },
                ])
              : SAMPLE_STICKY.map((s, i) => ({ id: `sample-${i}`, authorName: "Học viên", content: s.text, color: s.bg }))
          }
          emptyText="Học viên đăng ghi chú vào đây"
        />
      </div>
    </div>
  );
}

// ── Right rail settings ──────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-brand-500" : "bg-black/15 dark:bg-white/20"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

// Thẻ cài đặt thống nhất: ô icon + tiêu đề (+ công tắc bên phải) + nội dung mở rộng.
function SettingCard({
  icon,
  title,
  hint,
  toggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  toggle?: { checked: boolean; onChange: (v: boolean) => void };
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-3.5 shadow-[0_1px_2px_rgba(32,36,31,0.04)]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-muted))] text-muted">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight">{title}</p>
          {hint && <p className="mt-0.5 text-[11px] leading-snug text-faint">{hint}</p>}
        </div>
        {toggle && <Toggle checked={toggle.checked} onChange={toggle.onChange} label={title} />}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}

function SettingsPanel({
  slide,
  onSave,
}: {
  slide: Slide;
  onSave: (patch: { config?: Record<string, any>; timerSeconds?: number | null }) => void;
}) {
  const config = slide.config ?? {};
  const [timerEnabled, setTimerEnabled] = useState(slide.timerSeconds != null);
  const [timerMinutes, setTimerMinutes] = useState(
    slide.timerSeconds ? Math.max(1, Math.round(slide.timerSeconds / 60)) : 5
  );

  const [boardMode, setBoardMode] = useState<"free" | "grouped">(config.mode ?? "free");
  const [columnList, setColumnList] = useState<string[]>(
    (config.columns ?? []).length > 0 ? [...config.columns] : ["Nhóm 1", "Nhóm 2"]
  );
  const [boardTitle, setBoardTitle] = useState(config.title ?? "");
  const [allowViewOthers, setAllowViewOthers] = useState(config.allowViewOthers ?? true);
  const [blockPaste, setBlockPaste] = useState(config.blockPaste ?? false);
  const [presenterNote, setPresenterNote] = useState(config.presenterNote ?? "");

  const commitTimer = (enabled: boolean, minutes: number) => {
    onSave({ timerSeconds: enabled ? Math.max(1, minutes) * 60 : null });
  };

  const commitPresenterNote = () => {
    onSave({ config: { ...config, presenterNote: presenterNote.trim() || undefined } });
  };

  const commitBoard = (patch: Partial<{ mode: "free" | "grouped"; columns: string[]; title: string; allowViewOthers: boolean; blockPaste: boolean }>) => {
    const mode = patch.mode ?? boardMode;
    const cols = [...new Set((patch.columns ?? columnList).map((c: string) => c.trim()).filter(Boolean))];
    const title = (patch.title ?? boardTitle).trim();
    onSave({
      config: {
        ...config,
        title: title || undefined,
        mode,
        ...(mode === "grouped" ? { columns: cols } : {}),
        allowViewOthers: patch.allowViewOthers ?? allowViewOthers,
        blockPaste: patch.blockPaste ?? blockPaste,
      },
    });
  };

  return (
    <div className="space-y-3">
      <SettingCard
        icon={<Clock size={15} />}
        title="Giới hạn thời gian"
        hint={timerEnabled ? undefined : "GV tự bấm Bắt đầu lúc trình chiếu"}
        toggle={{
          checked: timerEnabled,
          onChange: (v) => {
            setTimerEnabled(v);
            commitTimer(v, timerMinutes);
          },
        }}
      >
        {timerEnabled && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {[1, 3, 5, 10, 15].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setTimerMinutes(m);
                    commitTimer(true, m);
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    timerMinutes === m
                      ? "bg-brand-500 text-white"
                      : "bg-[rgb(var(--surface-muted))] text-muted hover:text-[rgb(var(--text))]"
                  }`}
                >
                  {m}p
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={timerMinutes}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 1);
                  setTimerMinutes(v);
                  commitTimer(true, v);
                }}
                className="input w-20"
              />
              <span className="text-xs text-muted">phút · GV tự bấm Bắt đầu</span>
            </div>
          </div>
        )}
      </SettingCard>

      {slide.type === "collaborate_board" && (
        <>
          <SettingCard icon={<StickyNote size={15} />} title="Tiêu đề bảng">
            <input
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              onBlur={() => commitBoard({})}
              placeholder="Vd. Bảng ý tưởng nhóm"
              maxLength={120}
              className="input w-full text-sm"
            />
          </SettingCard>

          <SettingCard
            icon={<LayoutGrid size={15} />}
            title="Đăng theo nhóm (grid)"
            hint="Mỗi nhóm hiện thành 1 cột riêng"
            toggle={{
              checked: boardMode === "grouped",
              onChange: (v) => {
                const m = v ? "grouped" : "free";
                setBoardMode(m);
                commitBoard({ mode: m });
              },
            }}
          >
            {boardMode === "grouped" && (
              <div className="space-y-2">
                {columnList.map((label, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span
                      className="h-6 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: columnHeaderColor(idx) }}
                      aria-hidden
                    />
                    <input
                      value={label}
                      onChange={(e) => {
                        const next = [...columnList];
                        next[idx] = e.target.value;
                        setColumnList(next);
                      }}
                      onBlur={() => commitBoard({})}
                      placeholder={`Nhóm ${idx + 1}`}
                      maxLength={30}
                      className="input flex-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = columnList.filter((_, i) => i !== idx);
                        setColumnList(next);
                        commitBoard({ columns: next });
                      }}
                      className="rounded-lg p-1.5 text-faint hover:bg-black/5"
                      aria-label="Xoá nhóm"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={columnList.length >= 12}
                  onClick={() => {
                    const next = [...columnList, `Nhóm ${columnList.length + 1}`];
                    setColumnList(next);
                    commitBoard({ columns: next });
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-40"
                >
                  <Plus size={12} /> Thêm nhóm
                </button>
              </div>
            )}
          </SettingCard>

          <SettingCard
            icon={<Eye size={15} />}
            title="Xem ghi chú của nhau"
            hint="Học viên thấy ghi chú của bạn học"
            toggle={{
              checked: allowViewOthers,
              onChange: (v) => {
                setAllowViewOthers(v);
                commitBoard({ allowViewOthers: v });
              },
            }}
          />
          <SettingCard
            icon={<ClipboardX size={15} />}
            title="Chặn dán (chống copy)"
            hint="Học viên không dán được vào ô ghi chú"
            toggle={{
              checked: blockPaste,
              onChange: (v) => {
                setBlockPaste(v);
                commitBoard({ blockPaste: v });
              },
            }}
          />
        </>
      )}

      <SettingCard
        icon={<StickyNote size={15} />}
        title="Ghi chú cho người trình chiếu"
        hint="Chỉ bạn thấy — không hiện lên màn chiếu"
      >
        <textarea
          value={presenterNote}
          onChange={(e) => setPresenterNote(e.target.value)}
          onBlur={commitPresenterNote}
          placeholder="Nhắc bản thân điều cần nói..."
          rows={4}
          className="input w-full text-xs"
        />
      </SettingCard>

      {(slide.type === "quiz" || slide.type === "poll") && (
        <p className="px-1 text-[11px] leading-relaxed text-faint">
          Bình chọn luôn ẩn danh — học viên không cần đăng nhập để tham gia.
        </p>
      )}
      {slide.type === "content" && (
        <p className="px-1 text-[11px] leading-relaxed text-faint">
          Slide nội dung không cần học viên phản hồi — chỉ hiển thị.
        </p>
      )}
    </div>
  );
}
