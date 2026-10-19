"use client";

import { COVER_STYLES, COVER_STYLE_LABELS, DEFAULT_COVER_STYLE, resolveCoverStyle } from "@/lib/limioLiveSlides";
import { LayoutSlideView } from "../SlideLayouts";
import { slideBgFor } from "../slideThemes";

/**
 * Chọn kiểu bìa trong khung sửa slide bìa. Mỗi ô là chính slide bìa đang soạn vẽ theo kiểu đó, trên đúng giao diện
 * và hoa văn của bài, nên giảng viên thấy ngay kết quả thay vì đọc tên kiểu. Không bắt buộc: chưa chọn là Khối màu.
 */
export function CoverStylePicker({
  config,
  themeId,
  slideId,
  onChange,
}: {
  config: Record<string, unknown>;
  themeId?: string | null;
  slideId?: string;
  onChange: (style: string) => void;
}) {
  const current = resolveCoverStyle(config);
  return (
    <div>
      <p className="mb-0.5 text-xs font-semibold text-muted">Kiểu bìa</p>
      <p className="mb-1.5 text-xs text-muted">
        Mặc định là {COVER_STYLE_LABELS[DEFAULT_COVER_STYLE]}. Hoa văn trên bìa là hoa văn của cả bài giảng.
      </p>
      <div role="radiogroup" aria-label="Kiểu bìa" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {COVER_STYLES.map((s) => {
          const on = s === current;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(s)}
              className={`grid gap-1 rounded-xl border p-1 text-center text-xs font-medium transition ${
                on ? "border-brand-600 ring-1 ring-brand-600" : "border-token hover:border-brand-600"
              }`}
            >
              <span
                aria-hidden="true"
                className="relative block aspect-video w-full overflow-hidden rounded-lg border border-black/10"
                style={{ background: slideBgFor(themeId, true) }}
              >
                <span className="absolute inset-0 flex">
                  <LayoutSlideView config={{ ...config, coverStyle: s }} themeId={themeId} slideId={slideId} />
                </span>
              </span>
              <span>{COVER_STYLE_LABELS[s]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
