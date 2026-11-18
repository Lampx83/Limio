"use client";

import Collapse from "@/components/ui/Collapse";
import { accentVar } from "@/lib/courseAccent";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Sparkles, X } from "lucide-react";
import AiTutorPanel from "@/components/AiTutorPanel";
import { useT } from "@/lib/i18n/client";
import { LessonNotes } from "@/components/LessonActions";
import { LessonFrameActionsProvider } from "./LessonFrameContext";
import { useLessonSections } from "./useLessonSections";
import { ReaderPrefsProvider, useReaderPrefsState, useTapReveal } from "./ReaderPrefs";
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
  accent = null,
  slug,
  lessonTitle,
  posLabel,
  unitPct = 0,
  mobileExtra,
  readerPinyin = false,
  children,
}: {
  lessonId: string;
  notesCount: number;
  rail: React.ReactNode;
  railLabel: string;
  railSummary: string;
  crumbs: React.ReactNode;
  nav: React.ReactNode;
  /** Màu nhấn của bộ sách (`Course.themeColor`); trống = màu Limio. */
  accent?: string | null;
  /** Slug khoá: khoá lưu tuỳ chọn đọc "Aa". */
  slug?: string;
  /** Có tên bài thì dưới `lg` dùng thanh điều hướng một dòng (docs/tieu-chi/limio-language-ux-p0.md, mục A) thay cho thẻ "Bài trong unit" và đường dẫn. */
  lessonTitle?: string;
  /** "4/21": vị trí bài trong unit. */
  posLabel?: string;
  /** Phần trăm bài đã xong của unit (vạch tiến độ dưới thanh). */
  unitPct?: number;
  /** Nội dung thêm cuối danh sách bài trên thanh một dòng (nút "Mục lục khoá học"). */
  mobileExtra?: React.ReactNode;
  /** Khoá có pinyin: bảng "Aa" có nhóm Pinyin. */
  readerPinyin?: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const reader = useReaderPrefsState(slug);
  useTapReveal(rootRef, { pinyin: reader.prefs.pinyin, translation: reader.prefs.translation });
  const [barOpen, setBarOpen] = useState(false);
  // Thanh trên dưới lg: nhãn là MỤC đang đọc (01 Tình huống, 02 Hội thoại…) khi bài có từ 2 mục có số; không thì tên bài.
  const { secs, cur: curSec } = useLessonSections();
  const bySections = secs.length >= 2;
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

  const notesLabel = notes > 0 ? t("ai.panel.tabNotesN", { n: notes }) : t("ai.panel.tabNotes");

  return (
    <LessonFrameActionsProvider value={{ openPanel: () => openPanel() }}>
    <ReaderPrefsProvider value={{ prefs: reader.prefs, setPrefs: reader.setPrefs, pinyinAvailable: readerPinyin }}>
    <div
      ref={rootRef}
      data-rd-pinyin={reader.prefs.pinyin}
      data-rd-translation={reader.prefs.translation}
      data-rd-size={reader.prefs.size}
      // Dấu hiệu cho CSS: trong khung, nút nổi "Về trang chủ học viên" (góc dưới trái) bị rail che/đè chữ nên ẩn từ `lg` (globals.css).
      data-lesson-frame=""
      // Khoá có màu bộ sách: biến --brand của khung (thanh bài, nút, đường kẻ) đổi theo; CSS `[data-lesson-accent]` (globals.css) đổi các lớp brand cố định.
      data-lesson-accent={accentVar(accent) ? "" : undefined}
      style={accentVar(accent) ? ({ ["--brand" as string]: accentVar(accent) } as React.CSSProperties) : undefined}
      // Ba dải toàn chiều cao như thiết kế Figma (thanh bài | nội dung | panel), ngăn bằng đường kẻ; không bọc khung/lề ngoài để nội dung
      // dùng hết bề ngang. Thanh bài 12rem, panel 20rem ở 1280–1535 px; nới ra 13rem/22rem từ 1536 px.
      className={`w-full lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] ${
        open ? "xl:grid-cols-[12rem_minmax(0,1fr)_20rem] 2xl:grid-cols-[13rem_minmax(0,1fr)_22rem]" : "2xl:grid-cols-[13rem_minmax(0,1fr)]"
      }`}
    >
      <aside aria-label={railLabel} className="hidden border-r border-token lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto px-3 pb-6 pt-4">{rail}</div>
      </aside>

      {/* Panel đóng: chừa lề phải ~4rem để hai nút nổi (cuộn lên/xuống + mở panel, rộng 40px cách mép 17px) nằm NGOÀI nội dung chứ không đè lên chữ. */}
      <div className={`min-w-0 px-4 pt-4 lg:pl-5 ${open ? "lg:pr-5" : "lg:pr-16"}`}>
        {lessonTitle ? (
          <div data-testid="lesson-mobile-bar" className="sticky top-[4.5rem] z-30 -mx-4 mb-3 border-b border-token bg-[rgb(var(--surface)/0.97)] backdrop-blur lg:hidden">
            <div className="flex items-stretch">
              <button type="button" onClick={() => setBarOpen((v) => !v)} aria-expanded={barOpen} aria-label={t("reader.bar.list")} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left">
                {bySections ? (
                  // Hai dòng: tên bài (nhỏ, mờ) rồi mục đang đọc (chính): cuộn sâu vẫn biết đang ở bài nào và mục nào.
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="block truncate text-[0.7rem] text-muted" data-testid="bar-lesson-title">
                      {lessonTitle}
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      <b className="shrink-0 text-sm tabular-nums text-brand-700" data-testid="bar-section-no">
                        {secs[curSec]?.no}
                      </b>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium" data-testid="bar-section-label">
                        {secs[curSec]?.label}
                      </span>
                    </span>
                  </span>
                ) : (
                  <>
                    {posLabel && <b className="shrink-0 text-sm tabular-nums text-brand-700">{posLabel}</b>}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{lessonTitle}</span>
                  </>
                )}
                <ChevronDown size={16} aria-hidden className={`shrink-0 text-muted transition-transform ${barOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
            {bySections ? (
              <div className="flex gap-0.5" aria-hidden data-testid="bar-section-progress">
                {secs.map((_, i) => (
                  <div key={i} className={`h-0.5 flex-1 ${i < curSec ? "bg-gray-400 dark:bg-gray-500" : i === curSec ? "bg-gray-700 dark:bg-gray-200" : "bg-gray-200 dark:bg-gray-700"}`} />
                ))}
              </div>
            ) : (
              <div className="h-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden>
                <div className="h-full bg-gray-500 dark:bg-gray-300" style={{ width: `${Math.max(0, Math.min(100, unitPct))}%` }} />
              </div>
            )}
            {/* Dropdown mở/thu mượt; `lazy`: chỉ dựng nội dung khi mở (và lúc đang thu). */}
            <Collapse open={barOpen} lazy>
              <div className="max-h-[60vh] overflow-y-auto border-t border-token px-4 pb-4 pt-3">
                {bySections && (
                  <div className="mb-4" data-testid="bar-sections-list">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{t("reader.bar.sections")}</p>
                    <ol className="border-l border-token pl-1">
                      {secs.map((s, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            aria-current={i === curSec ? "location" : undefined}
                            onClick={() => {
                              setBarOpen(false);
                              s.el.scrollIntoView({ block: "start", behavior: "smooth" });
                            }}
                            className={`flex w-full items-baseline gap-2 px-2 py-2 text-left text-sm hover:bg-black/5 ${i === curSec ? "bg-brand-50 font-bold text-brand-800" : ""}`}
                          >
                            <span className="shrink-0 tabular-nums text-muted">{s.no}</span>
                            <span className="min-w-0 flex-1">{s.label}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {lessonTitle && <p className="mb-1 text-xs font-semibold text-muted">{[posLabel, lessonTitle].filter(Boolean).join(" · ")}</p>}
                {rail}
                {mobileExtra && <div className="mt-3">{mobileExtra}</div>}
              </div>
            </Collapse>
          </div>
        ) : (
          <details className="mb-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold">{railSummary}</summary>
            <div className="mt-3">{rail}</div>
          </details>
        )}
        <div className={lessonTitle ? "hidden lg:block" : undefined}>{crumbs}</div>
        {children}
        {nav}
      </div>

      {/* Nền mờ chỉ khi panel là ngăn kéo (dưới 1280 px). */}
      {open && !docked && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm xl:hidden" onClick={closePanel} aria-hidden />}

      <aside
        aria-label={t("ai.panel.aria")}
        hidden={!open}
        // `hidden` (lớp) chứ không chỉ thuộc tính: lớp `flex` của Tailwind đè display:none của thuộc tính `hidden`, làm panel đóng vẫn hiện.
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 right-0 z-50 w-full max-w-md flex-col border-l border-token bg-[rgb(var(--surface))] shadow-2xl xl:sticky xl:inset-auto xl:top-20 xl:z-auto xl:h-[calc(100vh-5rem)] xl:max-w-none xl:border-y-0 xl:border-r-0 xl:shadow-none`}
      >
        <div className="flex items-center gap-1 border-b border-token px-3 pt-2">
          <div role="tablist" aria-label={t("ai.panel.toolsLabel")} className="flex flex-1 gap-1" onKeyDown={onTabKey}>
            {(
              [
                ["ai", t("ai.panel.tabAi")],
                ["notes", notesLabel],
              ] as Array<[PanelTab, string]>
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                id={`lesson-panel-tab-${tabKey}`}
                aria-selected={tab === tabKey}
                aria-controls={`lesson-panel-${tabKey}`}
                tabIndex={tab === tabKey ? 0 : -1}
                onClick={() => chooseTab(tabKey)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                  tab === tabKey ? "border-brand-600 font-semibold text-brand-800" : "border-transparent text-muted hover:text-[rgb(var(--text))]"
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
            aria-label={t("ai.panel.close")}
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
              <div id="lesson-panel-notes" role="tabpanel" aria-labelledby="lesson-panel-tab-notes" hidden={tab !== "notes"} className="absolute inset-0 overflow-y-auto px-3 pb-4 pt-2.5">
                <LessonNotes lessonId={lessonId} hideHeading onCount={setNotes} />
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Nút mở panel khi đang đóng: nút tròn cùng bề rộng (~2.35rem) và cùng mép phải (right-4) với cặp nút cuộn lên/xuống của trang bài
          (ScrollEnds, bottom-[17rem]), xếp ngay dưới nó cho thành một cột thẳng hàng; `narration-lift` để nâng theo khi có thanh nghe giảng. Giảng viên có thêm nút cam "Bảng giảng viên"
          (TeacherBar, bottom-52) cùng cột: khi có nó, `lesson-fab-panel` và `lesson-fab-scroll` được nâng lên trên nút cam (narration.css). */}
      {!open && (
        <button
          type="button"
          onClick={() => openPanel()}
          aria-label={t("ai.panel.openAria")}
          title={notes > 0 ? t("ai.panel.openTitleN", { n: notes }) : t("ai.panel.openTitle")}
          className="narration-lift lesson-fab-panel fixed bottom-[14.2rem] right-4 z-30 flex h-[2.35rem] w-[2.35rem] items-center justify-center rounded-full bg-brand-gradient text-white shadow-lg ring-2 ring-white/80 transition-transform hover:scale-105 print:hidden"
        >
          <Sparkles size={18} aria-hidden />
          {notes > 0 && (
            <span aria-hidden className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold leading-none text-brand-700 shadow ring-1 ring-brand-200">
              {notes}
            </span>
          )}
        </button>
      )}
    </div>
    </ReaderPrefsProvider>
    </LessonFrameActionsProvider>
  );
}
