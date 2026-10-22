"use client";

import { generationTiles, type TileState } from "@/lib/limioLiveOutlineCard";
import { glyphKey } from "@/lib/limioLiveOutlineUi";
import type { OutlineSlide } from "@/lib/limioLiveOutline";
import OutlineGlyph from "./OutlineGlyph";

const TILE: Record<TileState, string> = {
  done: "border-brand-600/40 bg-[rgb(var(--brand-soft))]",
  now: "gen-tile-now border-brand-600 bg-[rgb(var(--surface))] ring-2 ring-brand-600",
  wait: "border-token bg-[rgb(var(--surface-muted))] text-muted",
};

/**
 * Lưới slide theo đúng thứ tự dàn ý khi đang tạo (O6): slide xong nền và viền xanh lime kèm dấu tích, slide đang viết có viền nhấn, quầng sáng và vệt quét,
 * slide chờ vẫn xám. Slide chỉ được lưu khi cả bài xong nên chưa mở được trong lúc tạo.
 */
export default function GenerationGrid({ slides, done, writing }: { slides: OutlineSlide[]; done: number; writing: Set<string> | null }) {
  const states = generationTiles(slides.map((s) => s.id), done, writing);
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="Tiến độ từng slide">
      {slides.map((s, i) => {
        const st = states[i]!;
        return (
          <li key={s.id} className={`relative grid aspect-video content-center gap-1.5 overflow-hidden rounded-xl border p-3 ${TILE[st]}`} aria-label={`Slide ${i + 1}: ${st === "done" ? "đã xong" : st === "now" ? "đang viết" : "chờ"}`}>
            <div className="flex items-center gap-2">
              <OutlineGlyph k={glyphKey(s)} className={`h-[22px] w-[34px] shrink-0 ${st === "done" ? "text-brand-700 dark:text-brand-300" : st === "now" ? "text-brand-600" : "text-muted"}`} />
              <b className="line-clamp-2 text-[14px] leading-snug">{s.title.trim() || "Chưa có tiêu đề"}</b>
            </div>
            {st === "now" && (
              <>
                <span className="h-2 w-full animate-pulse rounded-full bg-brand-600/25" />
                <span className="h-2 w-2/3 animate-pulse rounded-full bg-brand-600/25" />
              </>
            )}
            {st === "done" && (
              <>
                <span className="h-2 w-full rounded-full bg-brand-600/20" />
                <span className="h-2 w-2/3 rounded-full bg-brand-600/20" />
              </>
            )}
            {st === "done" ? (
              <span className="absolute bottom-1.5 right-2.5 flex items-center gap-1 text-[12px] tabular-nums text-brand-700 dark:text-brand-300">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
                {i + 1}
              </span>
            ) : (
              <span className="absolute bottom-1.5 right-2.5 text-[12px] tabular-nums text-faint">{i + 1}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
