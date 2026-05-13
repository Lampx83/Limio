"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const MAX_BATCH = 20;
const AUTO_PICK_THRESHOLD = 0.7;

export type UntaggedLessonItem = {
  lessonId: string;
  lessonTitle: string;
  isHidden: boolean;
  courseId: string;
  courseTitle: string;
  courseStatus: string;
  moduleTitle: string;
};

type Suggestion = {
  skillId: string;
  skillCode: string;
  skillName: string;
  confidence: number;
  rationale: string;
};

type Result = {
  kind: "lesson";
  id: string;
  title: string;
  courseId: string;
  suggestions: Suggestion[];
  error?: string;
};

type Picks = Record<string, Record<string, boolean>>; // lessonId → skillId → checked

export default function BulkTagger({
  lessons,
}: {
  lessons: UntaggedLessonItem[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"idle" | "suggesting" | "review" | "applying">(
    "idle",
  );
  const [results, setResults] = useState<Result[]>([]);
  const [picks, setPicks] = useState<Picks>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const visibleIds = lessons.slice(0, MAX_BATCH).map((l) => l.lessonId);
      const allSelected = visibleIds.every((id) => next.has(id));
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectedCount = selected.size;
  const overLimit = selectedCount > MAX_BATCH;

  const runSuggest = async () => {
    if (selectedCount === 0 || overLimit) return;
    setPhase("suggesting");
    setError(null);
    try {
      const res = await fetch("/api/instructor/skill-tagging/suggest-batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonIds: Array.from(selected) }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        setPhase("idle");
        return;
      }
      setResults(body.results as Result[]);
      // Pre-pick suggestions with confidence ≥ threshold.
      const initial: Picks = {};
      for (const r of body.results as Result[]) {
        initial[r.id] = {};
        for (const s of r.suggestions) {
          initial[r.id]![s.skillId] = s.confidence >= AUTO_PICK_THRESHOLD;
        }
      }
      setPicks(initial);
      setPhase("review");
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  };

  const applyMappings = async () => {
    const mappings: Array<{
      contentType: "lesson";
      contentId: string;
      skillId: string;
    }> = [];
    for (const r of results) {
      const lessonPicks = picks[r.id] ?? {};
      for (const skillId of Object.keys(lessonPicks)) {
        if (lessonPicks[skillId]) {
          mappings.push({ contentType: "lesson", contentId: r.id, skillId });
        }
      }
    }
    if (mappings.length === 0) {
      setError("Chưa chọn skill nào để apply");
      return;
    }
    setPhase("applying");
    setError(null);
    try {
      const res = await fetch("/api/instructor/skill-tagging/apply-batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        setPhase("review");
        return;
      }
      setToast(
        `Đã tag ${body.createdLessons} mapping (skip ${body.skippedLessons} đã tồn tại)`,
      );
      setResults([]);
      setPicks({});
      setSelected(new Set());
      setPhase("idle");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPhase("review");
    }
  };

  const cancel = () => {
    setResults([]);
    setPicks({});
    setPhase("idle");
    setError(null);
  };

  const togglePick = (lessonId: string, skillId: string) => {
    setPicks((prev) => ({
      ...prev,
      [lessonId]: {
        ...(prev[lessonId] ?? {}),
        [skillId]: !(prev[lessonId]?.[skillId] ?? false),
      },
    }));
  };

  const totalPicked = useMemo(
    () =>
      Object.values(picks).reduce(
        (sum, p) => sum + Object.values(p).filter(Boolean).length,
        0,
      ),
    [picks],
  );

  if (lessons.length === 0) return null;

  return (
    <div className="mt-3">
      {/* Toast */}
      {toast && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-700">
          <CheckCircle2 size={16} /> {toast}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto text-xs underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface-muted))] px-3 py-2">
        <span className="text-sm">
          Đã chọn{" "}
          <span className={overLimit ? "font-semibold text-danger-600" : "font-semibold"}>
            {selectedCount}
          </span>
          /{MAX_BATCH}
        </span>
        {overLimit && (
          <span className="flex items-center gap-1 text-xs text-danger-600">
            <AlertTriangle size={12} /> Vượt giới hạn batch
          </span>
        )}
        <button
          type="button"
          onClick={toggleAllVisible}
          className="btn-ghost btn-sm ml-2"
        >
          Chọn {MAX_BATCH} đầu
        </button>
        <button
          type="button"
          onClick={runSuggest}
          disabled={selectedCount === 0 || overLimit || phase !== "idle"}
          className="btn-primary btn-sm ml-auto inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "suggesting" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {phase === "suggesting" ? "Đang gọi AI..." : "Gợi ý AI cho đã chọn"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Lesson list with checkboxes */}
      {phase !== "review" && (
        <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3">Lesson</th>
                <th className="px-4 py-3">Khoá / Module</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {lessons.map((l) => {
                const isLive = l.courseStatus === "published" && !l.isHidden;
                return (
                  <tr
                    key={l.lessonId}
                    className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                  >
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selected.has(l.lessonId)}
                        onChange={() => toggle(l.lessonId)}
                        className="h-4 w-4 cursor-pointer accent-amber-500"
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium">{l.lessonTitle}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-xs text-muted">{l.courseTitle}</p>
                      <p className="mt-0.5 text-xs text-faint">{l.moduleTitle}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {isLive ? (
                        <span className="chip-danger">Live · chưa tag</span>
                      ) : l.isHidden ? (
                        <span className="chip">Hidden</span>
                      ) : (
                        <span className="chip">Draft</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <Link
                        href={`/instructor/courses/${l.courseId}#lesson-${l.lessonId}`}
                        className="btn-ghost btn-sm"
                      >
                        Tag thủ công
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review panel — visible during "review" and while "applying" (spinner on Apply button) */}
      {(phase === "review" || phase === "applying") && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/10">
          <header className="flex items-baseline justify-between border-b border-amber-200 pb-3 dark:border-amber-900/40">
            <h3 className="font-semibold">
              AI gợi ý — Review {totalPicked} mapping sẽ được tag
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancel}
                className="btn-ghost btn-sm"
                disabled={phase === "applying"}
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={applyMappings}
                disabled={totalPicked === 0 || phase === "applying"}
                className="btn-primary btn-sm inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {phase === "applying" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Apply {totalPicked} tag
              </button>
            </div>
          </header>

          <div className="mt-4 space-y-4">
            {results.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-token bg-[rgb(var(--surface))] p-3"
              >
                <header className="flex items-baseline justify-between">
                  <p className="font-medium">{r.title}</p>
                  {r.error ? (
                    <span className="chip-danger text-[10px]">{r.error}</span>
                  ) : r.suggestions.length === 0 ? (
                    <span className="chip text-[10px]">Không có gợi ý</span>
                  ) : (
                    <span className="text-xs text-faint">
                      {r.suggestions.length} suggestion
                    </span>
                  )}
                </header>
                {r.suggestions.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {r.suggestions.map((s) => (
                      <li
                        key={s.skillId}
                        className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-[rgb(var(--surface-muted))]"
                      >
                        <input
                          type="checkbox"
                          checked={!!picks[r.id]?.[s.skillId]}
                          onChange={() => togglePick(r.id, s.skillId)}
                          className="mt-0.5 h-4 w-4 cursor-pointer accent-amber-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {s.skillName}
                            </span>
                            <code className="rounded bg-[rgb(var(--surface-muted))] px-1 text-[10px] text-faint">
                              {s.skillCode}
                            </code>
                            <span
                              className={`text-xs font-semibold tabular-nums ${
                                s.confidence >= 0.7
                                  ? "text-success-600"
                                  : s.confidence >= 0.4
                                    ? "text-accent-600"
                                    : "text-faint"
                              }`}
                            >
                              {(s.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          {s.rationale && (
                            <p className="mt-0.5 text-xs text-muted">
                              {s.rationale}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
