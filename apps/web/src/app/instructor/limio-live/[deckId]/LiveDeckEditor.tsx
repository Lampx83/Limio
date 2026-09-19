"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "../ResourceContent";
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

export default function LiveDeckEditor({ deckId }: { deckId: string }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
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
    const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/slides/${slideId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) { toast.error("Lưu thất bại"); return; }
    const saved: Slide = await res.json();
    setDeck((prev) => (prev ? { ...prev, slides: prev.slides.map((s) => (s.id === saved.id ? saved : s)) } : prev));
    setLastSavedAt(new Date());
  };

  if (!deck) return <p className="text-sm text-muted">Đang tải...</p>;

  const selectedSlide = deck.slides.find((s) => s.id === selectedSlideId) ?? null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-16 flex-shrink-0 items-center gap-4 border-b border-token bg-[rgb(var(--surface))] px-6">
        <Link href="/instructor/limio-live" className="text-sm text-muted hover:text-brand-600">
          Limio-Live
        </Link>
        <span className="text-token">/</span>
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={handleSaveTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="rounded-lg px-2 py-1.5 text-[15px] font-bold hover:bg-[rgb(var(--surface-muted))] focus:bg-[rgb(var(--surface-muted))] focus:outline-none"
          style={{ width: `${Math.max(titleDraft.length, 8)}ch` }}
        />
        {lastSavedAt && (
          <span className="text-xs text-faint">
            Đã lưu ·{" "}
            {lastSavedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <div className="flex-grow" />
        <Link
          href={`/instructor/limio-live/${deckId}/present`}
          className="btn flex items-center gap-2 bg-brand-gradient px-4 text-sm font-semibold text-white shadow-sm hover:shadow-brand-glow"
        >
          <Presentation size={15} /> Trình chiếu
        </Link>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left rail — slide list */}
        <div className="w-64 flex-shrink-0 overflow-y-auto border-r border-token bg-[rgb(var(--surface-muted))] p-4">
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

          {pdfProgress ? (
            <div className="mb-3.5 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 text-center text-xs text-muted">
              Đang xử lý PDF...{" "}
              {pdfProgress.total > 0 && `trang ${pdfProgress.current}/${pdfProgress.total}`}
            </div>
          ) : !pickingType ? (
            <button onClick={() => setPickingType(true)} className="btn-secondary mb-3.5 w-full">
              + Thêm slide
            </button>
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
                    onSelect={() => setSelectedSlideId(slide.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Center — live WYSIWYG preview */}
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
          {selectedSlide ? (
            <div
              key={selectedSlide.id}
              className="box-border flex min-h-[518px] w-full max-w-[920px] flex-col rounded-[20px] bg-white p-12 text-[#20241F] shadow-[0_12px_32px_rgba(32,36,31,0.10)]"
            >
              <SlideCenterEditor slide={selectedSlide} onSave={(patch) => handleSaveSlide(selectedSlide.id, patch)} />
            </div>
          ) : (
            <p className="text-sm text-muted">Chưa có slide nào — bấm "+ Thêm slide" bên trái.</p>
          )}
        </div>

        {/* Right rail — type legend + settings */}
        {selectedSlide && (
          <div className="w-[300px] flex-shrink-0 overflow-y-auto border-l border-token bg-[rgb(var(--surface))] p-5">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted">Loại slide</p>
            <div className="mb-6 grid grid-cols-2 gap-2">
              {SLIDE_ORDER.map((type) => {
                const meta = SLIDE_TYPE_META[type];
                const isCurrent = type === selectedSlide.type;
                return (
                  <div
                    key={type}
                    className={`rounded-lg px-2 py-2.5 text-center text-xs font-semibold ${
                      isCurrent ? meta.badge : "border border-token text-faint"
                    }`}
                  >
                    {meta.label}
                  </div>
                );
              })}
            </div>

            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted">Cài đặt</p>
            <SettingsPanel
              key={selectedSlide.id}
              slide={selectedSlide}
              onSave={(patch) => handleSaveSlide(selectedSlide.id, patch)}
            />

            <button
              onClick={() => handleDeleteSlide(selectedSlide.id)}
              className="btn-text btn-danger mt-8 flex w-full items-center justify-center gap-1.5 text-xs"
            >
              <Trash2 size={13} /> Xoá slide này
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Left rail thumb ──────────────────────────────────────────────────────

function SlideThumb({
  slide,
  index,
  isActive,
  onSelect,
}: {
  slide: Slide;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const meta = SLIDE_TYPE_META[slide.type];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      onClick={onSelect}
      className={`mb-2.5 cursor-pointer rounded-xl border bg-[rgb(var(--surface))] p-2.5 transition ${
        isActive
          ? "border-brand-600 shadow-[0_0_0_3px_rgb(163,230,53,0.3)]"
          : "border-token hover:border-brand-300"
      }`}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="-ml-0.5 cursor-grab px-0.5 text-xs text-faint active:cursor-grabbing"
          aria-label="Kéo để sắp xếp"
          type="button"
        >
          ⠿
        </button>
        <span className="text-[11px] font-bold text-faint">{index + 1}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${meta.badge}`}>
          {meta.label}
        </span>
        {slide.timerSeconds != null && (
          <span className="ml-auto flex items-center gap-0.5 text-[10px] text-faint">
            <Clock size={10} /> {Math.round(slide.timerSeconds / 60)}p
          </span>
        )}
      </div>
      <p className="truncate text-[12.5px] leading-snug text-[rgb(var(--text))]">{slideSummary(slide)}</p>
    </div>
  );
}

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
    };
    onSave({ config: next });
  };

  const commitResource = (next: { type: ResourceType; payload: Record<string, any> } | null) => {
    setResource(next);
    onSave({ config: { title, subtitle, bullets, ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}), resource: next ?? undefined } });
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
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onBlur={() => commit({})}
        placeholder="Nhập câu hỏi..."
        rows={2}
        className={`${bareInputClass} mb-5 text-[24px] font-bold leading-snug`}
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
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => onSave({ config: { prompt: prompt.trim() } })}
        placeholder="Nhập câu hỏi / prompt cho Word Cloud..."
        rows={2}
        className={`${bareInputClass} mb-5 text-[24px] font-bold leading-snug`}
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

  return (
    <div className="flex h-full flex-col">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => onSave({ config: { ...config, prompt: prompt.trim() } })}
        placeholder="Nhập câu hỏi / hướng dẫn cho bảng cộng tác..."
        rows={2}
        className={`${bareInputClass} mb-4 text-[22px] font-bold leading-snug`}
      />
      <div className="grid flex-grow grid-cols-4 gap-2.5 content-start">
        {SAMPLE_STICKY.map((s, idx) => (
          <div key={idx} className="rounded-[10px] p-3 text-xs text-black/50" style={{ background: s.bg }}>
            {s.text}
          </div>
        ))}
        <div className="flex items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#D8D4C4] bg-[#FCFBF7] text-[11px] text-[#9AA090]">
          Học viên đăng ghi chú vào đây
        </div>
      </div>
    </div>
  );
}

// ── Right rail settings ──────────────────────────────────────────────────

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
  const [columnsText, setColumnsText] = useState((config.columns ?? []).join(", "));
  const [allowViewOthers, setAllowViewOthers] = useState(config.allowViewOthers ?? true);
  const [blockPaste, setBlockPaste] = useState(config.blockPaste ?? false);
  const [presenterNote, setPresenterNote] = useState(config.presenterNote ?? "");

  const commitTimer = (enabled: boolean, minutes: number) => {
    onSave({ timerSeconds: enabled ? Math.max(1, minutes) * 60 : null });
  };

  const commitPresenterNote = () => {
    onSave({ config: { ...config, presenterNote: presenterNote.trim() || undefined } });
  };

  const commitBoard = (patch: Partial<{ mode: "free" | "grouped"; columns: string; allowViewOthers: boolean; blockPaste: boolean }>) => {
    const mode = patch.mode ?? boardMode;
    const cols = (patch.columns ?? columnsText).split(",").map((c: string) => c.trim()).filter(Boolean);
    onSave({
      config: {
        ...config,
        mode,
        ...(mode === "grouped" ? { columns: cols } : {}),
        allowViewOthers: patch.allowViewOthers ?? allowViewOthers,
        blockPaste: patch.blockPaste ?? blockPaste,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-token p-3">
        <label className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Clock size={13} className="text-muted" /> Giới hạn thời gian
          </span>
          <input
            type="checkbox"
            checked={timerEnabled}
            onChange={(e) => {
              setTimerEnabled(e.target.checked);
              commitTimer(e.target.checked, timerMinutes);
            }}
            className="h-5 w-5 accent-brand-600"
          />
        </label>
        {timerEnabled && (
          <div className="mt-2.5 flex items-center gap-2">
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
            <span className="text-xs text-muted">phút — GV tự bấm Bắt đầu lúc trình chiếu</span>
          </div>
        )}
      </div>

      {slide.type === "collaborate_board" && (
        <>
          <div>
            <p className="mb-2 text-sm font-medium">Cách hiển thị</p>
            <div className="mb-2 inline-flex rounded-lg border border-token p-0.5">
              <button
                onClick={() => {
                  setBoardMode("free");
                  commitBoard({ mode: "free" });
                }}
                className={`rounded-md px-2.5 py-1 text-xs ${boardMode === "free" ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30" : ""}`}
              >
                Tự do
              </button>
              <button
                onClick={() => {
                  setBoardMode("grouped");
                  commitBoard({ mode: "grouped" });
                }}
                className={`rounded-md px-2.5 py-1 text-xs ${boardMode === "grouped" ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30" : ""}`}
              >
                Chia theo cột
              </button>
            </div>
            {boardMode === "grouped" && (
              <input
                value={columnsText}
                onChange={(e) => setColumnsText(e.target.value)}
                onBlur={() => commitBoard({})}
                placeholder="Tên cột, cách nhau bằng dấu phẩy"
                className="input w-full text-xs"
              />
            )}
          </div>
          <label className="flex items-center justify-between gap-3 border-t border-token pt-3 text-sm">
            <span>Xem ghi chú của nhau</span>
            <input
              type="checkbox"
              checked={allowViewOthers}
              onChange={(e) => {
                setAllowViewOthers(e.target.checked);
                commitBoard({ allowViewOthers: e.target.checked });
              }}
              className="h-5 w-5 accent-brand-600"
            />
          </label>
          <label className="flex items-center justify-between gap-3 border-t border-token pt-3 text-sm">
            <span>Chặn dán (chống copy)</span>
            <input
              type="checkbox"
              checked={blockPaste}
              onChange={(e) => {
                setBlockPaste(e.target.checked);
                commitBoard({ blockPaste: e.target.checked });
              }}
              className="h-5 w-5 accent-brand-600"
            />
          </label>
        </>
      )}

      {slide.type === "content" && (
        <>
          <p className="text-xs leading-relaxed text-muted">
            Slide nội dung không cần học viên phản hồi — chỉ hiển thị.
          </p>
          <div className="rounded-xl border border-token p-3">
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              <StickyNote size={13} className="text-muted" /> Ghi chú cho người trình chiếu
            </label>
            <textarea
              value={presenterNote}
              onChange={(e) => setPresenterNote(e.target.value)}
              onBlur={commitPresenterNote}
              placeholder="Chỉ bạn thấy — không hiện lên màn chiếu..."
              rows={4}
              className="input w-full text-xs"
            />
          </div>
        </>
      )}
      {(slide.type === "quiz" || slide.type === "poll") && (
        <p className="text-xs leading-relaxed text-muted">
          Bình chọn luôn ẩn danh — học viên không cần đăng nhập để tham gia.
        </p>
      )}
    </div>
  );
}
