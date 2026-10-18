"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import { SLIDE_ILLUSTRATION_GROUPS, SLIDE_ILLUSTRATION_LABELS, isSlideIllustrationId } from "@feedbackme/shared-types";
import { MOTIF_LABELS, SLIDE_MOTIFS, isMotifId, slideArtLabel, type SlideArtId, type SlideMotifId } from "@/lib/limioLiveMotifs";
import { motifSvgBody } from "@/lib/limioLiveMotifArt";
import { brandCssVars, brandEffectiveThemeId } from "@/lib/limioLiveBrand";
import { useLiveBrand } from "../liveBrandContext";
import { isDarkTheme, layoutThemeClass, slideBgFor } from "../slideThemes";

// Chọn hoa văn trang trí (limioLiveMotifs): cho cả bài trong bảng Giao diện, và riêng một slide trong khung sửa.
// Slide Chữ và hình chưa có ảnh còn chọn được hình minh hoạ theo chủ đề (phần riêng đặt trên hoa văn, chia năm nhóm).
// Mỗi ô là hình thật của hoa văn trên đúng giao diện (và màu thương hiệu) của bài, không phải tên suông.

/** Ô xem trước một hoa văn hoặc hình minh hoạ trên giao diện của bài; null = ô trống (không dùng). */
export function MotifSwatch({ motif, themeId, className = "" }: { motif: SlideArtId | null; themeId?: string | null; className?: string }) {
  const brand = useLiveBrand();
  const eff = brandEffectiveThemeId(brand, themeId);
  const vars = brandCssVars(brand, isDarkTheme(themeId)) as CSSProperties;
  const uid = `sw${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const html = useMemo(
    () =>
      motif
        ? `<svg viewBox="0 0 240 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" style="display:block;width:100%;height:100%">${motifSvgBody(motif, 240, 240, uid)}</svg>`
        : "",
    [motif, uid],
  );
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden rounded-lg border border-black/10 ${layoutThemeClass(eff)} ${className}`}
      style={{ background: slideBgFor(themeId, true), ...vars }}
    >
      <span className="absolute inset-0" style={{ background: "linear-gradient(145deg, var(--ssoft), var(--ssoft2))" }} />
      {motif ? (
        <span className="absolute inset-0" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span className="absolute inset-0" style={{ background: "repeating-linear-gradient(135deg, transparent 0 7px, rgba(120,120,120,.18) 7px 8px)" }} />
      )}
    </span>
  );
}

type Option = { value: string | null; label: string; motif: SlideArtId | null };

function Grid({ options, value, themeId, onPick, label }: { options: Option[]; value: string | null; themeId?: string | null; onPick: (v: string | null) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(76px,1fr))]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value ?? "auto"}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(o.value)}
            className={`grid gap-1 rounded-xl border p-1 text-center text-[11px] font-medium leading-tight transition ${
              on ? "border-brand-600 ring-1 ring-brand-600" : "border-token hover:border-brand-600"
            }`}
          >
            <MotifSwatch motif={o.motif} themeId={themeId} className="aspect-square w-full" />
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Hoa văn của cả bài: Tự động (mặc định, hệ thống chọn theo mã bài) / Chọn một hoa văn / Không dùng.
 * `value`: null = tự động, "none", hoặc mã hoa văn; `autoMotif` là hoa văn mà chế độ tự động đang cho ra.
 */
