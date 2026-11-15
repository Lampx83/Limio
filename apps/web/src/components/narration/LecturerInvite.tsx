"use client";

import { useState } from "react";
import { Headphones, X } from "lucide-react";
import { safeStorage } from "@/lib/narration/learner";
import { narrationCommands, patchNarration } from "@/lib/narration/store";
import { NarrationAvatar } from "./NarrationAvatar";
import { useT } from "@/lib/i18n/client";

/** Theo cả người dùng: nhiều tài khoản dùng chung một trình duyệt thì việc một người ẩn lời mời không được ẩn lây sang người khác. */
export const inviteDismissKey = (courseSlug: string, userId: string | null) => `limio:lecturer-invite:${courseSlug}:${userId ?? "guest"}`;
/** Bắn khi học viên ẩn lời mời, để nút Nghe giảng (đang nhường chỗ cho lời mời) hiện lại. */
export const INVITE_EVENT = "limio:lecturer-invite-changed";

/**
 * Mức «Hiện» của giảng viên ảo (docs/tieu-chi/giang-vien-ao.md, AC3): thanh mời mở Nghe giảng có giảng viên, học viên tắt được.
 * Lựa chọn tắt nhớ trong trình duyệt theo khoá, không gửi lên máy chủ.
 */
export default function LecturerInvite({ courseSlug, userId, name, accent }: { courseSlug: string; userId: string | null; name: string; accent: string }) {
  const tr = useT();
  const [hidden, setHidden] = useState(() => safeStorage()?.getItem(inviteDismissKey(courseSlug, userId)) === "1");
  if (hidden) return null;
  return (
    <div className="banner-info mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
      <NarrationAvatar who="lecturer" name={name} accent={accent} size="sm" />
      <p className="min-w-[10rem] flex-1 text-sm">
        <strong>{name}</strong>{tr("reader.nar.invite.canTeach")}
      </p>
      <button type="button" className="btn-primary btn-sm shrink-0" onClick={() => {
          patchNarration({ stage: true });
          narrationCommands()?.open("lecture");
        }}>
        <Headphones size={14} />
        {tr("reader.nar.invite.learnWith")}
      </button>
      <button
        type="button"
        aria-label={tr("reader.nar.invite.hide")}
        className="shrink-0 rounded-full p-1 text-muted hover:bg-[rgb(var(--surface-muted))]"
        onClick={() => {
          try {
            safeStorage()?.setItem(inviteDismissKey(courseSlug, userId), "1");
          } catch {
            /* bỏ qua */
          }
          setHidden(true);
          window.dispatchEvent(new Event(INVITE_EVENT));
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
