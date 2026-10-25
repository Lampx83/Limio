"use client";

import { Mic } from "lucide-react";
import { minutesLabel } from "@/lib/narration/learner";
import { narrationCommands, useNarration } from "@/lib/narration/store";

/**
 * Nút "Podcast · N phút" ở hàng nút đầu bài, ngay cạnh "Nghe giảng". Phát qua cùng thanh phát; bản chữ theo lượt nằm trong
 * thanh phát (PodcastTranscript). Chỉ được dựng khi bài có podcast sẵn sàng.
 */
export default function PodcastButton({ durationSec, title }: { durationSec: number; title: string }) {
  const ui = useNarration();
  const active = ui.open && ui.kind === "podcast";
  return (
    <button
      type="button"
      className={`btn-pill print:hidden ${active ? "ring-2 ring-[rgb(var(--brand))]" : ""}`}
      aria-pressed={active}
      title={title}
      onClick={() => {
        const c = narrationCommands();
        if (active) c?.toggle();
        else c?.open("podcast");
      }}
    >
      <Mic size={16} />
      Podcast · {minutesLabel(durationSec)}
    </button>
  );
}
