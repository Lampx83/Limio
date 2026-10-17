"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import {
  OUTLINE_LAYOUTS,
  OUTLINE_LIMITS,
  type OutlineKind,
  type OutlineLayout,
  type OutlineSlide,
} from "@/lib/limioLiveOutline";
import {
  OUTLINE_KIND_HINT,
  OUTLINE_KIND_LABEL,
  OUTLINE_KIND_ORDER,
  OUTLINE_KIND_TITLE,
  OUTLINE_KIND_USE,
  OUTLINE_LAYOUT_UI,
  OUTLINE_POINT_LABELS,
  SPLIT_POINT_LAYOUTS,
  glyphKey,
  joinPoint,
  kindGroupOf,
  pointStatus,
  splitPoint,
} from "@/lib/limioLiveOutlineUi";
import OutlineGlyph from "./OutlineGlyph";
import OutlinePreview from "./OutlinePreview";

interface Props {
  slide: OutlineSlide;
  index: number;
  total: number;
  onPatch: (p: Partial<OutlineSlide>) => void;
  onKind: (k: OutlineKind) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
  onGoto: (d: -1 | 1) => void;
  onClose: () => void;
}

const tile = (on: boolean) =>
  `grid justify-items-center gap-0.5 rounded-[10px] border px-1 pb-1 pt-1.5 text-[12.5px] leading-tight transition-colors ${
    on
      ? "border-brand-600 bg-brand-soft font-bold text-[rgb(var(--text))] ring-1 ring-brand-600"
      : "border-token bg-[rgb(var(--surface))] text-muted hover:bg-[rgb(var(--surface-muted))]"
  }`;

