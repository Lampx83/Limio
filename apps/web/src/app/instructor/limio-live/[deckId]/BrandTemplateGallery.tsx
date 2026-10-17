"use client";

import { Check } from "lucide-react";
import { applyBrandTemplate, brandFrameBackground, brandTemplates, type BrandConfig } from "@/lib/limioLiveBrand";
import { LayoutSlideView } from "../SlideLayouts";
import { LiveBrandProvider } from "../liveBrandContext";
import { slideBgFor } from "../slideThemes";
import { SAMPLE_CONFIG } from "./BrandEditor";

/**
 * Các mẫu phối màu tự sinh từ bảng màu của trường (brandTemplates), mỗi mẫu một ảnh xem thử trên slide mẫu thật.
 * Giảng viên chọn mẫu cho bài; admin trường chọn mẫu mặc định.
 */
export default function BrandTemplateGallery({
  orgBrand,
  themeId,
  selectedId,
  onSelect,
}: {
  /** Thương hiệu của trường (có bảng màu), gồm logo của trường. */
  orgBrand: BrandConfig;
  themeId: string;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const templates = brandTemplates(orgBrand.colors, orgBrand.bg);
  if (templates.length === 0) return null;
  return (
    <div role="radiogroup" aria-label="Mẫu thương hiệu" className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
      {templates.map((t) => {
        const b = applyBrandTemplate(orgBrand, t.id);
        const on = t.id === selectedId;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(t.id)}
            className={`grid gap-2 rounded-2xl border p-2 text-left transition ${on ? "border-brand-600 ring-2 ring-brand-600" : "border-token hover:border-brand-600"}`}
          >
            <LiveBrandProvider brand={b}>
              <span
                className="pointer-events-none relative flex aspect-video w-full overflow-hidden rounded-lg border border-black/10"
                style={{ background: brandFrameBackground(b, true) ?? slideBgFor(themeId, true) }}
              >
                <LayoutSlideView config={SAMPLE_CONFIG.cards} themeId={themeId} />
              </span>
            </LiveBrandProvider>
            <span className="flex items-start gap-1.5 px-1 pb-0.5">
              <span className="grid min-w-0 flex-1 leading-tight">
                <b className="text-sm">{t.label}</b>
                <small className="text-xs text-muted">{t.hint}</small>
              </span>
              {on && <Check size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
