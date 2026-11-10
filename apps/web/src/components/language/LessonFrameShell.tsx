"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelRightOpen, Sparkles, X } from "lucide-react";
import AiTutorPanel from "@/components/AiTutorPanel";
import { LessonNotes } from "@/components/LessonActions";
import {
  defaultPanelOpen,
  panelIsDocked,
  panelWidthClass,
  readPanelOpenPref,
  readPanelTabPref,
  writePanelOpenPref,
  writePanelTabPref,
  type PanelTab,
  type PanelWidthClass,
} from "@/lib/lessonFramePolicy";

/**
 * Vỏ phía máy khách của khung bài học 3 cột (docs/tieu-chi/limio-language-bai-hoc-3-cot.md): thanh bài bên trái, nội dung ở giữa,
 * panel phải có hai tab "AI trợ giảng" và "Ghi chú · n". Từ 1280 px panel gắn cố định cạnh nội dung (mở sẵn từ 1536 px, đóng sẵn
 * 1280–1535 px); dưới 1280 px panel là ngăn kéo che lên trang. Lựa chọn mở/đóng được nhớ riêng theo lớp chiều ngang.
 * Hội thoại AI và ghi chú KHÔNG mất khi chuyển tab hay đóng panel (hai tab luôn được dựng sau lần mở đầu tiên).
 */
