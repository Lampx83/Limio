"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Eye, EyeOff, MousePointerClick, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import {
  DEFAULT_READER_PREFS,
  PINYIN_MODES,
  PINYIN_SELECTOR,
  TEXT_SIZES,
  parseReaderPrefs,
  readerPrefsKey,
  serializeReaderPrefs,
  tapBlockOf,
  type PinyinMode,
  type ReaderPrefs,
  type TextSize,
} from "@/lib/readerPrefs";

/**
 * Tuỳ chọn đọc "Aa" của khoá ngoại ngữ (docs/tieu-chi/limio-language-ux-p0.md, mục D). Trạng thái nằm ở khung bài (`LessonFrameShell`) và đi xuống
 * qua context; khung đặt hai thuộc tính `data-rd-pinyin`, `data-rd-size` để CSS (globals.css) ẩn hẳn pinyin và đổi cỡ chữ nội dung.
 */
interface Ctx {
  prefs: ReaderPrefs;
  setPrefs: (next: Partial<ReaderPrefs>) => void;
  /** Khoá có pinyin thì mới hiện nhóm "Pinyin". */
  pinyinAvailable: boolean;
}

const ReaderPrefsContext = createContext<Ctx | null>(null);
export const ReaderPrefsProvider = ReaderPrefsContext.Provider;
export const useReaderPrefs = () => useContext(ReaderPrefsContext);

/** Trạng thái + lưu trữ. Lần dựng đầu luôn là mặc định (kể cả trên máy chủ) rồi mới đọc localStorage, để không lệch hydration. */
export function useReaderPrefsState(slug: string | undefined) {
  const [prefs, setPrefsState] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);
  useEffect(() => {
    if (!slug) return;
    try {
      setPrefsState(parseReaderPrefs(window.localStorage.getItem(readerPrefsKey(slug))));
    } catch {
      /* chặn lưu trữ (cửa sổ riêng tư…): giữ mặc định */
    }
  }, [slug]);
  const setPrefs = useCallback(
    (next: Partial<ReaderPrefs>) => {
      setPrefsState((prev) => {
        const merged = { ...prev, ...next };
        if (slug) {
          try {
            window.localStorage.setItem(readerPrefsKey(slug), serializeReaderPrefs(merged));
          } catch {
            /* không lưu được thì chỉ có hiệu lực trong phiên */
          }
        }
        return merged;
      });
    },
    [slug],
  );
  return { prefs, setPrefs };
}

/** "Chạm để xem": chạm vào một khối thì hiện/ẩn pinyin của khối đó (đặt `data-rd-shown` lên từng phần tử pinyin; CSS ẩn phần tử chưa có dấu). */
export function useTapReveal(rootRef: React.RefObject<HTMLElement>, mode: PinyinMode) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll("[data-rd-shown]").forEach((el) => el.removeAttribute("data-rd-shown"));
    if (mode !== "tap") return;
    const onClick = (e: MouseEvent) => {
      const block = tapBlockOf(e.target instanceof Element ? e.target : null);
      if (!block || !root.contains(block)) return;
      const els = [...block.querySelectorAll(PINYIN_SELECTOR)];
      if (els.length === 0) return;
      const on = els.every((el) => el.hasAttribute("data-rd-shown"));
      els.forEach((el) => (on ? el.removeAttribute("data-rd-shown") : el.setAttribute("data-rd-shown", "")));
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [rootRef, mode]);
}

const SEEN_KEY = "limio:reader:seen";

/** Mẫu chữ ngay trong bảng: học viên thấy kết quả của lựa chọn (pinyin + cỡ chữ) trước khi đóng bảng. */
function Preview({ prefs, pinyinAvailable }: { prefs: ReaderPrefs; pinyinAvailable: boolean }) {
  const t = useT();
  const scale = prefs.size === "xl" ? 1.25 : prefs.size === "l" ? 1.12 : 1;
  const zh: Array<[string, string]> = [["你", "nǐ"], ["好", "hǎo"], ["吗", "ma"]];
  return (
    <div className="mb-4 border border-token bg-brand-50 px-4 py-3" aria-hidden data-testid="reader-prefs-preview">
      <div style={{ fontSize: `${scale}rem` }} className="leading-snug">
        {pinyinAvailable ? (
          <span className="inline-flex items-end gap-1.5">
            {zh.map(([han, py]) => (
              <span key={han} className="inline-flex flex-col items-center leading-tight">
                {prefs.pinyin === "show" && <span className="text-[0.55em] text-muted">{py}</span>}
                <span className="text-[1.6em] font-medium text-brand-800">{han}</span>
              </span>
            ))}
            {prefs.pinyin === "tap" && <span className="ml-2 inline-flex items-center gap-1 text-[0.6em] text-muted"><MousePointerClick size={14} />{t("reader.prefs.tapHint")}</span>}
          </span>
        ) : (
          <span>{t("reader.prefs.sampleText")}</span>
        )}
      </div>
    </div>
  );
}

