import Link from "next/link";
import AssignmentSubmitForm from "@/components/AssignmentSubmitForm";
import WritingFeedbackPanel, { type LearnerFeedbackState } from "@/components/WritingFeedbackPanel";
import SpeakingFeedbackPanel, { type LearnerSpeakingState } from "@/components/SpeakingFeedbackPanel";
import SafeHtml from "@/components/SafeHtml";
import ContributionNoteEditor from "@/components/lesson/ContributionNoteEditor";
import { DateTime } from "@/components/ui";
import { COURSE_TEAM_ANCHOR } from "@/components/course/courseTeamAnchor";
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
  /** Nộp theo nhóm: một người nộp, cả nhóm có bài (docs/group-submission-AC.md C). */
  submissionMode?: "individual" | "team";
  submission: {
    id: string;
    status: string;
    submittedAt: Date | null;
    score: number | null;
    feedback: string | null;
    /** G6 — chỉ có ở khoá ngoại ngữ (và lớp không phải đối chứng): cho phép nhận góp ý AI. */
    writingFeedback?: { enabled: true; initial: LearnerFeedbackState | null };
    /** G7 — bài nộp dạng ghi âm ở khoá ngoại ngữ (không phải lớp đối chứng): góp ý bài nói. */
    speakingFeedback?: { enabled: true; initial: LearnerSpeakingState | null };
    /** Bài nộp nhóm: có teamId; ai nộp lần cuối, lúc nào; "Phần việc của tôi". */
    teamId?: string | null;
    teamSubmittedAt?: Date | null;
    submittedByName?: string | null;
    contributionNote?: string | null;
  } | null;
};

/** Nhóm của học viên trong khoá — chỉ có khi bài học có bài tập nộp theo nhóm. */
export type TeamContext = {
  team: { id: string; name: string } | null;
  /** Danh sách nhóm đã khoá: học viên không tự vào/đổi nhóm được nữa. */
  locked: boolean;
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

function AssignmentCard({
  item,
  courseSlug,
  teamContext,
}: {
  item: AssignmentItem;
  courseSlug: string;
  teamContext: TeamContext | null;
}) {
  const sub = item.submission;
  const isTeam = item.submissionMode === "team";
  const hasTeam = !!teamContext?.team;
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
              {isTeam && (
                <span className="chip-brand mr-1.5 px-2 py-0 text-[11px]">Bài tập nhóm</span>
              )}
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

        {isTeam && sub?.teamSubmittedAt && (
          <p className="text-meta mt-3">
            Nộp lần cuối bởi{" "}
            <span className="font-medium text-[rgb(var(--text))]">{sub.submittedByName ?? "một thành viên"}</span>{" "}
            lúc <DateTime value={sub.teamSubmittedAt.toISOString()} />
          </p>
        )}

        {sub?.status === "graded" && sub.feedback && (
          <div className="mt-3 rounded-lg border border-success-100 bg-success-50 p-3">
            <p className="text-xs font-semibold text-success-700">Nhận xét</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-success-700/90">
              {sub.feedback}
            </p>
          </div>
        )}

        {sub?.speakingFeedback?.enabled && (
          <div className="mt-4">
            <SpeakingFeedbackPanel submissionId={sub.id} initial={sub.speakingFeedback.initial} />
          </div>
        )}

        {sub?.writingFeedback?.enabled && (
          <div className="mt-4">
            <WritingFeedbackPanel submissionId={sub.id} initial={sub.writingFeedback.initial} />
          </div>
        )}

        {isTeam && sub?.teamId && (
          <div className="mt-4">
            <ContributionNoteEditor submissionId={sub.id} initialNote={sub.contributionNote ?? null} />
          </div>
        )}

        <div className="mt-4">
          {isTeam && !hasTeam ? (
            <div className="banner-info flex-col gap-1">
              <p>Bài tập này nộp theo nhóm. Bạn cần vào một nhóm trước khi nộp.</p>
              {teamContext?.locked ? (
                <p className="text-meta">Danh sách nhóm đã khoá — bạn liên hệ giảng viên để được xếp nhóm.</p>
              ) : (
                <Link href={`/learn/${courseSlug}#${COURSE_TEAM_ANCHOR}`} className="link text-sm font-medium">
                  Tạo hoặc vào nhóm →
                </Link>
              )}
            </div>
          ) : (
            <AssignmentSubmitForm
              assignmentId={item.id}
              pedagogicalIntent={item.pedagogicalIntent}
              responseFormat={item.responseFormat}
              requireSelfRating={item.requireSelfRating}
              requireReflection={item.requireReflection}
              {...(isTeam && {
                teamMode: true,
                teamName: teamContext?.team?.name ?? null,
                alreadyGraded: sub?.status === "graded",
              })}
            />
          )}
        </div>
      </div>
    </details>
  );
}

export default function LessonTasksTab({
  items,
  courseSlug,
  teamContext = null,
}: {
  items: TaskItem[];
  courseSlug: string;
  teamContext?: TeamContext | null;
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
            <AssignmentCard item={it} courseSlug={courseSlug} teamContext={teamContext} />
          )}
        </li>
      ))}
    </ul>
  );
}
