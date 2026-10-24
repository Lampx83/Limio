"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, Mic, Pause, Play } from "lucide-react";
import type { PodcastForLearner } from "@feedbackme/core-lms";
import { formatClock, minutesLabel, segmentIndexAt } from "@/lib/narration/learner";
import { narrationCommands, useNarration } from "@/lib/narration/store";
import { NarrationAvatar } from "./NarrationAvatar";
import "./narration.css";

/**
 * Thẻ Podcast ngay dưới đầu bài: tên tập, thời lượng, hai người dẫn, nút phát và bản chữ theo lượt (mở được).
 * Phát qua cùng trình phát với "Nghe giảng"; podcast nghe được cả khi không nhìn màn hình nên không tô sáng, không tự cuộn trang.
 */
export default function PodcastCard({ podcast }: { podcast: PodcastForLearner }) {
  const ui = useNarration();
  const active = ui.open && ui.kind === "podcast";
  const playing = active && ui.playing;
  const activeTurn = active ? segmentIndexAt(podcast.turns, ui.time) : -1;
  const listRef = useRef<HTMLUListElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Giữ lượt đang phát trong tầm nhìn của HỘP bản chữ (cuộn hộp, không cuộn trang).
  useEffect(() => {
    const list = listRef.current;
    if (!list || !detailsRef.current?.open || activeTurn < 0) return;
    const li = list.children[activeTurn] as HTMLElement | undefined;
    if (!li) return;
    const top = li.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + li.offsetHeight > list.scrollTop + list.clientHeight) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      list.scrollTo({ top: Math.max(0, top - 8), behavior: reduced ? "auto" : "smooth" });
    }
  }, [activeTurn]);

  return (
    <section aria-label="Podcast của bài học" className="narration-card mt-4 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white" aria-hidden="true">
          <Mic size={22} />
        </span>
        <div className="min-w-0 flex-1 basis-44">
          <p className="text-caption font-semibold uppercase tracking-wide text-muted">Podcast · {minutesLabel(podcast.durationSec)}</p>
          <p className="line-clamp-2 text-body font-semibold">{podcast.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-meta text-muted">
            <span className="flex -space-x-2">
              <NarrationAvatar who="A" name={podcast.hosts.A} size="sm" speaking={playing && podcast.turns[activeTurn]?.speaker === "A"} />
              <NarrationAvatar who="B" name={podcast.hosts.B} size="sm" speaking={playing && podcast.turns[activeTurn]?.speaker === "B"} />
            </span>
            <span className="truncate">
              {podcast.hosts.A} và {podcast.hosts.B}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0 print:hidden"
          aria-pressed={active}
          onClick={() => {
            const c = narrationCommands();
            if (active) c?.toggle();
            else c?.open("podcast");
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          {playing ? "Tạm dừng" : active ? "Phát tiếp" : "Nghe podcast"}
        </button>
      </div>

      <details ref={detailsRef} className="group mt-3 border-t border-token pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-meta font-medium text-muted hover:text-[rgb(var(--text))]">
          <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
          Xem bản chữ theo lượt
        </summary>
        <ul ref={listRef} className="relative mt-2 max-h-80 space-y-1 overflow-y-auto pr-1">
          {podcast.turns.map((t, i) => (
            <li key={t.index}>
              <button
                type="button"
                onClick={() => narrationCommands()?.playFrom("podcast", t.startSec)}
                aria-current={i === activeTurn ? "true" : undefined}
                className={`flex w-full gap-3 rounded-lg px-3 py-2 text-left text-body transition-colors hover:bg-[rgb(var(--surface-muted))] ${
                  i === activeTurn ? "bg-[rgb(var(--brand-soft))] ring-1 ring-[rgb(var(--brand)/0.5)]" : ""
                }`}
              >
                <span className="w-24 shrink-0 text-meta font-semibold sm:w-28">{t.speakerName}</span>
                <span className="min-w-0 flex-1">{t.text}</span>
                <span className="shrink-0 tabular-nums text-caption text-muted">{formatClock(t.startSec)}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