function Seg<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: Array<{ v: T; text: string; icon: React.ReactNode }>; onPick: (v: T) => void }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
        {options.map(({ v, text, icon }) => {
          const on = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={text}
              onClick={() => onPick(v)}
              className={`relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 border-2 px-1 py-2 text-center transition-colors ${
                on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-token bg-[rgb(var(--surface))] text-[rgb(var(--text))] hover:border-brand-400"
              }`}
            >
              <span className="flex h-6 items-center justify-center" aria-hidden>
                {icon}
              </span>
              <span className="text-xs font-semibold leading-tight">{text}</span>
              {on && (
                <span aria-hidden className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center bg-brand-600 text-white">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const sizeGlyph = (cls: string) => <span className={`font-bold leading-none ${cls}`}>A</span>;

/**
 * Nút "Aa" và bảng tuỳ chọn. Nút nổi bật (viền + chữ màu nhấn, có nhãn trên màn rộng), có chấm khi đang khác mặc định và chấm gợi ý nhấp nháy tới lần mở đầu.
 * Bảng: dưới `sm` là ngăn kéo từ đáy màn hình (ô lớn dễ chạm), từ `sm` là hộp thả dưới nút; mỗi lựa chọn là một ô có biểu tượng và có mẫu chữ xem trước.
 * Không có context (ngoài khung bài) thì không hiện gì.
 */
export function ReaderPrefsMenu({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) {
  const ctx = useReaderPrefs();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      setSeen(window.localStorage.getItem(SEEN_KEY) === "1");
    } catch {
      setSeen(true);
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (sheet.current?.contains(n) || btn.current?.contains(n)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!ctx) return null;
  const toggle = () => {
    if (!open) {
      const r = btn.current?.getBoundingClientRect();
      // Nút nằm ở thanh đáy: bảng mở LÊN trên nút, căn giữa theo nút nhưng không tràn ra ngoài màn hình.
      if (r) setPos({ bottom: window.innerHeight - r.top + 8, left: Math.min(Math.max(r.left + r.width / 2, 184), window.innerWidth - 184) });
      setSeen(true);
      try {
        window.localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* bỏ qua */
      }
    }
    setOpen((v) => !v);
  };
  const changed = ctx.prefs.pinyin !== DEFAULT_READER_PREFS.pinyin || ctx.prefs.size !== DEFAULT_READER_PREFS.size;
  const pinyinOpts: Array<{ v: PinyinMode; text: string; icon: React.ReactNode }> = [
    { v: "show", text: t("reader.prefs.pinyin.show"), icon: <Eye size={22} /> },
    { v: "tap", text: t("reader.prefs.pinyin.tap"), icon: <MousePointerClick size={22} /> },
    { v: "off", text: t("reader.prefs.pinyin.off"), icon: <EyeOff size={22} /> },
  ];
  const sizeOpts: Array<{ v: TextSize; text: string; icon: React.ReactNode }> = [
    { v: "m", text: t("reader.prefs.size.m"), icon: sizeGlyph("text-base") },
    { v: "l", text: t("reader.prefs.size.l"), icon: sizeGlyph("text-xl") },
    { v: "xl", text: t("reader.prefs.size.xl"), icon: sizeGlyph("text-[1.75rem]") },
  ];
  const panel = (
    <>
      <div className="fixed inset-0 z-[60] bg-black/35 sm:hidden" aria-hidden onClick={() => setOpen(false)} />
      <div
        ref={sheet}
        role="dialog"
        aria-label={t("reader.prefs.title")}
        data-testid="reader-prefs"
        style={{ ["--rd-bottom" as string]: `${pos.bottom}px`, ["--rd-left" as string]: `${pos.left}px` } as React.CSSProperties}
        className="fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto border-t-4 border-brand-600 bg-[rgb(var(--surface))] p-4 pb-6 shadow-2xl sm:inset-x-auto sm:bottom-[var(--rd-bottom)] sm:left-[var(--rd-left)] sm:w-[22rem] sm:-translate-x-1/2 sm:pb-4 sm:shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-700">{t("reader.prefs.title")}</p>
          <div className="flex items-center gap-2">
            {changed && (
              <button type="button" onClick={() => ctx.setPrefs(DEFAULT_READER_PREFS)} className="text-xs font-semibold text-brand-700 underline underline-offset-2">
                {t("reader.prefs.reset")}
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label={t("reader.prefs.close")} className="flex h-8 w-8 items-center justify-center text-muted hover:bg-black/5">
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>
        <Preview prefs={ctx.prefs} pinyinAvailable={ctx.pinyinAvailable} />
        {ctx.pinyinAvailable && <Seg label={t("reader.prefs.pinyin")} value={ctx.prefs.pinyin} options={pinyinOpts} onPick={(pinyin) => ctx.setPrefs({ pinyin })} />}
        <Seg label={t("reader.prefs.size")} value={ctx.prefs.size} options={sizeOpts} onPick={(size) => ctx.setPrefs({ size })} />
      </div>
    </>
  );
  return (
    <div className={`relative ${className}`}>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("reader.prefs.title")}
        title={t("reader.prefs.title")}
        data-testid="reader-prefs-button"
        className={`btn btn-sm relative gap-1.5 whitespace-nowrap font-bold text-brand-800 ${open ? "bg-brand-200" : "bg-brand-100 hover:bg-brand-200"}`}
      >
        <span className="text-sm leading-none">Aa</span>
        {showLabel && <span className="hidden md:inline">{t("reader.prefs.button")}</span>}
        {(!seen || changed) && (
          <span aria-hidden data-testid="reader-prefs-dot" className="absolute -right-1 -top-1 flex h-3 w-3 rounded-full ring-2 ring-[rgb(var(--surface))]">
            {!seen && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75" />}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${seen ? "bg-brand-600" : "bg-pink-500"}`} />
          </span>
        )}
      </button>
      {open && typeof document !== "undefined" && createPortal(panel, document.body)}
    </div>
  );
}
