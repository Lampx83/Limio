"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import {
  DEFAULT_LESSON_LOOK,
  LESSON_FONT_HINTS,
  LESSON_FONT_KEYS,
  LESSON_FONT_LABELS,
  LESSON_PALETTE_HINTS,
  LESSON_PALETTE_KEYS,
  LESSON_PALETTE_LABELS,
  type LessonFontKey,
  type LessonLook,
  type LessonPaletteKey,
} from "@feedbackme/shared-types";
import { LESSON_PALETTES } from "@/lib/lessonLook";
import { LESSON_FONT_VARIABLES } from "./lessonFonts";

const FONT_FAMILY: Record<LessonFontKey, { head: string; body: string }> = {
  modern: { head: "var(--lk-font-vietnam)", body: "var(--lk-font-vietnam)" },
  readable: { head: "var(--lk-font-lexend)", body: "var(--lk-font-lexend)" },
  academic: { head: "var(--lk-font-serif)", body: "var(--lk-font-vietnam)" },
};

/**
 * Nút "Giao diện" trong thanh công cụ của trình soạn bài: một dòng, hiện bảng
 * màu + kiểu chữ đang dùng. Bấm mở bảng chọn có ô xem trước thu nhỏ của từng
 * bảng màu (vẽ bằng đúng màu và font thật), chọn là áp ngay vào bài bên dưới.
 * `value = null`: bài cũ chưa chọn, vẫn hiển thị như trước.
 */
export default function LessonLookMenu({
  value,
  onChange,
}: {
  value: LessonLook | null;
  onChange: (look: LessonLook) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = value ?? DEFAULT_LESSON_LOOK;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pal = LESSON_PALETTES[current.palette];
  const swatch = pal.cycle
    ? `linear-gradient(135deg, ${pal.cycle.light.map(([a]) => a).join(", ")})`
    : pal.light.accent;

  return (
    // Không "relative": bảng chọn trải theo cả thanh công cụ (xem LessonInsertMenu).
    <div ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Bảng màu và kiểu chữ của cả bài"
        className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded border border-token bg-[rgb(var(--surface))] px-2 text-xs font-medium text-muted hover:border-brand-300"
      >
        {value ? (
          <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ background: swatch }} aria-hidden />
        ) : (
          <Palette className="h-3.5 w-3.5" aria-hidden />
        )}
        {value ? (
          <span>
            {LESSON_PALETTE_LABELS[value.palette]}
            <span className="hidden text-faint sm:inline"> · {LESSON_FONT_LABELS[value.font]}</span>
          </span>
        ) : (
          <span>Giao diện</span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Giao diện của bài"
          className={`${LESSON_FONT_VARIABLES} absolute left-1 right-1 top-full z-20 mt-1 max-h-[75vh] max-w-[34rem] overflow-y-auto rounded-xl border border-token bg-[rgb(var(--surface))] p-3 shadow-xl`}
        >
          <p className="text-meta mb-2 font-semibold">Bảng màu</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Bảng màu">
            {LESSON_PALETTE_KEYS.map((k) => (
              <PaletteTile
                key={k}
                paletteKey={k}
                font={current.font}
                selected={value?.palette === k}
                onPick={() => onChange({ ...current, palette: k })}
              />
            ))}
          </div>
          <p className="text-meta mb-2 mt-3 font-semibold">Kiểu chữ</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Kiểu chữ">
            {LESSON_FONT_KEYS.map((k) => {
              const on = value?.font === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={LESSON_FONT_HINTS[k]}
                  onClick={() => onChange({ ...current, font: k })}
                  className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                    on ? "border-brand-600 bg-brand-soft" : "border-token hover:border-brand-300"
                  }`}
                >
                  <span className="block text-lg leading-tight" style={{ fontFamily: FONT_FAMILY[k].head }}>
                    Aa Ăâ
                  </span>
                  <span className="text-caption text-muted">{LESSON_FONT_LABELS[k]}</span>
                </button>
              );
            })}
          </div>
          <p className="text-caption mt-3 text-faint">
            Áp cho cả bài, đổi lúc nào cũng được. Không đổi chữ, không dùng AI.
          </p>
        </div>
      )}
    </div>
  );
}

/** Ô xem trước thu nhỏ: nền, tiêu đề mục có gạch nhấn, một hộp, hai dòng chữ. */
function PaletteTile({
  paletteKey,
  font,
  selected,
  onPick,
}: {
  paletteKey: LessonPaletteKey;
  font: LessonFontKey;
  selected: boolean;
  onPick: () => void;
}) {
  const p = LESSON_PALETTES[paletteKey];
  const c = p.light;
  const accents = p.cycle ? p.cycle.light.map(([a]) => a) : [c.accent];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title={LESSON_PALETTE_HINTS[paletteKey]}
      onClick={onPick}
      className={`group relative overflow-hidden rounded-lg border text-left transition-all ${
        selected ? "border-brand-600 ring-2 ring-brand-600/30" : "border-token hover:-translate-y-0.5 hover:shadow"
      }`}
    >
      <div className="space-y-1 p-2" style={{ background: c.bg, color: c.text }}>
        <div
          className="text-[11px] font-bold leading-tight"
          style={{ fontFamily: FONT_FAMILY[font].head, borderBottom: `2px solid ${accents[0]}`, paddingBottom: 2 }}
        >
          Tiêu đề mục
        </div>
        <div className="flex gap-1">
          {accents.slice(0, 3).map((a, i) => (
            <span
              key={i}
              className="h-3 flex-1 rounded-sm"
              style={{ background: p.cycle ? p.cycle.light[i]![1] : c.soft, borderTop: `2px solid ${a}` }}
            />
          ))}
        </div>
        <div className="h-1 w-4/5 rounded-full" style={{ background: c.muted, opacity: 0.35 }} />
        <div className="h-1 w-3/5 rounded-full" style={{ background: c.muted, opacity: 0.35 }} />
      </div>
      <div className="flex items-center justify-between border-t border-token bg-[rgb(var(--surface))] px-2 py-1">
        <span className="text-xs font-medium">{LESSON_PALETTE_LABELS[paletteKey]}</span>
        {selected && <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden />}
      </div>
    </button>
  );
}
