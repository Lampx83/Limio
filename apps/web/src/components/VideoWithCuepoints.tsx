"use client";

/**
 * Native <video> player that pauses at cuepoints and forces a quiz pass
 * before allowing the learner to continue.
 *
 * Behavior:
 *   - timeupdate: when currentTime first crosses an unpassed cuepoint,
 *     pause + show overlay with the cuepoint quiz's questions.
 *   - seeking: if the learner seeks PAST an unpassed cuepoint, snap
 *     them back to that cuepoint's atSec.
 *   - overlay submit: POST to /api/quizzes/[quizId]/inline-grade.
 *     If allCorrect → mark cuepoint passed in local state (and the
 *     server emitted `video.cuepoint.passed`), close overlay, resume.
 *     If not → highlight wrong rows, allow retry without re-pause.
 *
 * Limitations (MVP):
 *   - Provider iframes (YouTube/Vimeo/...) are NOT supported here —
 *     the parent component should only mount this for native files.
 *   - Inline overlay supports MCQ + true_false only. Other question
 *     types render a "open quiz fullscreen" link (TODO).
 *   - Cuepoint pass state is in-memory: a page reload re-prompts.
 *     Persisting per learner across sessions is a follow-up.
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

export interface Cuepoint {
  atSec: number;
  quizId: string;
}

interface LearnerOption {
  id: string;
  label: string;
  orderIndex: number;
}
interface LearnerQuestion {
  id: string;
  type: string;
  prompt: string;
  options: LearnerOption[];
}
interface LearnerQuiz {
  id: string;
  title: string;
  description: string | null;
  questions: LearnerQuestion[];
}

interface ActiveCuepoint {
  cuepoint: Cuepoint;
  quiz: LearnerQuiz;
  startedAt: number;
  attemptCount: number;
}

interface Props {
  /** Source URL — same-origin path or absolute http(s). */
  url: string;
  /** Cuepoints in any order; we sort & dedupe internally. */
  cuepoints: Cuepoint[];
  /** Owning ContentItem id — sent in the cuepoint event payload. */
  contentItemId: string;
  /** Lesson the video is in — sent in the cuepoint event payload. */
  lessonId: string;
}