/** Cửa sổ sửa một slide: bản xem trước ở đầu, loại slide và bố cục thu gọn, nội dung bên dưới (hoặc bên phải trên màn rộng). */
export default function SlideDialog({ slide: s, index, total, onPatch, onKind, onRemove, onMove, onGoto, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [openKind, setOpenKind] = useState(false);
  const [openLay, setOpenLay] = useState(false);
  // Ô nhập tự cao theo chữ chỉ đo được khi hộp thoại đã mở (lúc đóng chiều cao đo ra 0).
  const [shown, setShown] = useState(false);
  const isContent = s.kind === "content";
  const layout: OutlineLayout = s.layout ?? "image";
  const ui = OUTLINE_LAYOUT_UI[layout];
  const status = isContent ? pointStatus(layout, s.points) : null;
  const split = isContent && SPLIT_POINT_LAYOUTS.has(layout);
  const labels = OUTLINE_POINT_LABELS[layout];

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    setShown(true);
  }, []);

  // Sang slide khác: các lưới chọn thu lại, nội dung cuộn về đầu.
  useEffect(() => {
    setOpenKind(false);
    setOpenLay(false);
    bodyRef.current?.scrollTo({ top: 0 });
  }, [s.id]);

  const setPoint = (k: number, v: string) => onPatch({ points: s.points.map((x, j) => (j === k ? v : x)) });

  return (
    <dialog
      ref={ref}
      aria-labelledby="outline-dlg-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto max-h-[94vh] w-[min(1040px,96vw)] max-w-none overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] p-0 text-[rgb(var(--text))] shadow-2xl backdrop:bg-black/50 max-sm:m-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:rounded-none max-sm:border-0"
    >
      <div className="flex max-h-[94vh] flex-col max-sm:h-full max-sm:max-h-none">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-token px-4 py-3">
          <button type="button" className="btn-secondary h-9 w-9 !p-0" disabled={index === 0} onClick={() => onGoto(-1)} aria-label="Slide trước">
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="btn-secondary h-9 w-9 !p-0" disabled={index === total - 1} onClick={() => onGoto(1)} aria-label="Slide sau">
            <ChevronRight size={18} />
          </button>
          <h2 id="outline-dlg-title" className="min-w-[7rem] flex-1 text-lg font-bold">
            Slide {index + 1} / {total}
          </h2>
          <button type="button" className="btn-secondary h-9 w-9 !p-0" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Đưa lên">
            ↑
          </button>
          <button type="button" className="btn-secondary h-9 w-9 !p-0" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Đưa xuống">
            ↓
          </button>
          <button
            type="button"
            className="btn-secondary h-9 gap-1.5 !px-3 text-red-700"
            onClick={() => {
              onRemove();
              ref.current?.close();
            }}
            disabled={total <= 1}
          >
            <Trash2 size={15} /> Xoá slide
          </button>
          <button type="button" className="btn-primary h-9" onClick={() => ref.current?.close()}>
            Xong
          </button>
        </div>

        <div ref={bodyRef} className="grid min-h-0 flex-1 gap-5 overflow-auto p-4 sm:p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
          {/* Bản xem trước: đầu tiên; màn rộng thì cột trái và dính khi cuộn. */}
          <div className="mx-auto w-full max-w-[560px] space-y-2 lg:sticky lg:top-0 lg:max-w-none">
            <span className="block text-sm font-semibold text-muted">Bản xem trước bố cục</span>
            <OutlinePreview slide={s} />
            <p className="text-[13px] text-faint">
              Chỉ để hình dung cách chữ sắp xếp. Màu sắc, phông chữ và hình minh hoạ do bước tạo slide quyết định.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
              <PickerButton cap="Loại slide" glyph={glyphKey(s)} label={OUTLINE_KIND_LABEL[s.kind]} open={openKind} onClick={() => { setOpenKind((v) => !v); setOpenLay(false); }} />
              {isContent && (
                <PickerButton cap="Bố cục" glyph={layout} label={ui.label} open={openLay} onClick={() => { setOpenLay((v) => !v); setOpenKind(false); }} />
              )}
            </div>

            {openKind && (
              <div role="group" aria-label="Loại slide" className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(88px,1fr))]">
                {OUTLINE_KIND_ORDER.map((k) => (
                  <button
                    key={k}
                    type="button"
                    title={kindGroupOf(k)}
                    aria-pressed={s.kind === k}
                    className={tile(s.kind === k)}
                    onClick={() => {
                      onKind(k);
                      setOpenKind(false);
                    }}
                  >
                    <OutlineGlyph k={k} className="h-[30px] w-full" />
                    <span>{OUTLINE_KIND_LABEL[k]}</span>
                  </button>
                ))}
              </div>
            )}
            {openLay && isContent && (
              <div className="space-y-2">
                <p className="text-[13px] text-muted">{ui.hint}</p>
                <div role="group" aria-label="Bố cục" className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(88px,1fr))]">
                  {OUTLINE_LAYOUTS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={layout === l}
                      className={tile(layout === l)}
                      onClick={() => {
                        onPatch({ layout: l });
                        setOpenLay(false);
                      }}
                    >
                      <OutlineGlyph k={l} className="h-[30px] w-full" />
                      <span>{OUTLINE_LAYOUT_UI[l].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="block">
              <span className="mb-1 flex items-baseline justify-between text-sm font-semibold text-muted">
                <span>{OUTLINE_KIND_TITLE[s.kind]}</span>
                <span className={`text-xs font-normal ${s.title.length >= OUTLINE_LIMITS.slideTitle ? "text-red-700" : "text-faint"}`}>
                  {s.title.length}/{OUTLINE_LIMITS.slideTitle}
                </span>
              </span>
              <input
                className="input w-full"
                value={s.title}
                maxLength={OUTLINE_LIMITS.slideTitle}
                onChange={(e) => onPatch({ title: e.target.value })}
                autoFocus={false}
              />
            </label>

            {isContent ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between text-sm font-semibold text-muted">
                  <span>Ý chính</span>
                  {status && (
                    <span className={`text-xs font-normal ${status.ok ? "text-faint" : "text-amber-800"}`}>
                      Bố cục này nên có {status.need}
                      {status.ok ? "" : ` (hiện có ${status.n})`}
                    </span>
                  )}
                </div>
                {s.points.map((p, k) => {
                  const lab = labels[k] ?? `Ý ${k + 1}`;
                  const [head, body] = split ? splitPoint(p) : ["", p];
                  return (
                    <div key={k} className="flex items-start gap-2">
                      <span className="mt-6 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[rgb(var(--surface-muted))] text-xs font-bold text-muted">{k + 1}</span>
                      <div className="grid min-w-0 flex-1 gap-1">
                        <span className="text-xs text-faint">{lab}</span>
                        {split && (
                          <input
                            className="input w-full text-sm"
                            placeholder="Tiêu đề ngắn"
                            maxLength={60}
                            value={head}
                            aria-label={`${lab}, tiêu đề ngắn`}
                            onChange={(e) => setPoint(k, joinPoint(e.target.value, body))}
                          />
                        )}
                        <AutoTextarea
                          shown={shown}
                          className="input w-full text-sm"
                          value={split ? body : p}
                          placeholder={split ? "Một câu giải thích đầy đủ" : undefined}
                          maxLength={OUTLINE_LIMITS.point}
                          aria-label={split ? `${lab}, câu giải thích` : lab}
                          onChange={(v) => setPoint(k, split ? joinPoint(head, v) : v)}
                        />
                      </div>
                      <button
                        type="button"
                        className="mt-6 text-faint hover:text-red-600"
                        aria-label="Xoá ý này"
                        onClick={() => onPatch({ points: s.points.filter((_, j) => j !== k) })}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
                {s.points.length < OUTLINE_LIMITS.points && (
                  <button type="button" className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline" onClick={() => onPatch({ points: [...s.points, ""] })}>
                    <Plus size={14} /> Thêm ý
                  </button>
                )}
              </div>
            ) : (
              <div className="banner-info space-y-1 text-sm">
                <p>{OUTLINE_KIND_HINT[s.kind as Exclude<OutlineKind, "content">]}</p>
                {OUTLINE_KIND_USE[s.kind] && <p className="font-semibold">{OUTLINE_KIND_USE[s.kind]}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}

function PickerButton({ cap, glyph, label, open, onClick }: { cap: string; glyph: OutlineLayout | OutlineKind; label: string; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left transition-colors ${
        open ? "border-brand-600 bg-brand-soft ring-1 ring-brand-600" : "border-token bg-[rgb(var(--surface-muted))] hover:border-brand-600"
      }`}
    >
      <OutlineGlyph k={glyph} className="h-7 w-[42px] shrink-0 text-brand-700" />
      <span className="grid min-w-0 flex-1 leading-tight">
        <small className="text-xs font-semibold text-faint">{cap}</small>
        <b className="truncate text-[15px]">{label}</b>
      </span>
      <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
    </button>
  );
}

function AutoTextarea({ value, onChange, className, shown, ...rest }: { shown: boolean; value: string; onChange: (v: string) => void; className?: string; placeholder?: string; maxLength?: number; "aria-label"?: string }) {
  const r = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = r.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, shown]);
  return <textarea ref={r} rows={1} className={className} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
}
