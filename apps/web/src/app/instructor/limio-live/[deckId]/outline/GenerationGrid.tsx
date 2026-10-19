"use client";

import { generationTiles, type TileState } from "@/lib/limioLiveOutlineCard";
import { glyphKey } from "@/lib/limioLiveOutlineUi";
import type { OutlineSlide } from "@/lib/limioLiveOutline";
import OutlineGlyph from "./OutlineGlyph";

const TILE: Record<TileState, string> = {
  done: "border-token bg-[rgb(var(--surface))]",
  now: "border-brand-600 bg-[rgb(var(--surface))] ring-2 ring-brand-600",
  wait: "border-token bg-[rgb(var(--surface-muted))] text-muted",
};

/**
 * Lưới slide theo đúng thứ tự dàn ý khi đang tạo (O6): slide xong hiện tiêu đề và ký hiệu bố cục, slide đang viết có viền nhấn và vạch chạy,
 * slide chờ mờ hơn. Slide chỉ được lưu khi cả bài xong nên chưa mở được trong lúc tạo.
 */
export default function GenerationGrid({ slides, done, writing }: { slides: OutlineSlide[]; done: Set<string>; writing: Set<string> | null }) {
  const states = generationTiles(slides.map((s) => s.id), done, writing);
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="Tiến độ từng slide">
      {slides.map((s, i) => {
        const st = states[i]!;
        return (
          <li key={s.id} className={`relative grid aspect-video content-center gap-1.5 overflow-hidden rounded-xl border p-3 ${TILE[st]}`} aria-label={`Slide ${i + 1}: ${st === "done" ? "đã xong" : st === "now" ? "đang viết" : "chờ"}`}>
            <div className="flex items-center gap-2">
              <OutlineGlyph k={glyphKey(s)} className="h-[22px] w-[34px] shrink-0 text-muted" />
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
                <span className="h-2 w-full rounded-full bg-black/10" />
                <span className="h-2 w-2/3 rounded-full bg-black/10" />
              </>
            )}
            <span className="absolute bottom-1.5 right-2.5 text-[12px] tabular-nums text-faint">{i + 1}</span>
          </li>
        );
      })}
    </ol>
  );
}
