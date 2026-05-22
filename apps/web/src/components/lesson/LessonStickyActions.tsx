"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

export default function LessonStickyActions({
  lessonId,
  courseSlug,
  initiallyCompleted,
  initialResumeSec,
  prevLessonId,
  prevTitle,
  nextLessonId,
  nextTitle,
}: {
  lessonId: string;
  courseSlug: string;
  initiallyCompleted: boolean;
  initialResumeSec: number;
  prevLessonId: string | null;
  prevTitle: string | null;
  nextLessonId: string | null;
  nextTitle: string | null;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(apiUrl(`/api/lessons/${lessonId}/view`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionSec: initialResumeSec }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function onComplete() {
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/lessons/${lessonId}/complete`), {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setCompleted(true);
        if (data?.courseCompleted) {
          window.location.href = `/learn/${courseSlug}`;
        } else {
          router.refresh();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Spacer so page content not hidden by the fixed bar */}
      <div aria-hidden className="h-24" />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-token bg-[rgb(var(--surface)/0.95)] backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--surface)/0.85)] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          {prevLessonId ? (
            <a
              href={`/learn/${courseSlug}/lessons/${prevLessonId}`}
              title={prevTitle ?? undefined}
              aria-label={prevTitle ? `Bài trước: ${prevTitle}` : "Bài trước"}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
            >
              <span aria-hidden>←</span>
              <span className="hidden sm:inline">Bài trước</span>
            </a>
          ) : (
            <span aria-hidden className="w-10 shrink-0 sm:w-24" />
          )}

          <div className="flex flex-1 justify-center">
            {completed ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-success-50 px-3 py-2 text-sm font-semibold text-success-700">
                <Check size={16} strokeWidth={2.5} />
                <span>Đã hoàn thành</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={onComplete}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-success-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-success-700 hover:shadow-md disabled:opacity-50"
              >
                <CheckCircle2 size={16} strokeWidth={2.5} />
                {busy ? "Đang lưu..." : "Đánh dấu hoàn thành"}
              </button>
            )}
          </div>

          {nextLessonId ? (
            <a
              href={`/learn/${courseSlug}/lessons/${nextLessonId}`}
              title={nextTitle ?? undefined}
              aria-label={nextTitle ? `Bài tiếp: ${nextTitle}` : "Bài tiếp"}
              className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                completed
                  ? "bg-brand-600 text-white hover:bg-brand-700"
                  : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
              }`}
            >
              <span className="hidden sm:inline">Bài tiếp</span>
              <span aria-hidden>→</span>
            </a>
          ) : (
            <span aria-hidden className="w-10 shrink-0 sm:w-24" />
          )}
        </div>
      </div>
    </>
  );
}