export function DeckMotifPicker({
  value,
  autoMotif,
  themeId,
  onChange,
}: {
  value: string | null;
  autoMotif: SlideMotifId;
  themeId?: string | null;
  onChange: (v: string | null) => void;
}) {
  const mode = value === "none" ? "none" : isMotifId(value) ? "pick" : "auto";
  const [picking, setPicking] = useState(mode === "pick");
  const shown = picking || mode === "pick" ? "pick" : mode;
  const seg = (m: "auto" | "pick" | "none", text: string) => (
    <button
      type="button"
      aria-pressed={shown === m}
      onClick={() => {
        setPicking(m === "pick");
        if (m === "auto") onChange(null);
        if (m === "none") onChange("none");
      }}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
        shown === m ? "bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-sm" : "text-muted hover:text-[rgb(var(--text))]"
      }`}
    >
      {text}
    </button>
  );
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Hoa văn trang trí</p>
      <p className="mb-1.5 text-xs text-muted">
        Hình trừu tượng ở chỗ trống của bìa, bìa phần, trích dẫn và ô hình chưa có ảnh. Chữ luôn đủ rõ.
      </p>
      <div className="flex items-center gap-3">
        <div className="inline-flex flex-wrap gap-0.5 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-0.5" role="group" aria-label="Hoa văn của cả bài">
          {seg("auto", "Tự động")}
          {seg("pick", "Chọn một")}
          {seg("none", "Không dùng")}
        </div>
      </div>
      {shown === "auto" && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <MotifSwatch motif={autoMotif} themeId={themeId} className="h-10 w-10 shrink-0" />
          <span>
            Bài này đang dùng <b className="text-[rgb(var(--text))]">{MOTIF_LABELS[autoMotif]}</b>; ô hình của từng slide lần lượt nhận các hoa văn khác.
          </span>
        </div>
      )}
      {shown === "pick" && (
        <div className="mt-2">
          <Grid
            label="Hoa văn chủ đạo"
            options={SLIDE_MOTIFS.map((m) => ({ value: m, label: MOTIF_LABELS[m], motif: m }))}
            value={isMotifId(value) ? value : null}
            themeId={themeId}
            onPick={(v) => onChange(v)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Hoa văn của một slide trong khung sửa: dòng gọn (hình đang dùng + nút Đổi), bấm mới mở lưới.
 * `value`: undefined = theo bài giảng, "none", mã hoa văn hoặc mã hình minh hoạ; `effective` là thứ slide đang
 * hiển thị, `inherited` là hoa văn slide nhận nếu theo bài giảng. `illustrations`: slide là Chữ và hình chưa có
 * ảnh, nên lưới có thêm nhóm "Hình minh hoạ" ở trên cùng. Hình do AI chọn hiện như giảng viên tự chọn.
 */
export function SlideMotifField({
  value,
  effective,
  inherited,
  illustrations = false,
  themeId,
  onChange,
}: {
  value: string | undefined;
  effective: SlideArtId | null;
  inherited: SlideArtId | null;
  illustrations?: boolean;
  themeId?: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // Hình minh hoạ chỉ có hiệu lực ở ô hình; ở bố cục khác coi như slide theo bài giảng (mã vẫn được giữ).
  const own: SlideArtId | null = isMotifId(value) || (illustrations && isSlideIllustrationId(value)) ? value : null;
  const status =
    value === "none" ? "Không dùng cho slide này" : own ? `${slideArtLabel(own)} (riêng slide này)` : inherited ? `Theo bài giảng: ${slideArtLabel(inherited)}` : "Theo bài giảng (bài đang tắt hoa văn)";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-xl border border-token p-2">
        <MotifSwatch motif={effective} themeId={themeId} className="h-11 w-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted">{illustrations ? "Hình ở ô hình" : "Hoa văn"}</p>
          <p className="truncate text-sm">{status}</p>
        </div>
        <button type="button" className="btn-secondary text-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Xong" : "Đổi"}
        </button>
      </div>
      {open && illustrations && (
        <>
          <p className="text-sm font-semibold">Hình minh hoạ</p>
          {SLIDE_ILLUSTRATION_GROUPS.map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="text-xs font-semibold text-muted">{g.label}</p>
              <Grid
                label={`Hình minh hoạ: ${g.label}`}
                options={g.ids.map((m) => ({ value: m as string | null, label: SLIDE_ILLUSTRATION_LABELS[m], motif: m }))}
                value={own && isSlideIllustrationId(own) ? own : null}
                themeId={themeId}
                onPick={onChange}
              />
            </div>
          ))}
          <p className="border-t border-token pt-3 text-sm font-semibold">Hoa văn</p>
        </>
      )}
      {open && (
        <Grid
          label="Hoa văn của slide này"
          options={[
            { value: null, label: "Theo bài giảng", motif: inherited },
            ...SLIDE_MOTIFS.map((m) => ({ value: m as string | null, label: MOTIF_LABELS[m], motif: m })),
            { value: "none", label: "Không dùng", motif: null },
          ]}
          value={value === "none" ? "none" : own && isSlideIllustrationId(own) ? "" : own}
          themeId={themeId}
          onPick={onChange}
        />
      )}
    </div>
  );
}
