"use client";

import { useEffect, useState } from "react";
import { Headphones } from "lucide-react";
import { NarrationWave } from "./NarrationAvatar";
import "./narration.css";
import { minutesLabel, safeStorage } from "@/lib/narration/learner";
import { INVITE_EVENT, inviteDismissKey } from "./LecturerInvite";
import { narrationCommands, useNarration } from "@/lib/narration/store";

/**
 * Nút "Nghe giảng · N phút" ở hàng nút đầu bài, cạnh "In / Lưu PDF". Chỉ được dựng khi bài có lời giảng sẵn sàng
 * (trang bài không render component này nếu không có), nên không bao giờ để lại chỗ trống.
 */
export default function NarrationButton({ durationSec, inviteCourseSlug, userId = null }: { durationSec: number; inviteCourseSlug?: string; userId?: string | null }) {
  const ui = useNarration();
  // Khoá có lời mời «Học với giảng viên ảo» thì lời mời là cửa vào duy nhất (hai nút cùng mở một bài giảng là thừa);
  // học viên ẩn lời mời rồi thì nút này hiện lại để không mất lối vào.
  const [invited, setInvited] = useState(!!inviteCourseSlug);
  useEffect(() => {
    if (!inviteCourseSlug) return;
    const sync = () => setInvited(safeStorage()?.getItem(inviteDismissKey(inviteCourseSlug, userId)) !== "1");
    sync();
    window.addEventListener(INVITE_EVENT, sync);
    return () => window.removeEventListener(INVITE_EVENT, sync);
  }, [inviteCourseSlug, userId]);
  if (invited) return null;
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
