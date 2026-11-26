"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import BookCover from "@/components/BookCover";
import { PriceBlock } from "@/components/PriceTag";
import type { HskBook } from "@/lib/space/hskBundles";
import type { SpaceLang } from "@/lib/space/types";

const UI = {
  vi: {
    title: (level: number, n: number) => `HSK ${level}: ${n} quyển`,
    sub: "Mỗi quyển là một khoá riêng, học theo thứ tự từ quyển 1. Mua lẻ từng quyển, hoặc mua trọn bộ để rẻ hơn.",
    view: "Xem quyển",
    lessons: (n: number) => `${n} bài học`,
    close: "Đóng",
    book: (n: number) => `Quyển ${n}`,
    combo: "Xem gói trọn bộ, tiết kiệm hơn",
  },
  en: {
    title: (level: number, n: number) => `HSK ${level}: ${n} books`,
    sub: "Each book is its own course, studied in order from book 1. Buy them one by one, or buy the full set for less.",
    view: "View book",
    lessons: (n: number) => `${n} lessons`,
    close: "Close",
    book: (n: number) => `Book ${n}`,
    combo: "See the full set and save",
  },
} as const;

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Khối cấp HSK có nhiều quyển: bấm vào mở popup danh sách quyển ngay tại chỗ (không tải lại trang). `children` là thân thẻ cấp do
 * server dựng. Địa chỉ cập nhật thành `?level=N` (replaceState) để chia sẻ được; mở thẳng `/hsk?level=N` thì popup tự mở.
 * Popup: Esc / bấm nền / nút × để đóng, khoá cuộn nền, giữ tiêu điểm trong hộp, trả tiêu điểm về thẻ khi đóng.
 */
export default function HskLevelPopup({
  level,
  books,
  lang,
  initialOpen,
  hasCombo,
  className,
  children,
}: {
  level: number;
  books: HskBook[];
  lang: SpaceLang;
  initialOpen: boolean;
  /** Trang có khối combo ở cuối: popup có liên kết nhảy tới đó. */
  hasCombo: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const t = UI[lang];
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const syncUrl = useCallback((on: boolean) => {
    try {
      const url = new URL(window.location.href);
      if (on) url.searchParams.set("level", String(level));
      else url.searchParams.delete("level");
      url.hash = "";
      window.history.replaceState(null, "", url.toString());
    } catch {
      // Không cập nhật được địa chỉ thì thôi: popup vẫn dùng được.
    }
  }, [level]);

  const openPopup = useCallback(() => {
    setOpen(true);
    syncUrl(true);
  }, [syncUrl]);
  const closePopup = useCallback(() => {
    setOpen(false);
    syncUrl(false);
    triggerRef.current?.focus();
  }, [syncUrl]);

  useEffect(() => {
    setMounted(true);
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  // Khoá cuộn nền + chuyển tiêu điểm vào popup khi mở.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      closePopup();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const popup = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closePopup();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`hsk-popup-title-${level}`}
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id={`hsk-popup-title-${level}`} className="text-2xl font-extrabold text-[color:var(--sp)]">
              {t.title(level, books.length)}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{t.sub}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closePopup}
            aria-label={t.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {books.map((b) => (
            <li key={b.slug} className="min-w-0">
              <Link
                href={`/catalog/${b.slug}`}
                prefetch={false}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
              >
                <BookCover
                  src={b.coverUrl}
                  alt={b.title}
                  fallback={<span className="text-3xl font-extrabold text-[color:var(--sp)]">{b.book}</span>}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-snug text-slate-900">{t.book(b.book)}</span>
                  <span className="block text-xs text-slate-500">{t.lessons(b.lessonCount)}</span>
                </span>
                {b.priceCents > 0 && (
                  <PriceBlock align="left" size="sm" originalCents={b.originalPriceCents} saleCents={b.priceCents} currency={b.currency} />
                )}
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-[color:var(--sp)]">
                  {t.view}
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {hasCombo && (
          <div className="mt-6 border-t border-slate-200 pt-4 text-center">
            <a
              href="#combo"
              onClick={closePopup}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sp)] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--sp-dark)]"
            >
              {t.combo}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPopup}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPopup();
          }
        }}
        className={`cursor-pointer ${className}`}
      >
        {children}
      </div>
      {open && mounted && createPortal(popup, document.body)}
    </>
  );
}