export default function LessonFrameShell({
  lessonId,
  notesCount,
  rail,
  railLabel,
  railSummary,
  crumbs,
  nav,
  children,
}: {
  lessonId: string;
  notesCount: number;
  rail: React.ReactNode;
  railLabel: string;
  railSummary: string;
  crumbs: React.ReactNode;
  nav: React.ReactNode;
  children: React.ReactNode;
}) {
  // Lần dựng đầu (kể cả trên máy chủ) luôn đóng; chiều ngang thật chỉ biết sau khi mount.
  const [cls, setCls] = useState<PanelWidthClass>("narrow");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>("ai");
  const [everOpened, setEverOpened] = useState(false);
  const [notes, setNotes] = useState(notesCount);
  const [ask, setAsk] = useState<{ quote: string; nonce: number } | null>(null);
  const clsRef = useRef<PanelWidthClass | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const storage = useCallback((): Storage | null => {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  }, []);

  // Chiều ngang → lớp, rồi mở/đóng theo lựa chọn đã nhớ của lớp đó hoặc mặc định của lớp.
  useEffect(() => {
    const apply = () => {
      const next = panelWidthClass(window.innerWidth);
      const changed = next !== clsRef.current;
      clsRef.current = next;
      setCls(next);
      if (changed) {
        // Ngăn kéo (dưới 1280 px) KHÔNG nhớ trạng thái mở: bật sẵn sẽ che cả bài mỗi lần tải trang. Chỉ lớp gắn cố định mới nhớ.
        const pref = panelIsDocked(next) ? readPanelOpenPref(storage(), next) : null;
        const wantOpen = panelIsDocked(next) ? (pref ?? defaultPanelOpen(next)) : false;
        setOpen(wantOpen);
        if (wantOpen) setEverOpened(true);
      }
    };
    setTab(readPanelTabPref(storage()));
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [storage]);

  const openPanel = useCallback(
    (nextTab?: PanelTab) => {
      if (nextTab) {
        setTab(nextTab);
        writePanelTabPref(storage(), nextTab);
      }
      setOpen(true);
      setEverOpened(true);
      if (panelIsDocked(clsRef.current ?? "narrow")) writePanelOpenPref(storage(), clsRef.current ?? "narrow", true);
    },
    [storage],
  );

  const closePanel = useCallback(() => {
    setOpen(false);
    if (panelIsDocked(clsRef.current ?? "narrow")) writePanelOpenPref(storage(), clsRef.current ?? "narrow", false);
  }, [storage]);

  const chooseTab = (t: PanelTab) => {
    setTab(t);
    writePanelTabPref(storage(), t);
  };

  // "Hỏi AI" từ vùng bôi đen (LessonAnnotations): mở panel, sang tab AI, đính đoạn trích; không tự gửi.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const q = (e as CustomEvent<{ quote?: string }>).detail?.quote?.trim();
      if (!q) return;
      setAsk((prev) => ({ quote: q, nonce: (prev?.nonce ?? 0) + 1 }));
      openPanel("ai");
    };
    window.addEventListener("limio:ask-ai", onAsk);
    return () => window.removeEventListener("limio:ask-ai", onAsk);
  }, [openPanel]);

  // Ngăn kéo (dưới 1280 px): Esc đóng, và đưa tiêu điểm vào nút đóng khi mở.
  const docked = panelIsDocked(cls);
  useEffect(() => {
    if (!open || docked) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, docked, closePanel]);

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      chooseTab(tab === "ai" ? "notes" : "ai");
    }
  };

  const notesLabel = notes > 0 ? `Ghi chú · ${notes}` : "Ghi chú";

  return (
    <div
      // Dấu hiệu cho CSS: trong khung, nút nổi "Về trang chủ học viên" (góc dưới trái) bị rail che/đè chữ nên ẩn từ `lg` (globals.css).
      data-lesson-frame=""
      className={`mx-auto w-full max-w-[100rem] px-4 pt-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6 lg:px-6 ${
        open ? "xl:grid-cols-[16rem_minmax(0,1fr)_24rem]" : ""
      }`}
    >
      <aside aria-label={railLabel} className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-6 pr-1">{rail}</div>
      </aside>

      <div className="min-w-0">
        <details className="mb-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold">{railSummary}</summary>
          <div className="mt-3">{rail}</div>
        </details>
        {crumbs}
        {children}
        {nav}
      </div>

      {/* Nền mờ chỉ khi panel là ngăn kéo (dưới 1280 px). */}
      {open && !docked && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm xl:hidden" onClick={closePanel} aria-hidden />}

      <aside
        aria-label="Trợ giảng AI và ghi chú"
        hidden={!open}
        // `hidden` (lớp) chứ không chỉ thuộc tính: lớp `flex` của Tailwind đè display:none của thuộc tính `hidden`, làm panel đóng vẫn hiện.
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 right-0 z-50 w-full max-w-md flex-col border-l border-token bg-[rgb(var(--surface))] shadow-2xl xl:sticky xl:inset-auto xl:top-20 xl:z-auto xl:h-[calc(100vh-6rem)] xl:max-w-none xl:rounded-2xl xl:border xl:shadow-none`}
      >
        <div className="flex items-center gap-1 border-b border-token px-3 pt-2">
          <div role="tablist" aria-label="Công cụ học" className="flex flex-1 gap-1" onKeyDown={onTabKey}>
            {(
              [
                ["ai", "AI trợ giảng"],
                ["notes", notesLabel],
              ] as Array<[PanelTab, string]>
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={`lesson-panel-tab-${t}`}
                aria-selected={tab === t}
                aria-controls={`lesson-panel-${t}`}
                tabIndex={tab === t ? 0 : -1}
                onClick={() => chooseTab(t)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                  tab === t ? "border-brand-600 font-semibold text-brand-800" : "border-transparent text-muted hover:text-[rgb(var(--text))]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closePanel}
            aria-label="Đóng panel"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-[rgb(var(--surface-muted))]"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          {/* Hai tab luôn dựng sau lần mở đầu để giữ hội thoại và ghi chú đang soạn khi chuyển tab; tab không chọn chỉ bị ẩn. */}
          {everOpened && (
            <>
              <div id="lesson-panel-ai" role="tabpanel" aria-labelledby="lesson-panel-tab-ai" hidden={tab !== "ai"} className="absolute inset-0">
                <AiTutorPanel lessonId={lessonId} docked active={open && tab === "ai"} ask={ask} onRequestOpen={() => openPanel("ai")} />
              </div>
              <div id="lesson-panel-notes" role="tabpanel" aria-labelledby="lesson-panel-tab-notes" hidden={tab !== "notes"} className="absolute inset-0 overflow-y-auto px-4 pb-6 pt-3">
                <LessonNotes lessonId={lessonId} hideHeading onCount={setNotes} />
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Nút mở panel khi đang đóng: mép phải, giữa chiều cao màn hình. */}
      {!open && (
        <button
          type="button"
          onClick={() => openPanel()}
          aria-label="Mở trợ giảng AI và ghi chú"
          // Cao 32% (không phải giữa màn hình) để không đè lên cặp nút cuộn lên/xuống ở giữa mép phải và các nút nổi bên dưới.
          className="fixed right-0 top-[32%] z-30 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-xl border border-r-0 border-token bg-[rgb(var(--surface))] px-2 py-3 text-xs font-semibold text-brand-700 shadow-card hover:bg-brand-soft"
        >
          <Sparkles size={16} aria-hidden />
          <span className="[writing-mode:vertical-rl]">AI · Ghi chú{notes > 0 ? ` · ${notes}` : ""}</span>
          <PanelRightOpen size={14} aria-hidden className="text-faint" />
        </button>
      )}
    </div>
  );
}
