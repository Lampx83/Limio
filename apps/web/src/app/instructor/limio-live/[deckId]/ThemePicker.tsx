"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { DECK_LANGUAGES } from "@/lib/limioLiveLanguage";
import type { SlideMotifId } from "@/lib/limioLiveMotifs";
import { SLIDE_THEMES, SLIDE_THEME_GROUPS, type SlideThemeId } from "../slideThemes";
import { DeckMotifPicker } from "./MotifPicker";
import { IMAGE_FRAMES, IMAGE_FRAME_LABEL, type ImageFrame } from "@/lib/limioLiveImageStyle";

/** Mẫu nhỏ của từng khung hình (cùng cách cắt như slideLayouts.css). */
const FRAME_SWATCH: Record<ImageFrame, CSSProperties> = {
  round: { borderRadius: 7 },
  circle: { borderRadius: "50%" },
  arch: { borderRadius: "999px 999px 5px 5px" },
  hex: { clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" },
  blob: { borderRadius: "62% 38% 46% 54% / 46% 52% 48% 54%" },
  leaf: { borderRadius: "16px 4px 16px 4px" },
  offset: { borderRadius: 6, boxShadow: "4px 4px 0 0 rgb(101 163 13 / .4)" },
};

/**
 * Nút "Giao diện" duy nhất của bài giảng: một bảng gồm kiểu slide (gom theo nhóm Cơ bản, Màu pastel, Nền tối),
 * hoa văn, ngôn ngữ của slide, logo và màu thương hiệu. Trước đây thương hiệu là một nút riêng cạnh đây nên giảng viên dễ nhầm hai chỗ.
 */
export default function ThemePicker({
  value,
  onChange,
  motif,
  language,
  imageFrame,
  brand,
}: {
  value: string;
  onChange: (id: SlideThemeId) => void;
  /** Hoa văn trang trí của cả bài, chọn ngay dưới các giao diện (cùng là "trang phục" của bài giảng). */
  motif?: { value: string | null; auto: SlideMotifId; onChange: (v: string | null) => void };
  /** Ngôn ngữ của slide (docs/tieu-chi/ngon-ngu-slide.md, L5); null = chọn "Tự nhận lại theo nội dung". */
  language?: { value: string | null; onChange: (v: string | null) => void };
  /** Khung hình của các ô hình trong slide Chữ và hình (docs/tieu-chi/chu-va-hinh-kieu-khung.md, K10); null = tự động. */
  imageFrame?: { value: string | null; auto: ImageFrame; onChange: (v: ImageFrame | null) => void };
  /** Logo và màu thương hiệu đang áp cho bài; "Chỉnh" mở hộp thương hiệu. */
  brand?: { color: string | null; logoUrl: string | null; title: string; detail: string; onEdit: () => void };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SLIDE_THEMES.find((t) => t.id === value) ?? SLIDE_THEMES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-muted transition hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))] ${
          open ? "bg-[rgb(var(--surface-muted))] text-[rgb(var(--text))]" : ""
        }`}
        title={`Giao diện: ${current.label}. Màu nền, hoa văn, logo và màu thương hiệu.`}
      >
        <span className="flex" aria-hidden>
          <span className="h-4 w-4 rounded-full border-2 border-[rgb(var(--surface))] ring-1 ring-[rgb(var(--border))]" style={{ background: current.swatch }} />
          {brand?.color && (
            <span className="-ml-1.5 h-4 w-4 rounded-full border-2 border-[rgb(var(--surface))] ring-1 ring-[rgb(var(--border))]" style={{ background: brand.color }} />
          )}
        </span>
        <span className="hidden sm:inline">Giao diện</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Chọn giao diện slide"
          className="absolute right-0 top-full z-50 mt-2 max-h-[min(75vh,620px)] w-[min(360px,92vw)] space-y-4 overflow-y-auto rounded-2xl border border-token bg-[rgb(var(--surface))] p-3 shadow-2xl"
        >
          {SLIDE_THEME_GROUPS.map((g) => (
            <div key={g.label} role="radiogroup" aria-label={g.label}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-faint">{g.label}</p>
              <p className="mb-1.5 text-xs text-muted">{g.hint}</p>
              <div className="grid grid-cols-4 gap-2">
                {SLIDE_THEMES.filter((t) => t.group === g.id).map((t) => {
                  const on = t.id === current.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        onChange(t.id);
                        setOpen(false);
                      }}
                      className={`grid gap-1 rounded-xl border p-1.5 text-center text-xs font-medium transition ${
                        on ? "border-brand-600 ring-1 ring-brand-600" : "border-token hover:border-brand-600"
                      }`}
                    >
                      <span className="block h-10 w-full rounded-lg border border-black/10" style={{ background: t.swatch }} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {motif && (
            <div className="border-t border-token pt-3">
              <DeckMotifPicker value={motif.value} autoMotif={motif.auto} themeId={current.id} onChange={motif.onChange} />
            </div>
          )}
          {language && (
            <div className="border-t border-token pt-3">
              <label htmlFor="deck-lang" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-faint">
                Ngôn ngữ của slide
              </label>
              <select
                id="deck-lang"
                value={language.value ?? ""}
                onChange={(e) => language.onChange(e.target.value || null)}
                className="input w-full text-sm"
              >
                {!language.value && <option value="">Chưa xác định</option>}
                {DECK_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
                {language.value && <option value="">Tự nhận lại theo nội dung</option>}
              </select>
              <p className="mt-1.5 text-xs text-muted">
                AI viết slide mới và các chữ tự thêm trên slide theo ngôn ngữ này. Đổi ngôn ngữ không dịch các slide đã có.
              </p>
          {imageFrame && (
            <div className="border-t border-token pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Khung hình</p>
              <p className="mb-1.5 text-xs text-muted">Hình dạng ô hình ở các slide Chữ và hình của cả bài. Tự động theo hoa văn của bài.</p>
              <div role="radiogroup" aria-label="Khung hình" className="grid grid-cols-4 gap-1.5">
                {([null, ...IMAGE_FRAMES] as (ImageFrame | null)[]).map((f) => {
                  const on = (imageFrame.value ?? null) === f;
                  const shape = f ?? imageFrame.auto;
                  return (
                    <button
                      key={f ?? "auto"}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => imageFrame.onChange(f)}
                      className={`grid justify-items-center gap-1 rounded-lg border px-1 py-1.5 text-[11px] font-medium ${on ? "border-brand-600 ring-1 ring-brand-600" : "border-token hover:border-brand-600"}`}
                    >
                      <span aria-hidden className="block h-7 w-7" style={{ background: "linear-gradient(145deg, #bfe08a, #f2c6dc)", ...FRAME_SWATCH[shape] }} />
                      <span className="leading-tight">{f ? IMAGE_FRAME_LABEL[f] : "Tự động"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {brand && (
            <div className="border-t border-token pt-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-faint">Logo và màu thương hiệu</p>
              <div className="flex items-center gap-3 rounded-xl border border-token p-2.5">
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={apiUrl(brand.logoUrl)} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-token object-contain p-0.5" />
                ) : (
                  <span
                    className="h-9 w-9 shrink-0 rounded-lg border border-token"
                    style={{ background: brand.color ?? "rgb(var(--surface-muted))" }}
                    aria-hidden
                  />
                )}
                <span className="min-w-0 flex-1 text-sm">
                  <b className="block truncate font-semibold">{brand.title}</b>
                  <span className="block text-xs text-muted">{brand.detail}</span>
                </span>
                <button
                  type="button"
                  className="btn-secondary shrink-0 px-3 py-1 text-[13px]"
                  onClick={() => {
                    setOpen(false);
                    brand.onEdit();
                  }}
                >
                  Chỉnh
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
