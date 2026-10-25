"use client";

import { Headphones } from "lucide-react";
import { NarrationWave } from "./NarrationAvatar";
import "./narration.css";
import { minutesLabel } from "@/lib/narration/learner";
import { narrationCommands, useNarration } from "@/lib/narration/store";

/**
 * Nút "Nghe giảng · N phút" ở hàng nút đầu bài, cạnh "In / Lưu PDF". Chỉ được dựng khi bài có lời giảng sẵn sàng
 * (trang bài không render component này nếu không có), nên không bao giờ để lại chỗ trống.
 */
export default function NarrationButton({ durationSec }: { durationSec: number }) {
  const ui = useNarration();
  const active = ui.open && ui.kind === "lecture";
  return (
    <button
      type="button"
      className="btn-listen print:hidden"
      aria-pressed={active}
      onClick={() => {
        const c = narrationCommands();
        if (active) c?.toggle();
        else c?.open("lecture");
      }}
    >
      <span className="listen-icon">{active && ui.playing ? <NarrationWave playing /> : <Headphones size={18} />}</span>
      <span className="listen-label">
        <span>Nghe giảng</span>
        <small>{minutesLabel(durationSec)}</small>
      </span>
    </button>
  );
}
