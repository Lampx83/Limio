"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { WatermelonSliceIcon } from "../BrandIcons";
import { AssistantInput, AssistantThread, LimioAvatar } from "./AssistantChat";
import { useAssistant } from "./AssistantProvider";

/** Trang chủ đã có khung trợ lý lớn (cùng một cuộc trò chuyện) nên không hiện nút nổi ở đó. */
const HIDE_ON = ["/instructor/dashboard"];

const QUICK_PROMPTS = ["Hôm nay tôi nên làm gì trước?", "Cách tạo đề thi", "Cách tổ chức một buổi kiểm tra trên lớp"];

/**
 * Limio (màu hồng, khác trợ giảng AI xanh ở trang bài học của học viên) đi theo giảng viên: nút nổi ở góc dưới bên phải mọi trang trong khu vực giảng viên, bấm mở ngăn kéo chat. Cuộc
 * trò chuyện nằm ở AssistantProvider (layout), nên giảng viên bấm liên kết Limio đưa, thử thao tác ở trang đó, rồi mở
 * lại ngăn kéo là thấy đúng đoạn chat đang dở. Chuyển trang thì ngăn kéo tự thu lại để không che trang đang làm.
 */
export default function AssistantLauncher() {
  const pathname = usePathname();
  const { open, setOpen, unread, messages, busy, reset, send } = useAssistant();
  const hidden = HIDE_ON.includes(pathname ?? "");

  // Chuyển trang: thu ngăn kéo, giữ nguyên lịch sử.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (hidden) return null;

  const intro = (
    <div className="flex items-start gap-3">
      <LimioAvatar />
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-token bg-[rgb(var(--surface))] px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
          Xin chào thầy/cô, tôi là Limio, trợ lý ảo của thầy/cô trên Limio. Nhiệm vụ chính của tôi là hướng dẫn sử dụng các tính năng trên Limio (soạn khoá học, bài giảng, kiểm tra, chấm bài, quản lý lớp...) và gợi ý việc nên làm. Thầy/cô cần gì ạ?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => void send(q)}
              className="rounded-full border border-token bg-[rgb(var(--surface))] px-3.5 py-1.5 text-left text-sm shadow-sm transition hover:border-slate-300 hover:shadow disabled:opacity-60"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" onClick={() => setOpen(false)} aria-hidden />}

      {open && (
        <div
          role="dialog"
          aria-label="Limio, trợ lý ảo của thầy/cô trên Limio"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[80vh] flex-col overflow-hidden rounded-t-3xl border border-token bg-[rgb(var(--surface))] shadow-2xl sm:inset-x-auto sm:bottom-20 sm:right-4 sm:h-[34rem] sm:max-h-[calc(100vh-7rem)] sm:w-[26rem] sm:rounded-3xl"
        >
          <div className="flex items-center gap-3 border-b border-token px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-50" aria-hidden>
              <WatermelonSliceIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold leading-tight">Limio</p>
              <p className="truncate text-xs text-muted">Trợ lý ảo của thầy/cô · chỉ hỗ trợ cách dùng Limio</p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={reset} className="btn-ghost btn-sm shrink-0" aria-label="Cuộc trò chuyện mới" title="Cuộc trò chuyện mới">
                <RotateCcw size={16} aria-hidden />
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm shrink-0" aria-label="Thu nhỏ trợ lý">
              <X size={18} aria-hidden />
            </button>
          </div>
          <AssistantThread className="min-h-0 flex-1 bg-[rgb(var(--surface-muted))] px-4 py-4" intro={intro} />
          <div className="border-t border-token p-3">
            <AssistantInput variant="docked" autoFocus />
          </div>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={unread ? "Mở Limio, có câu trả lời mới" : "Mở Limio, trợ lý ảo của thầy/cô"}
          className="fixed bottom-4 right-4 z-40 flex h-12 items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 text-pink-700 shadow-lg transition hover:bg-pink-100 hover:shadow-xl active:scale-95 sm:px-4"
        >
          <WatermelonSliceIcon className="h-7 w-7" />
          <span className="hidden text-sm font-bold sm:inline">Hỏi Limio</span>
          {(unread || busy) && (
            <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-pink-500 ${busy ? "animate-pulse" : ""}`} aria-hidden />
          )}
        </button>
      )}
    </>
  );
}
