import Link from "next/link";
import AssignmentSubmitForm from "@/components/AssignmentSubmitForm";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";
import type {
  GenerativeActivityType,
  ResponseFormat,
} from "@/lib/generativeActivity";
import { formatDateTime } from "@/lib/datetime";

export type QuizItem = {
  kind: "quiz";
  id: string;
  title: string;
  attempted: boolean;
  scorePct: number | null;
};

export type AssignmentItem = {
  kind: "assignment";
  id: string;
  title: string;
  description: string;
  dueAt: Date | null;
  maxScore: number;
  pedagogicalIntent: GenerativeActivityType | null;
  responseFormat: ResponseFormat;
  requireSelfRating: boolean;
  requireReflection: boolean;
  submission: {
    status: string;
    submittedAt: Date | null;
    score: number | null;
    feedback: string | null;
  } | null;
};

export type TaskItem = QuizItem | AssignmentItem;

function StatusChip({
  variant,
  children,
}: {
  variant: "todo" | "submitted" | "graded" | "failed";
  children: React.ReactNode;
}) {
  const styles: Record<typeof variant, string> = {
    todo: "bg-[rgb(var(--surface-muted))] text-[rgb(var(--text-muted))]",
    submitted: "bg-accent-50 text-accent-700",
    graded: "bg-success-50 text-success-700",
    failed: "bg-danger-50 text-danger-700",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

function QuizCard({ item, courseSlug }: { item: QuizItem; courseSlug: string }) {
  const chip = !item.attempted ? (
    <StatusChip variant="todo">Chưa làm</StatusChip>
  ) : (
    <StatusChip variant="graded">
      Đã làm {item.scorePct !== null ? `· ${Math.round(item.scorePct)}%` : ""}
    </StatusChip>
  );

  return (
    <Link
      href={`/learn/${courseSlug}/quizzes/${item.id}`}
      className="card-hover group flex items-center justify-between gap-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
        >
          📝
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium transition-colors group-hover:text-brand-600">
            {item.title}
          </p>
          <p className="text-xs text-faint">Quiz</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {chip}
        <span aria-hidden className="text-brand-600">
          →
        </span>
      </div>
    </Link>
  );
}

function AssignmentCard({ item }: { item: AssignmentItem }) {
  const sub = item.submission;
  const chip = !sub ? (
    <StatusChip variant="todo">Chưa nộp</StatusChip>
  ) : sub.status === "graded" ? (
    <StatusChip variant="graded">
      ✓ Đã chấm {sub.score !== null ? `· ${sub.score}/${item.maxScore}` : ""}
    </StatusChip>
  ) : (
    <StatusChip variant="submitted">Đã nộp · chờ chấm</StatusChip>
  );

  return (
    <details className="card group/details">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          >
            📄
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="text-xs text-faint">
              Assignment · max {item.maxScore}đ
              {item.dueAt && (
                <> · hạn {formatDateTime(item.dueAt)}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {chip}
          <span
            aria-hidden
            className="text-faint transition-transform group-open/details:rotate-90"
          >
            ›
          </span>
        </div>
      </summary>

      <div className="mt-4 border-t border-token pt-4">
        {item.description && (
          <SafeHtml
            html={plainToRichHtml(item.description)}
            className="prose prose-sm max-w-none text-muted dark:prose-invert"
          />
        )}

        {sub?.status === "graded" && sub.feedback && (
          <div className="mt-3 rounded-lg border border-success-100 bg-success-50 p-3">
            <p className="text-xs font-semibold text-success-700">Nhận xét</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-success-700/90">
              {sub.feedback}
            </p>
          </div>
        )}

        <div className="mt-4">
          <AssignmentSubmitForm
            assignmentId={item.id}
            pedagogicalIntent={item.pedagogicalIntent}
            responseFormat={item.responseFormat}
            requireSelfRating={item.requireSelfRating}
            requireReflection={item.requireReflection}
          />
        </div>
      </div>
    </details>
  );
}

export default function LessonTasksTab({
  items,
  courseSlug,
}: {
  items: TaskItem[];
  courseSlug: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-token px-4 py-8 text-center text-sm text-faint">
        Bài học này chưa có bài tập nào.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={`${it.kind}:${it.id}`}>
          {it.kind === "quiz" ? (
            <QuizCard item={it} courseSlug={courseSlug} />
          ) : (
            <AssignmentCard item={it} />
          )}
        </li>
      ))}
    </ul>
  );
}
