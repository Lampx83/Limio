"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Bottom navigation bar for the lesson page. Show prev/next buttons + a
 * "completed" badge. The actual auto-completion tracking lives in
 * LessonCompletionPrompt (at the top of the page) so the trackers + the API
 * call have a single owner.
 *
 * Still owns the lesson-view heartbeat — fired once on mount so the server
 * records lastLessonId / lastPositionSec for "continue where you left off."
 */
export default function LessonStickyActions({
  lessonId,
  courseSlug,
  completed,
  initialResumeSec,
  prevLessonId,
  prevTitle,
  nextLessonId,
  nextTitle,
}: {
  lessonId: string;
  courseSlug: string;
  /** Server-rendered completion state. The auto-completion happens in the
   * companion LessonCompletionPrompt component, which triggers a router.refresh
   * after firing — so this prop becomes `true` after the next render. */
  completed: boolean;
  initialResumeSec: number;
  prevLessonId: string | null;
  prevTitle: string | null;
  nextLessonId: string | null;
  nextTitle: string | null;
}) {
  useEffect(() => {
    fetch(apiUrl(`/api/lessons/${lessonId}/view`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionSec: initialResumeSec }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

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
            {completed && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-success-50 px-3 py-2 text-sm font-semibold text-success-700">
                <Check size={16} strokeWidth={2.5} />
                <span>Đã hoàn thành</span>
              </span>
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
