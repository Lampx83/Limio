"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { WatermelonSliceIcon } from "../BrandIcons";
import { AssistantInput, AssistantThread, LilyIntro } from "./AssistantChat";
import { useAssistant } from "./AssistantProvider";


/**
 * Lily (màu hồng, khác trợ giảng AI xanh ở trang bài học của học viên) đi theo giảng viên: nút nổi ở góc dưới bên phải mọi trang trong khu vực giảng viên (kể cả trang chủ), bấm mở ngăn kéo chat. Cuộc
 * trò chuyện nằm ở AssistantProvider (layout), nên giảng viên bấm liên kết Lily đưa, thử thao tác ở trang đó, rồi mở
 * lại ngăn kéo là thấy đúng đoạn chat đang dở. Chuyển trang thì ngăn kéo tự thu lại để không che trang đang làm.
 */
const NUDGE_KEY = "limio.assistant.nudged";

export default function AssistantLauncher() {
  const pathname = usePathname();
  const { open, setOpen, unread, messages, busy, error, reset, send } = useAssistant();
  const dialogRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const isDesktop = () => typeof window !== "undefined" && !!window.matchMedia?.("(min-width: 640px)").matches;
  const closing = useRef(false);

  // Mở: "mọc" ra từ góc dưới phải, chỗ nút nổi (máy tính), hoặc trượt lên từ đáy (điện thoại). Dùng Web Animations API nên
  // không để lại dấu vết trên style nếu bị ngắt giữa chừng.
  useLayoutEffect(() => {
    if (!open || reducedMotion()) return;
    const el = dialogRef.current;
    if (!el) return;
    const frames: Keyframe[] = isDesktop()
      ? [
          { transform: "scale(0.2)", opacity: 0, transformOrigin: "bottom right" },
          { transform: "scale(1)", opacity: 1, transformOrigin: "bottom right" },
        ]
      : [
          { transform: "translateY(100%)", opacity: 0.6 },
          { transform: "translateY(0)", opacity: 1 },
        ];
    const anim = el.animate(frames, { duration: 440, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    return () => anim.cancel();
  }, [open]);

  // Đóng: thu lại về góc dưới phải, chỗ nút nổi sẽ hiện ra (máy tính), hoặc trượt xuống đáy (điện thoại), rồi mới gỡ khung.
  const requestClose = useCallback(() => {
    const el = dialogRef.current;
    if (!el || closing.current || reducedMotion()) {
      setOpen(false);
      return;
    }
    closing.current = true;
    const frames: Keyframe[] = isDesktop()
      ? [
          { transform: "scale(1)", opacity: 1, transformOrigin: "bottom right" },
          { transform: "scale(0.15)", opacity: 0, transformOrigin: "bottom right" },
        ]
      : [
          { transform: "translateY(0)", opacity: 1 },
          { transform: "translateY(100%)", opacity: 0.4 },
        ];
    const anim = el.animate(frames, { duration: 260, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" });
    anim.addEventListener("finish", () => {
      closing.current = false;
      setOpen(false);
    });
  }, [setOpen]);

  // Lần đầu trong một phiên: sau ~3 giây nút rung nhẹ đúng một lần để người chưa biết Lily nhìn thấy nó. Có ghi nhớ trong
  // sessionStorage nên sang trang khác không rung lại; người chọn giảm chuyển động thì bỏ qua.
  useEffect(() => {
    if (reducedMotion()) return;
    try {
      if (window.sessionStorage.getItem(NUDGE_KEY)) return;
    } catch {
      return;
    }
    const id = window.setTimeout(() => {
      const el = fabRef.current;
      if (!el) return;
      try {
        window.sessionStorage.setItem(NUDGE_KEY, "1");
      } catch {
        // không ghi được thì lần sau có thể rung lại, không sao
      }
      el.animate(
        [
          { transform: "translateY(0) rotate(0deg)" },
          { transform: "translateY(-6px) rotate(-5deg)", offset: 0.25 },
          { transform: "translateY(0) rotate(4deg)", offset: 0.5 },
          { transform: "translateY(-3px) rotate(-2deg)", offset: 0.75 },
          { transform: "translateY(0) rotate(0deg)" },
        ],
        { duration: 900, easing: "ease-in-out" },
      );
    }, 3000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chuyển trang: thu ngăn kéo, giữ nguyên lịch sử.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  const intro = <LilyIntro onPick={(q) => void send(q, "suggestion")} />;

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" onClick={requestClose} aria-hidden />}

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="Lily, trợ lý ảo của thầy/cô trên Limio"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[80vh] flex-col overflow-hidden rounded-t-3xl border border-token bg-[rgb(var(--surface))] shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[34rem] sm:max-h-[calc(100vh-2rem)] sm:w-[26rem] sm:rounded-3xl"
        >
          <div className="flex items-center gap-3 border-b border-token px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-50" aria-hidden>
              <WatermelonSliceIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold leading-tight">Trợ lý Lily</p>
              <p className="truncate text-xs text-muted">Hướng dẫn sử dụng Limio</p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={reset} className="btn-ghost btn-sm shrink-0" aria-label="Cuộc trò chuyện mới" title="Cuộc trò chuyện mới">
                <RotateCcw size={16} aria-hidden />
              </button>
            )}
            <button type="button" onClick={requestClose} className="btn-ghost btn-sm shrink-0" aria-label="Thu nhỏ trợ lý">
              <X size={18} aria-hidden />
            </button>
          </div>
          <AssistantThread className="min-h-0 flex-1 bg-[rgb(var(--surface-muted))] px-4 py-4" intro={intro} />
          <div className="border-t border-token p-3">
            {error && <p role="alert" className="banner-danger mb-2 text-sm font-medium">{error}</p>}
            <AssistantInput variant="docked" autoFocus />
          </div>
        </div>
      )}

      {!open && (
        <button
          ref={fabRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={busy ? "Mở Lily, em đang soạn câu trả lời" : unread ? "Mở Lily, có câu trả lời mới" : "Mở Lily, trợ lý ảo của thầy/cô"}
          className="group animate-fade-in-up fixed bottom-5 right-4 z-40 flex h-12 items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 text-pink-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-pink-100 hover:shadow-xl active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:px-4"
        >
          {/* Đuôi bong bóng thoại ở góc dưới bên phải: ô vuông xoay 45 độ, chỉ viền hai cạnh dưới/phải, nền cùng màu nút nên
              nửa trên của nó che đường viền của nút và liền thành một khối. */}
          <span
            className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-pink-200 bg-pink-50 transition-colors group-hover:bg-pink-100"
            aria-hidden
          />
          {/* Rê chuột thì lát dưa nghiêng nhẹ. */}
          <WatermelonSliceIcon className="h-7 w-7 transition-transform duration-200 group-hover:-rotate-12 motion-reduce:transition-none motion-reduce:group-hover:rotate-0" />
          {busy ? (
            // Lily đang soạn câu trả lời mà ngăn kéo đóng: ba chấm nhấp nháy như đang gõ, thay cho nhãn.
            <span className="flex items-center gap-1 px-1" aria-hidden>
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-500 motion-reduce:animate-none" style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
          ) : (
            <span className="hidden text-sm font-bold sm:inline">Hỏi Lily</span>
          )}
          {unread && !busy && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-pink-500" aria-hidden />}
        </button>
      )}
    </>
  );
}
