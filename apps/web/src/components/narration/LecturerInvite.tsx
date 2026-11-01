"use client";

import { useState } from "react";
import { Headphones, X } from "lucide-react";
import { safeStorage } from "@/lib/narration/learner";
import { narrationCommands } from "@/lib/narration/store";
import { NarrationAvatar } from "./NarrationAvatar";

const dismissKey = (courseSlug: string) => `limio:lecturer-invite:${courseSlug}`;

/**
 * Mức «Hiện» của giảng viên ảo (docs/tieu-chi/giang-vien-ao.md, AC3): thanh mời mở Nghe giảng có giảng viên, học viên tắt được.
 * Lựa chọn tắt nhớ trong trình duyệt theo khoá, không gửi lên máy chủ.
 */
export default function LecturerInvite({ courseSlug, name, accent }: { courseSlug: string; name: string; accent: string }) {
  const [hidden, setHidden] = useState(() => safeStorage()?.getItem(dismissKey(courseSlug)) === "1");
  if (hidden) return null;
  return (
    <div className="banner-info mt-3 flex items-center gap-3 print:hidden">
      <NarrationAvatar who="lecturer" name={name} accent={accent} size="sm" />
      <p className="min-w-0 flex-1 text-sm">
        <strong>{name}</strong> có thể giảng bài này cho bạn.
      </p>
      <button type="button" className="btn-primary btn-sm shrink-0" onClick={() => narrationCommands()?.open("lecture")}>
        <Headphones size={14} />
        Học với giảng viên ảo
      </button>
      <button
        type="button"
        aria-label="Ẩn lời mời"
        className="shrink-0 rounded-full p-1 text-muted hover:bg-[rgb(var(--surface-muted))]"
        onClick={() => {
          try {
            safeStorage()?.setItem(dismissKey(courseSlug), "1");
          } catch {
            /* bỏ qua */
          }
          setHidden(true);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
