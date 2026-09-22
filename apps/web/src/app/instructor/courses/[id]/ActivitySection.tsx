"use client";

import { useMemo, useState } from "react";
import ContentItemRow from "./ContentItemRow";
import QuizSection from "./QuizSection";
import AssignmentSection from "./AssignmentSection";
import ActivityPicker from "./ActivityPicker";
import EmptyState from "./EmptyState";
import SortableModulesWrapper from "./SortableModulesWrapper";
import { apiUrl } from "@/lib/apiUrl";

interface ContentItem {
  id: string;
  type: string;
  payload: unknown;
  orderIndex: number;
  isHidden: boolean;
}
interface Quiz {
  id: string;
  title: string;
  difficulty: number | null;
  requireConfidence: boolean;
  timeLimitSec: number | null;
  maxAttempts: number | null;
  isHidden: boolean;
  questions: Array<{
    id: string;
    type: string;
    prompt: string;
    points: number;
    orderIndex: number;
    explanation: string | null;
    extra: unknown;
    options: Array<{
      id: string;
      label: string;
      isCorrect: boolean;
      orderIndex: number;
      misconceptionId: string | null;
      misconception: { id: string; code: string; name: string } | null;
      extra: unknown;
    }>;
    skillTags: Array<{
      skillId: string;
      skill: { code: string; name: string };
    }>;
  }>;
}
interface Assignment {
  id: string;
  title: string;
  description: string;
  dueAt: Date | null;
  maxScore: number;
  isHidden: boolean;
  pedagogicalIntent?:
    | "summarizing"
    | "mapping"
    | "drawing"
    | "imagining"
    | "self_explaining"
    | "teaching"
    | "enacting"
    | null;
  requireSelfRating?: boolean;
  requireReflection?: boolean;
  countsTowardGrade?: boolean;
  rubricText?: string | null;
}

interface LessonActivityRow {
  id: string;
  kind: "content" | "quiz" | "assignment";
  orderIndex: number;
  contentItemId: string | null;
  quizId: string | null;
  assignmentId: string | null;
}

export default function ActivitySection({
  lessonId,
  contentItems,
  quizzes,
  assignments,
  activities,
}: {
  lessonId: string;
  contentItems: ContentItem[];
  quizzes: Quiz[];
  assignments: Assignment[];
  // Unified ordered list. If empty (legacy data not yet backfilled),
  // fall back to the old fixed grouping: content → quiz → assignment.
  activities: LessonActivityRow[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Build a stable lookup so we can resolve each LessonActivity row to its
  // entity payload without re-fetching.
  const contentById = useMemo(
    () => new Map(contentItems.map((c) => [c.id, c])),
    [contentItems],
  );
  const quizById = useMemo(
    () => new Map(quizzes.map((q) => [q.id, q])),
    [quizzes],
  );
  const assignmentById = useMemo(
    () => new Map(assignments.map((a) => [a.id, a])),
    [assignments],
  );

  // Resolve the ordered render list. Drop any LessonActivity row whose
  // underlying entity vanished (defensive — cascade should prevent this).
  const ordered = useMemo(() => {
    if (activities.length === 0) {
      // Fallback: emulate the old display order so a lesson without backfill
      // still renders in a predictable sequence.
      return [
        ...contentItems.map((c) => ({ key: `c-${c.id}`, kind: "content" as const, content: c })),
        ...quizzes.map((q) => ({ key: `q-${q.id}`, kind: "quiz" as const, quiz: q })),
        ...assignments.map((a) => ({ key: `a-${a.id}`, kind: "assignment" as const, assignment: a })),
      ];
    }
    return activities
      .map((a) => {
        if (a.kind === "content" && a.contentItemId) {
          const c = contentById.get(a.contentItemId);
          if (!c) return null;
          return { key: a.id, kind: "content" as const, content: c };
        }
        if (a.kind === "quiz" && a.quizId) {
          const q = quizById.get(a.quizId);
          if (!q) return null;
          return { key: a.id, kind: "quiz" as const, quiz: q };
        }
        if (a.kind === "assignment" && a.assignmentId) {
          const ass = assignmentById.get(a.assignmentId);
          if (!ass) return null;
          return { key: a.id, kind: "assignment" as const, assignment: ass };
        }
        return null;
      })
      .filter(
        (
          row,
        ): row is
          | { key: string; kind: "content"; content: ContentItem }
          | { key: string; kind: "quiz"; quiz: Quiz }
          | { key: string; kind: "assignment"; assignment: Assignment } =>
          row !== null,
      );
  }, [activities, contentById, quizById, assignmentById, contentItems, quizzes, assignments]);

  const total = ordered.length;
  // Drag-drop only works when we have a real LessonActivity row per item.
  // In fallback mode (activities.length === 0) we render without drag handles.
  const dragEnabled = activities.length > 0;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-default">
        Hoạt động ({total})
      </h3>

      {total === 0 ? (
        <EmptyState
          icon="📭"
          title="Bài này chưa có hoạt động"
          description="Thêm video, văn bản, quiz, assignment, file đính kèm hoặc tài nguyên khác."
          cta={{
            label: "+ Thêm hoạt động/tài nguyên",
            onClick: () => setPickerOpen(true),
          }}
        />
      ) : dragEnabled ? (
        // Unified cross-type drag-drop. Each row's id = LessonActivity.id, which
        // is what the reorder endpoint expects.
        <SortableModulesWrapper
          items={ordered.map((row, i) => ({
            id: row.key,
            node: (
              <div className="flex items-start gap-2">
                <span className="w-6 flex-shrink-0 pt-2 text-right text-xs font-medium text-faint">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  {row.kind === "content" && <ContentItemRow item={row.content} lessonId={lessonId} />}
                  {row.kind === "quiz" && (
                    <QuizSection quiz={row.quiz} lessonId={lessonId} />
                  )}
                  {row.kind === "assignment" && (
                    <AssignmentSection assignment={row.assignment} />
                  )}
                </div>
              </div>
            ),
          }))}
          reorderEndpoint={apiUrl(`/api/lessons/${lessonId}/activities/reorder`)}
          payloadKey="orderedActivityIds"
        />
      ) : (
        // Legacy fallback — no LessonActivity rows yet. Renders the same items
        // in the old fixed-group order without drag handles. Should be rare
        // post-backfill; here only for resilience.
        <ol className="space-y-1.5">
          {ordered.map((row, i) => (
            <li key={row.key} className="flex items-start gap-2">
              <span className="w-6 flex-shrink-0 pt-2 text-right text-xs font-medium text-faint">
                {i + 1}.
              </span>
              <div className="min-w-0 flex-1">
                {row.kind === "content" && <ContentItemRow item={row.content} lessonId={lessonId} />}
                {row.kind === "quiz" && (
                  <QuizSection quiz={row.quiz} lessonId={lessonId} />
                )}
                {row.kind === "assignment" && (
                  <AssignmentSection assignment={row.assignment} />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {total > 0 && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-3 w-full rounded-xl border-2 border-dashed border-token py-3 text-sm font-medium text-muted transition-colors hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
        >
          + Thêm hoạt động/tài nguyên
        </button>
      )}

      <ActivityPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        lessonId={lessonId}
        nextContentOrderIndex={contentItems.length}
      />
    </section>
  );
}
