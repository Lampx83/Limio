"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDashed, Video, ListChecks, ScrollText } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Top-of-lesson "what's left to complete" panel. Owns the auto-complete
 * tracking logic (video watch %, activity completion, scroll-to-end) and POSTs
 * to /complete when every required condition is met.
 *
 * Mounted ABOVE the lesson content so the learner sees the checklist before
 * scrolling. Hidden once the lesson is already completed (server tells us via
 * `initiallyCompleted`).
 *
 * Trackers live here (not in LessonStickyActions) so the prompt and the bottom
 * bar don't double-fire /complete. The bottom bar reads server-rendered
 * completion state and just shows the badge.
 */

interface AutoCompleteConfig {
  requireVideoWatch: boolean;
  videoThresholdPct: number;
  requireAllActivities: boolean;
  pendingActivityCount: number;
  totalActivityCount: number;
  requireScrollToEnd: boolean;
}

export default function LessonCompletionPrompt({
  lessonId,
  courseSlug,
  initiallyCompleted,
  autoComplete,
}: {
  lessonId: string;
  courseSlug: string;
  initiallyCompleted: boolean;
  autoComplete: AutoCompleteConfig;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initiallyCompleted);
  // Video tracker: highest watched ratio across any video on the page.
  const [videoRatio, setVideoRatio] = useState(0);
  const [videoMet, setVideoMet] = useState(false);
  const activitiesMet =
    !autoComplete.requireAllActivities || autoComplete.pendingActivityCount === 0;
  const [scrollMet, setScrollMet] = useState(false);
  // Prevent double-fire within one page load. /complete is idempotent server-
  // side via eventKey dedup, but no need for noisy network either.
  const firedRef = useRef(false);
  // Once the API call resolves we briefly show the success state before
  // refreshing — gives the learner visual confirmation.
  const [justCompleted, setJustCompleted] = useState(false);

  const fireComplete = useCallback(
    async (
      reason: "watched_threshold" | "all_activities_completed" | "scrolled_to_end",
    ) => {
      if (completed || firedRef.current) return;
      firedRef.current = true;
      try {
        const res = await fetch(apiUrl(`/api/lessons/${lessonId}/complete`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setCompleted(true);
          setJustCompleted(true);
          // Give the success state ~1s of stage time before reloading so the
          // learner registers what happened.
          setTimeout(() => {
            if (data?.courseCompleted) {
              window.location.href = `/learn/${courseSlug}`;
            } else {
              router.refresh();
            }
          }, 1000);
        } else {
          firedRef.current = false;
        }
      } catch {
        firedRef.current = false;
      }
    },
    [completed, courseSlug, lessonId, router],
  );

  // Video watch tracker. Listens on every <video> in the document; first one
  // to cross threshold wins (typical lesson has one main video, multi-video
  // lessons treat any single one as "engaged enough"). Best-effort: simple
  // currentTime/duration ratio — proper segment tracking is a follow-up.
  useEffect(() => {
    if (!autoComplete.requireVideoWatch || completed) return;
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) return;
    const ratios = new Map<HTMLVideoElement, number>();
    const onTime = (e: Event) => {
      const v = e.target as HTMLVideoElement;
      if (!v.duration || !Number.isFinite(v.duration) || v.duration === 0) return;
      const prev = ratios.get(v) ?? 0;
      const ratio = Math.min(1, v.currentTime / v.duration);
      if (ratio > prev) ratios.set(v, ratio);
      const max = Math.max(...ratios.values(), 0);
      setVideoRatio(max);
      if (max >= autoComplete.videoThresholdPct / 100) {
        setVideoMet(true);
      }
    };
    for (const v of videos) v.addEventListener("timeupdate", onTime);
    return () => {
      for (const v of videos) v.removeEventListener("timeupdate", onTime);
    };
  }, [autoComplete.requireVideoWatch, autoComplete.videoThresholdPct, completed]);

  // Scroll-to-end via the sentinel rendered by the lesson page.
  useEffect(() => {
    if (!autoComplete.requireScrollToEnd || completed) return;
    const sentinel = document.getElementById("lesson-end-sentinel");
    if (!sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setScrollMet(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [autoComplete.requireScrollToEnd, completed]);

  // AND-combine + fire.
  useEffect(() => {
    if (completed || firedRef.current) return;
    const videoOK = !autoComplete.requireVideoWatch || videoMet;
    const activitiesOK = !autoComplete.requireAllActivities || activitiesMet;
    const scrollOK = !autoComplete.requireScrollToEnd || scrollMet;
    if (!(videoOK && activitiesOK && scrollOK)) return;
    const reason: "watched_threshold" | "all_activities_completed" | "scrolled_to_end" =
      autoComplete.requireScrollToEnd &&
      !autoComplete.requireVideoWatch &&
      !autoComplete.requireAllActivities
        ? "scrolled_to_end"
        : autoComplete.requireVideoWatch
          ? "watched_threshold"
          : "all_activities_completed";
    void fireComplete(reason);
  }, [
    activitiesMet,
    autoComplete.requireAllActivities,
    autoComplete.requireScrollToEnd,
    autoComplete.requireVideoWatch,
    completed,
    fireComplete,
    scrollMet,
    videoMet,
  ]);

  // Already completed before this page load — don't show the prompt at all.
  // The bottom bar shows the "Đã hoàn thành" badge.
  if (completed && !justCompleted) return null;

  // Build the checklist rows. Each row has: icon, label (with live progress
  // sub-text where useful), done state.
  const rows: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    detail?: string;
    done: boolean;
  }> = [];

  if (autoComplete.requireVideoWatch) {
    const pct = Math.round(videoRatio * 100);
    rows.push({
      key: "video",
      icon: <Video size={16} />,
      label: `Xem ít nhất ${autoComplete.videoThresholdPct}% video`,
      detail: videoMet ? undefined : `Đã xem ${pct}%`,
      done: videoMet,
    });
  }
  if (autoComplete.requireAllActivities) {
    const done = autoComplete.totalActivityCount - autoComplete.pendingActivityCount;
    rows.push({
      key: "activities",
      icon: <ListChecks size={16} />,
      label: "Hoàn thành các hoạt động",
      detail: activitiesMet
        ? undefined
        : `${done}/${autoComplete.totalActivityCount} đã xong — còn ${autoComplete.pendingActivityCount}`,
      done: activitiesMet,
    });
  }
  if (autoComplete.requireScrollToEnd) {
    rows.push({
      key: "scroll",
      icon: <ScrollText size={16} />,
      label: "Đọc hết nội dung bài",
      detail: scrollMet ? undefined : "Cuộn xuống cuối trang",
      done: scrollMet,
    });
  }

  // No tracker applied (shouldn't happen — server always picks at least one,
  // but defensive). Render nothing.
  if (rows.length === 0) return null;

  // Success state — briefly shown before the page refreshes.
  if (justCompleted) {
    return (
      <div className="mb-6 rounded-2xl border-2 border-success-200 bg-success-50 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-600 text-white">
            <Check size={20} strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-sm font-semibold text-success-800">
              Hoàn thành bài học!
            </p>
            <p className="text-xs text-success-700">
              Đang lưu tiến độ và tải lại trang…
            </p>
          </div>
        </div>
      </div>
    );
  }

  const allDone = rows.every((r) => r.done);

  return (
    <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-soft/40 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-brand-800">
            {allDone
              ? "Đang đánh dấu hoàn thành…"
              : "Để hoàn thành bài học này, bạn cần:"}
          </h2>
          <ul className="mt-2.5 space-y-1.5">
            {rows.map((r) => (
              <li
                key={r.key}
                className={`flex items-start gap-2.5 text-sm ${
                  r.done ? "text-success-700" : "text-[rgb(var(--text))]"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    r.done
                      ? "bg-success-600 text-white"
                      : "bg-[rgb(var(--surface))] text-[rgb(var(--text-muted))] ring-1 ring-token"
                  }`}
                >
                  {r.done ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    <CircleDashed size={12} />
                  )}
                </span>
                <span className="flex-1">
                  <span className={r.done ? "line-through opacity-70" : ""}>
                    {r.label}
                  </span>
                  {r.detail && (
                    <span className="ml-2 text-xs text-[rgb(var(--text-muted))]">
                      ({r.detail})
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[rgb(var(--text-muted))]">
                  {r.icon}
                </span>
              </li>
            ))}
          </ul>
          {!allDone && (
            <p className="mt-3 text-[11px] text-[rgb(var(--text-muted))]">
              Hệ thống sẽ tự đánh dấu hoàn thành khi bạn đạt đủ các mục trên.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
