"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { LessonNotes } from "@/components/LessonActions";

export default function LessonNotesDrawer({ lessonId }: { lessonId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Floating trigger — bottom-right, above AI tutor stack */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mở ghi chú bài học này"
        className="fixed bottom-24 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-transform hover:scale-105"
      >
        <Pencil size={18} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <aside
            role="dialog"
            aria-label="Ghi chú bài học này"
            className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-token bg-[rgb(var(--surface))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-token bg-[rgb(var(--surface)/0.95)] px-5 py-3 backdrop-blur">
              <h2 className="text-base font-semibold">Ghi chú bài học này</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))]"
              >
                <X size={16} />
              </button>
            </header>
            <div className="px-5 pb-24 pt-4">
              <LessonNotes lessonId={lessonId} hideHeading />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
