import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse, isAdmin, listSubmissionsForInstructor } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import GradeForm from "./GradeForm";
import { EmptyState, UserAvatar, StatusBadge, DateTime } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/instructor/assignments/${params.id}/submissions`,
    );
  }
  const userId = session.user.id;

  const assignment = await prisma.assignment.findUnique({
    where: { id: params.id },
    include: {
      lesson: {
        include: {
          module: { include: { course: { select: { id: true, title: true } } } },
        },
      },
      tournamentMission: {
        include: {
          tournament: {
            select: { id: true, title: true, creatorId: true },
          },
        },
      },
    },
  });
  if (!assignment) notFound();

  // Resolve context: lesson-backed (course) or tournament-mission-backed.
  type Ctx =
    | { kind: "lesson"; courseId: string; courseTitle: string; lessonTitle: string; backHref: string; backLabel: string }
    | { kind: "tournament"; tournamentId: string; missionId: string; missionTitle: string; backHref: string; backLabel: string };
  let ctx: Ctx;
  if (assignment.lesson) {
    const courseId = assignment.lesson.module.course.id;
    if (!(await canEditCourse(userId, courseId))) {
      return (
        <main>
          <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
            Bạn không có quyền xem trang này.
          </div>
        </main>
      );
    }
    ctx = {
      kind: "lesson",
      courseId,
      courseTitle: assignment.lesson.module.course.title,
      lessonTitle: assignment.lesson.title,
      backHref: `/instructor/courses/${courseId}`,
      backLabel: assignment.lesson.module.course.title,
    };
  } else if (assignment.tournamentMission) {
    const tm = assignment.tournamentMission;
    const allowed = tm.tournament.creatorId === userId || (await isAdmin(userId));
    if (!allowed) {
      return (
        <main>
          <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
            Bạn không có quyền xem trang này.
          </div>
        </main>
      );
    }
    ctx = {
      kind: "tournament",
      tournamentId: tm.tournament.id,
      missionId: tm.id,
      missionTitle: tm.title,
      backHref: `/instructor/tournaments/${tm.tournament.id}/missions/${tm.id}/submissions`,
      backLabel: `${tm.tournament.title} · ${tm.title}`,
    };
  } else {
    notFound();
  }

  const submissions = await listSubmissionsForInstructor(userId, params.id);
  const gradedCount = submissions.filter((s) => s.status === "graded").length;
  const pendingCount = submissions.length - gradedCount;

  return (
    <main>
      <Link
        href={ctx.backHref}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← {ctx.backLabel}
      </Link>

      {/* Header */}
      <div className="mt-4">
        <span className="chip-brand">
          {ctx.kind === "tournament" ? "Mission" : "Bài tập"}
        </span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          {assignment.title}
        </h1>
        <p className="mt-2 text-muted">
          {ctx.kind === "lesson" ? (
            <>
              Lesson:{" "}
              <span className="font-medium text-[rgb(var(--text))]">
                {ctx.lessonTitle}
              </span>{" "}
              ·{" "}
            </>
          ) : (
            <>
              Tournament mission ·{" "}
            </>
          )}
          Max <span className="font-semibold">{assignment.maxScore}</span> điểm
        </p>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Tổng bài nộp" value={submissions.length} tone="brand" />
        <Stat
          label="Chờ chấm"
          value={pendingCount}
          tone={pendingCount > 0 ? "accent" : "success"}
        />
        <Stat label="Đã chấm" value={gradedCount} tone="success" />
      </div>

      {/* Submissions */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Bài nộp{" "}
          <span className="text-sm font-normal text-faint">
            ({submissions.length})
          </span>
        </h2>
        {submissions.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="📥"
              title="Chưa có học viên nào nộp bài"
              description="Khi học viên nộp bài, danh sách sẽ hiện ở đây để bạn chấm."
              actions={[
                { label: ctx.kind === "tournament" ? "Quay lại mission" : "Xem khoá học", href: ctx.backHref, variant: "secondary" },
              ]}
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {submissions.map((s) => {
              const isGraded = s.status === "graded";
              return (
                <li
                  key={s.id}
                  className={`overflow-hidden rounded-2xl border bg-[rgb(var(--surface))] shadow-card ${
                    isGraded ? "border-success-100" : "border-accent-200"
                  }`}
                >
                  <header
                    className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${
                      isGraded
                        ? "bg-success-50 text-success-700"
                        : "bg-accent-50 text-accent-700"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={s.user.displayName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {s.user.displayName}
                        </p>
                        <p className="mt-0.5 truncate text-xs opacity-80">
                          {s.user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs">
                      <StatusBadge
                        tone={isGraded ? "success" : "warning"}
                        pulse={!isGraded}
                      >
                        {isGraded ? "Đã chấm" : "Chờ chấm"}
                      </StatusBadge>
                      <DateTime value={s.submittedAt} format="datetime" className="opacity-70" />
                    </div>
                  </header>
                  <div className="p-5">
                    <details open={!isGraded}>
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted hover:text-[rgb(var(--text))]">
                        Nội dung bài nộp
                      </summary>
                      <p className="mt-3 whitespace-pre-wrap rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-sm">
                        {s.body}
                      </p>
                      {s.attachmentUrl && (
                        <a
                          href={s.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary btn-sm mt-3 inline-flex"
                        >
                          📎 Tải file đính kèm
                        </a>
                      )}
                    </details>
                    <div className="mt-4 border-t border-token pt-4">
                      <GradeForm
                        submissionId={s.id}
                        maxScore={assignment.maxScore}
                        initialScore={s.score}
                        initialFeedback={s.feedback}
                        isGraded={s.status === "graded"}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "accent" | "success";
}) {
  const toneClass = {
    brand: "text-brand-600",
    accent: "text-accent-600",
    success: "text-success-600",
  }[tone];
  return (
    <div className="card">
      <div className={`h-display text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted sm:text-sm">{label}</div>
    </div>
  );
}
