"use client";

import { useState } from "react";
import ContentItemRow from "./ContentItemRow";
import QuizSection from "./QuizSection";
import AssignmentSection from "./AssignmentSection";
import ActivityPicker from "./ActivityPicker";
import EmptyState from "./EmptyState";

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
  passThresholdPct: number;
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
}

export default function ActivitySection({
  lessonId,
  contentItems,
  quizzes,
  assignments,
}: {
  lessonId: string;
  contentItems: ContentItem[];
  quizzes: Quiz[];
  assignments: Assignment[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const total = contentItems.length + quizzes.length + assignments.length;

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
      ) : (
        <ol className="space-y-1.5">
          {contentItems.map((item, i) => (
            <li key={`c-${item.id}`} className="flex items-start gap-2">
              <span className="w-6 flex-shrink-0 pt-2 text-right text-xs font-medium text-faint">
                {i + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <ContentItemRow item={item} />
              </div>
            </li>
          ))}
          {quizzes.map((q, i) => (
            <li key={`q-${q.id}`} className="flex items-start gap-2">
              <span className="w-6 flex-shrink-0 pt-2 text-right text-xs font-medium text-faint">
                {contentItems.length + i + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <QuizSection quiz={q} lessonId={lessonId} />
              </div>
            </li>
          ))}
          {assignments.map((a, i) => (
            <li key={`a-${a.id}`} className="flex items-start gap-2">
              <span className="w-6 flex-shrink-0 pt-2 text-right text-xs font-medium text-faint">
                {contentItems.length + quizzes.length + i + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <AssignmentSection assignment={a} />
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
