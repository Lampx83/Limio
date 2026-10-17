"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SLIDE_THEMES, SLIDE_THEME_GROUPS, type SlideThemeId } from "../slideThemes";

/** Chọn giao diện màu của cả bài giảng: một nút gọn, bấm mở bảng các giao diện gom theo nhóm (Cơ bản, Màu pastel, Nền tối). */
export default function ThemePicker({ value, onChange }: { value: string; onChange: (id: SlideThemeId) => void }) {
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
        className="flex h-8 items-center gap-2 rounded-lg border border-token px-2 text-xs font-semibold text-muted transition hover:bg-[rgb(var(--surface-muted))]"
        title="Giao diện màu của bài giảng"
      >
        <span className="h-5 w-5 rounded-full border border-token" style={{ background: current.swatch }} aria-hidden />
        <span className="hidden sm:inline">Giao diện: {current.label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Chọn giao diện slide"
          className="absolute right-0 top-full z-50 mt-2 max-h-[min(70vh,560px)] w-[min(340px,92vw)] space-y-4 overflow-y-auto rounded-2xl border border-token bg-[rgb(var(--surface))] p-3 shadow-2xl"
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
        </div>
      )}
    </div>
  );
}
