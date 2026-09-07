"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { List, X, Check, Lock } from "lucide-react";

type TocLesson = { id: string; title: string; completed: boolean; locked?: boolean };
type TocModule = { id: string; title: string; lessons: TocLesson[] };

export default function LessonTocDrawer({
  slug,
  currentLessonId,
  modules,
  triggerClassName,
  triggerLabel = "Mục lục",
}: {
  slug: string;
  currentLessonId: string;
  modules: TocModule[];
  /** Đổi kiểu nút mở khi đặt ở nơi khác (thanh dưới đáy dùng kiểu nút đặc). */
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Chỉ portal sau khi đã mount: document chưa tồn tại lúc render trên máy chủ.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Auto-close when navigating to another lesson.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Running lesson number across the whole course.
  let counter = 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex items-center gap-1.5 rounded-full border border-token px-3 py-1 text-xs font-medium text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <List size={14} />
        {triggerLabel}
      </button>

      {/*
        Lớp phủ được portal thẳng ra <body>. Nút mở nằm trong thanh cố định
        dưới đáy, mà thanh đó có `backdrop-blur` — một phần tử có filter trở
        thành containing block cho mọi con `position: fixed`, nên nếu để tại
        chỗ thì `inset-0` tính theo thanh chứ không theo màn hình: mục lục bị
        ép thành một ô nhỏ nằm trong thanh.
      */}
      {open &&
        mounted &&
        createPortal(
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label="Mục lục bài học"
        >
          <aside
            className="absolute right-0 top-0 flex h-full w-80 max-w-[88vw] flex-col border-l border-token bg-[rgb(var(--surface))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-token px-4 py-3">
              <span className="text-sm font-semibold text-strong">Mục lục bài học</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng mục lục"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))]"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3">
              {modules.map((m) => {
                const done = m.lessons.filter((l) => l.completed).length;
                return (
                  <div key={m.id} className="mb-4">
                    <div className="flex items-center justify-between px-1 pb-1.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-700 dark:text-brand-400">
                        {m.title}
                      </span>
                      <span className="text-[11px] text-faint">
                        {done}/{m.lessons.length}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {m.lessons.map((l) => {
                        counter++;
                        const active = l.id === currentLessonId;
                        const num = (
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                              l.locked
                                ? "bg-[rgb(var(--surface-muted))] text-faint"
                                : l.completed
                                  ? "bg-emerald-500 text-white"
                                  : active
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                                    : "bg-[rgb(var(--surface-muted))] text-faint"
                            }`}
                          >
                            {l.locked ? (
                              <Lock size={11} strokeWidth={2.5} aria-hidden />
                            ) : l.completed ? (
                              <Check size={12} strokeWidth={3} />
                            ) : (
                              counter
                            )}
                          </span>
                        );

                        // Bài đang khoá: vẫn thấy tên để biết lộ trình còn gì,
                        // nhưng không phải một liên kết — bấm vào rồi mới bị
                        // chặn thì chỉ tổ làm người học tưởng mình bấm hỏng.
                        if (l.locked) {
                          return (
                            <li key={l.id}>
                              <div
                                className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-faint"
                                title="Nội dung đang khoá — giảng viên sẽ mở sau"
                              >
                                {num}
                                <span className="flex-1 truncate">{l.title}</span>
                                <span className="shrink-0 text-[10px] uppercase tracking-wide">
                                  Đang khoá
                                </span>
                              </div>
                            </li>
                          );
                        }

                        return (
                          <li key={l.id}>
                            <Link
                              href={`/learn/${slug}/lessons/${l.id}`}
                              aria-current={active ? "page" : undefined}
                              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                                active
                                  ? "bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                                  : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
                              }`}
                              prefetch={false}
                            >
                              {num}
                              <span className="flex-1 truncate">{l.title}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </nav>
          </aside>
        </div>,
          document.body,
        )}
    </>
  );
}