export default function VideoWithCuepoints({
  url,
  cuepoints,
  contentItemId,
  lessonId,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Sorted cuepoints (defensive — instructor UI sorts on save, but the
  // payload is plain JSON so we can't trust ordering at read time).
  const sortedCuepoints = [...cuepoints].sort((a, b) => a.atSec - b.atSec);

  // Cuepoints the learner has already cleared in this session.
  const [passed, setPassed] = useState<Set<number>>(new Set());
  // Currently-shown overlay (null = none active).
  const [active, setActive] = useState<ActiveCuepoint | null>(null);
  // Cached quiz payloads keyed by quizId. Populated lazily on first hit.
  const quizCacheRef = useRef<Map<string, LearnerQuiz>>(new Map());
  // Per-question selections in the active overlay.
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [grading, setGrading] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, "correct" | "wrong"> | null>(
    null,
  );

  /** Returns the next cuepoint at-or-after `t` that hasn't been passed. */
  function nextPendingCuepoint(t: number): Cuepoint | null {
    for (const c of sortedCuepoints) {
      if (passed.has(c.atSec)) continue;
      if (c.atSec <= t) return c;
    }
    return null;
  }

  async function loadQuiz(quizId: string): Promise<LearnerQuiz | null> {
    const cached = quizCacheRef.current.get(quizId);
    if (cached) return cached;
    try {
      const res = await fetch(apiUrl(`/api/quizzes/${quizId}/learner`));
      if (!res.ok) return null;
      const data = (await res.json()) as { quiz: LearnerQuiz };
      quizCacheRef.current.set(quizId, data.quiz);
      return data.quiz;
    } catch {
      return null;
    }
  }

  async function triggerCuepoint(cp: Cuepoint) {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    const quiz = await loadQuiz(cp.quizId);
    if (!quiz) {
      toast.error("Không tải được quiz cho cuepoint này — bỏ qua.");
      // Mark passed so we don't re-trigger this cuepoint forever.
      setPassed((p) => new Set(p).add(cp.atSec));
      v.play().catch(() => {});
      return;
    }
    setActive({
      cuepoint: cp,
      quiz,
      startedAt: Date.now(),
      attemptCount: 0,
    });
    setSelections({});
    setFeedback(null);
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    function onTimeUpdate() {
      if (!v) return;
      if (active) return;
      const cp = nextPendingCuepoint(v.currentTime);
      if (cp) void triggerCuepoint(cp);
    }
    function onSeeking() {
      if (!v) return;
      // If learner seeks past an unpassed cuepoint, snap back.
      const target = v.currentTime;
      const blocking = sortedCuepoints.find(
        (c) => !passed.has(c.atSec) && c.atSec < target,
      );
      if (blocking) {
        v.currentTime = blocking.atSec;
        if (!active) void triggerCuepoint(blocking);
      }
    }

    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("seeking", onSeeking);
    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("seeking", onSeeking);
    };
    // We deliberately depend on `passed` so re-binding picks up the latest
    // set; `active` so we don't re-trigger while overlay open.
  }, [passed, active, sortedCuepoints]);

  function toggleSelection(qid: string, optionId: string, single: boolean) {
    setSelections((prev) => {
      const current = prev[qid] ?? [];
      if (single) return { ...prev, [qid]: [optionId] };
      return current.includes(optionId)
        ? { ...prev, [qid]: current.filter((x) => x !== optionId) }
        : { ...prev, [qid]: [...current, optionId] };
    });
  }

  async function submitOverlay() {
    if (!active) return;
    const v = videoRef.current;
    setGrading(true);
    setFeedback(null);
    const responses = active.quiz.questions
      .filter((q) => q.type === "mcq" || q.type === "true_false")
      .map((q) => ({
        questionId: q.id,
        // gradeAnswer expects array of selected option ids for mcq/true_false.
        response: selections[q.id] ?? [],
      }));
    if (responses.length === 0) {
      // Quiz has no auto-gradable questions — nothing to validate, let them through.
      setGrading(false);
      setPassed((p) => new Set(p).add(active.cuepoint.atSec));
      setActive(null);
      v?.play().catch(() => {});
      return;
    }
    const nextAttemptCount = active.attemptCount + 1;
    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/quizzes/${active.quiz.id}/inline-grade`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses,
          context: {
            contentItemId,
            lessonId,
            atSec: active.cuepoint.atSec,
            attemptCount: nextAttemptCount,
            totalDurationMs: Date.now() - active.startedAt,
          },
        }),
      });
    } catch (err) {
      console.error("[VideoWithCuepoints] inline-grade network", err);
      setGrading(false);
      toast.error("Không kết nối được tới server, thử lại.");
      return;
    }
    setGrading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(`Lỗi chấm điểm: ${(d as { error?: string }).error ?? res.status}`);
      return;
    }
    const data = (await res.json()) as {
      results: Array<{ questionId: string; isCorrect: boolean }>;
      allCorrect: boolean;
    };
    const fb: Record<string, "correct" | "wrong"> = {};
    for (const r of data.results) fb[r.questionId] = r.isCorrect ? "correct" : "wrong";
    setFeedback(fb);

    if (data.allCorrect) {
      toast.success("Đúng rồi — xem tiếp nào");
      setPassed((p) => new Set(p).add(active.cuepoint.atSec));
      setActive(null);
      v?.play().catch(() => {});
    } else {
      toast.error("Chưa đúng — chọn lại và thử đến khi đúng để xem tiếp.");
      // Bump attempt count; learner can re-submit.
      setActive({ ...active, attemptCount: nextAttemptCount });
    }
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={url}
        controls
        className="aspect-video w-full rounded-xl bg-black shadow-card"
        preload="metadata"
      />
      {sortedCuepoints.length > 0 && (
        <p className="mt-1 text-[11px] text-faint">
          Có {sortedCuepoints.length} câu hỏi gài trong video — phải trả lời đúng để xem tiếp.
        </p>
      )}
      {active && (
        <CuepointOverlay
          quiz={active.quiz}
          atSec={active.cuepoint.atSec}
          attemptCount={active.attemptCount}
          selections={selections}
          feedback={feedback}
          grading={grading}
          onToggle={toggleSelection}
          onSubmit={submitOverlay}
        />
      )}
    </div>
  );
}

function CuepointOverlay({
  quiz,
  atSec,
  attemptCount,
  selections,
  feedback,
  grading,
  onToggle,
  onSubmit,
}: {
  quiz: LearnerQuiz;
  atSec: number;
  attemptCount: number;
  selections: Record<string, string[]>;
  feedback: Record<string, "correct" | "wrong"> | null;
  grading: boolean;
  onToggle: (qid: string, optionId: string, single: boolean) => void;
  onSubmit: () => void;
}) {
  const mm = String(Math.floor(atSec / 60)).padStart(2, "0");
  const ss = String(Math.floor(atSec % 60)).padStart(2, "0");

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-xl border border-token bg-[rgb(var(--surface))] shadow-card-hover">
        <div className="border-b border-token px-5 pb-3 pt-5">
          <header className="flex items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">{quiz.title}</h3>
            <span className="font-mono text-xs text-muted">@ {mm}:{ss}</span>
          </header>
          {quiz.description && (
            <p className="mt-1 text-sm text-muted">{quiz.description}</p>
          )}
          <p className="mt-2 text-xs text-muted">
            Trả lời đúng tất cả để xem tiếp video.
            {attemptCount > 0 && (
              <span> Lần thử: {attemptCount}.</span>
            )}
          </p>
        </div>

        <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {quiz.questions.map((q, idx) => {
            const supported = q.type === "mcq" || q.type === "true_false";
            const single = q.type === "true_false";
            const fb = feedback?.[q.id];
            return (
              <li
                key={q.id}
                className={`rounded-lg border p-3 ${
                  fb === "correct"
                    ? "border-success-500 bg-success-50"
                    : fb === "wrong"
                      ? "border-danger-500 bg-danger-50"
                      : "border-token"
                }`}
              >
                <p className="text-sm font-medium">
                  <span className="mr-1 text-faint">{idx + 1}.</span>
                  {q.prompt}
                </p>
                {supported ? (
                  <div className="mt-2 space-y-1.5">
                    {q.options.map((o) => {
                      const checked = (selections[q.id] ?? []).includes(o.id);
                      return (
                        <label
                          key={o.id}
                          className="flex cursor-pointer items-center gap-2 rounded border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm hover:bg-brand-soft"
                        >
                          <input
                            type={single ? "radio" : "checkbox"}
                            name={q.id}
                            checked={checked}
                            onChange={() => onToggle(q.id, o.id, single)}
                          />
                          <span>{o.label}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 rounded border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-700">
                    Câu hỏi loại "{q.type}" tạm chưa hỗ trợ trả lời inline. Mở quiz đầy đủ để trả lời, sau đó player sẽ cho qua.
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-token px-5 py-3">
          {feedback && Object.values(feedback).some((f) => f === "wrong") && (
            <p className="mr-auto text-sm font-medium text-danger-700">
              Chưa đúng — chọn lại và thử đến khi đúng để xem tiếp.
            </p>
          )}
          <button
            type="button"
            data-view-keep
            disabled={grading}
            onClick={onSubmit}
            className="btn-primary btn-sm"
          >
            {grading ? "Đang chấm..." : feedback ? "Thử lại" : "Trả lời"}
          </button>
        </div>
      </div>
    </div>
  );
}
