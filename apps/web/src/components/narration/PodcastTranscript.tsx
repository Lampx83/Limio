"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import type { PodcastForLearner } from "@feedbackme/core-lms";
import { formatClock, segmentIndexAt } from "@/lib/narration/learner";
import { narrationCommands, useNarration } from "@/lib/narration/store";
import "./narration.css";

/**
 * Bản chữ theo lượt của podcast, nằm trong thanh phát (mở được): bấm một lượt thì nghe từ đó, lượt đang phát được tô.
 * Podcast nghe được cả khi không nhìn màn hình nên không tô sáng bài và không tự cuộn trang; chỉ cuộn trong hộp bản chữ.
 */
export default function PodcastTranscript({ podcast }: { podcast: PodcastForLearner }) {
  const ui = useNarration();
  const activeTurn = segmentIndexAt(podcast.turns, ui.time);
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
    <details ref={detailsRef} className="group border-t border-token px-3 py-2 sm:px-4">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted hover:text-[rgb(var(--text))]">
        <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
        Xem bản chữ theo lượt
      </summary>
      <ul ref={listRef} className="relative mt-2 max-h-[40vh] space-y-1 overflow-y-auto pr-1">
        {podcast.turns.map((t, i) => (
          <li key={t.index}>
            <button
              type="button"
              onClick={() => narrationCommands()?.playFrom("podcast", t.startSec)}
              aria-current={i === activeTurn ? "true" : undefined}
              className={`flex w-full gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[rgb(var(--surface-muted))] ${
                i === activeTurn ? "bg-[rgb(var(--brand-soft))] ring-1 ring-[rgb(var(--brand)/0.5)]" : ""
              }`}
            >
              <span className="w-20 shrink-0 text-xs font-semibold sm:w-24">{t.speakerName}</span>
              <span className="min-w-0 flex-1">{t.text}</span>
              <span className="shrink-0 tabular-nums text-xs text-muted">{formatClock(t.startSec)}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
