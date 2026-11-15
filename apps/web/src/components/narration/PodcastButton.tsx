"use client";

import { Podcast } from "lucide-react";
import { NarrationWave } from "./NarrationAvatar";
import "./narration.css";
import { useUiLang } from "@/lib/i18n/client";
import { minutesLabel } from "@/lib/narration/learner";
import { narrationCommands, useNarration } from "@/lib/narration/store";

/**
 * Nút "Podcast · N phút" ở hàng nút đầu bài, ngay cạnh "Nghe giảng". Phát qua cùng thanh phát; bản chữ theo lượt nằm trong
 * thanh phát (PodcastTranscript). Chỉ được dựng khi bài có podcast sẵn sàng.
 */
export default function PodcastButton({ durationSec, title }: { durationSec: number; title: string }) {
  const ui = useNarration();
  const lang = useUiLang();
  const active = ui.open && ui.kind === "podcast";
  return (
    <button
      type="button"
      className="btn-listen btn-listen-podcast print:hidden"
      aria-pressed={active}
      title={title}
      onClick={() => {
        const c = narrationCommands();
        if (active) c?.toggle();
        else c?.open("podcast");
      }}
    >
      <span className="listen-icon">{active && ui.playing ? <NarrationWave playing /> : <Podcast size={18} />}</span>
      <span className="listen-label">
        <span>Podcast</span>
        <small>{minutesLabel(durationSec, lang)}</small>
      </span>
    </button>
  );
}
