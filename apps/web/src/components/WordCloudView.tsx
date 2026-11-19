"use client";

import {
  centerOut,
  normalizeWordCloudView,
  rankWords,
  scaleBetween,
  WORD_CLOUD_VIEWS,
  WORD_CLOUD_VIEW_HINT,
  WORD_CLOUD_VIEW_LABEL,
  type WordCloudView,
} from "@/lib/wordCloudView";
import { WORD_GRADIENTS, WORD_SOLID_BG, WORD_TEXT_COLORS } from "@/lib/wordCloudColors";

// Một bộ vẽ Word Cloud dùng chung cho phiên độc lập và slide Limio-Live.
// `scale` = "panel" (khung nhỏ trong trang) | "full" (toàn màn hình của công cụ lớp học)
// | "stage" (slide trình chiếu, chữ phải đọc được từ cuối phòng).

type Scale = "panel" | "full" | "stage";

// rem tối thiểu/tối đa theo kiểu và khổ.
const FONT: Record<Scale, { chips: [number, number]; cloud: [number, number] }> = {
  panel: { chips: [0.875, 2.5], cloud: [1, 3.25] },
  full: { chips: [1.1, 3.5], cloud: [1.4, 5] },
  stage: { chips: [2.4, 6], cloud: [2.6, 7.5] },
};
// px đường kính bong bóng nhỏ nhất / lớn nhất.
const BUBBLE: Record<Scale, [number, number]> = { panel: [64, 150], full: [96, 240], stage: [130, 340] };

const LIMIT: Record<WordCloudView, number> = { chips: 50, cloud: 60, bubbles: 30, bars: 8 };

export default function WordCloudView({
  view,
  frequency,
  scale = "panel",
  emptyText = "Chưa có gửi nào...",
}: {
  view: WordCloudView | string | null | undefined;
  frequency: Record<string, number>;
  scale?: Scale;
  emptyText?: string;
}) {
  const v = normalizeWordCloudView(view);
  const ranked = rankWords(frequency, LIMIT[v]);
  const stage = scale !== "panel"; // "full" và "stage" đều là khổ lớn; khác nhau ở bảng cỡ chữ phía trên

  if (ranked.length === 0) {
    return <p className={stage ? "text-2xl text-faint" : "text-sm text-muted"}>{emptyText}</p>;
  }

  if (v === "bars") {
    return (
      <ol key="bars" className={`w-full ${stage ? "max-w-5xl space-y-2.5" : "max-w-xl space-y-1.5"}`}>
        {ranked.map((w, i) => (
          <li key={w.word} className="flex items-center gap-3">
            <span className={`shrink-0 text-right tabular-nums text-muted ${stage ? "w-8 text-xl" : "w-5 text-xs"}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div
                className={`flex items-center rounded-md ${WORD_SOLID_BG[i % WORD_SOLID_BG.length]} text-white transition-[width] duration-500 ${
                  stage ? "min-h-[2.75rem] px-4" : "min-h-7 px-2"
                }`}
                // Thanh ngắn nhất vẫn đủ chỗ cho chữ: nền 22% + phần còn lại tỉ lệ.
                style={{ width: `${22 + w.ratio * 78}%` }}
              >
                <span className={`truncate font-semibold ${stage ? "text-2xl" : "text-sm"}`}>{w.word}</span>
              </div>
            </div>
            <span className={`shrink-0 font-bold tabular-nums ${stage ? "w-14 text-2xl" : "w-8 text-sm"}`}>{w.count}</span>
          </li>
        ))}
      </ol>
    );
  }

  if (v === "bubbles") {
    const [dMin, dMax] = BUBBLE[scale];
    return (
      <div key="bubbles" className={`flex flex-wrap items-center justify-center ${stage ? "gap-5" : "gap-2.5"}`}>
        {centerOut(ranked.map((w, i) => ({ ...w, i }))).map((w) => {
          // Đường kính theo căn bậc hai của tỉ lệ (scaleBetween) nên chênh lệch diện tích không quá gắt.
          const d = scaleBetween(w.ratio, dMin, dMax);
          return (
            <span
              key={w.word}
              title={`${w.word} · ${w.count}`}
              className={`flex shrink-0 items-center justify-center rounded-full p-2 text-center font-bold leading-tight text-white shadow-sm transition-all duration-500 ${WORD_GRADIENTS[w.i % WORD_GRADIENTS.length]}`}
              style={{
                width: d,
                height: d,
                fontSize: `${Math.max(stage ? 1.1 : 0.7, d / (stage ? 9 : 6.5) / 16)}rem`,
              }}
            >
              <span className="line-clamp-3 break-words [overflow-wrap:anywhere]">{w.word}</span>
            </span>
          );
        })}
      </div>
    );
  }

  if (v === "cloud") {
    const [fMin, fMax] = FONT[scale].cloud;
    return (
      <div key="cloud" className={`flex flex-wrap items-center justify-center ${stage ? "gap-x-8 gap-y-2" : "gap-x-4 gap-y-1"}`}>
        {centerOut(ranked.map((w, i) => ({ ...w, i }))).map((w) => (
          <span
            key={w.word}
            className={`font-extrabold leading-tight transition-all duration-500 hover:scale-110 ${WORD_TEXT_COLORS[w.i % WORD_TEXT_COLORS.length]}`}
            style={{ fontSize: `${scaleBetween(w.ratio, fMin, fMax)}rem` }}
          >
            {w.word}
          </span>
        ))}
      </div>
    );
  }

  // chips — kiểu gốc, giữ nguyên hình dạng cũ.
  const [fMin, fMax] = FONT[scale].chips;
  return (
    <div key="chips" className={`flex flex-wrap items-center justify-center ${stage ? "gap-5" : "gap-3"}`}>
      {ranked.map((w, idx) => (
        <span
          key={w.word}
          className={`rounded-full font-semibold text-white transition-transform hover:scale-110 ${
            stage ? "px-6 py-3 font-bold" : "px-3 py-1.5"
          } ${WORD_GRADIENTS[idx % WORD_GRADIENTS.length]}`}
          style={{ fontSize: `${fMin + w.ratio * (fMax - fMin)}rem` }}
        >
          {w.word}
        </span>
      ))}
    </div>
  );
}

/** Ô chọn kiểu xem. `compact` = dạng nút nhỏ trên thanh công cụ, mặc định = có mô tả dưới (trình soạn). */
export function WordCloudViewPicker({
  value,
  onChange,
  compact = false,
}: {
  value: WordCloudView;
  onChange: (v: WordCloudView) => void;
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Kiểu hiển thị Word Cloud" className="flex flex-wrap items-center gap-1.5">
      {WORD_CLOUD_VIEWS.map((k) => {
        const on = k === value;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            title={WORD_CLOUD_VIEW_HINT[k]}
            onClick={() => onChange(k)}
            className={`rounded-full border px-3 text-sm font-medium transition-colors ${compact ? "py-1" : "py-1.5"} ${
              on
                ? "border-transparent bg-brand-600 text-white"
                : "border-token bg-[rgb(var(--surface))] text-muted hover:bg-[rgb(var(--surface-muted))]"
            }`}
          >
            {WORD_CLOUD_VIEW_LABEL[k]}
          </button>
        );
      })}
    </div>
  );
}
