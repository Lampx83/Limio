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

  const roster = await listSubmissionsForInstructor(userId, params.id);
  const submittedRows = roster.filter((r) => r.submission !== null);
  const gradedCount = submittedRows.filter(
    (r) => r.submission!.status === "graded",
  ).length;
  const pendingCount = submittedRows.length - gradedCount;
  const notSubmittedCount = roster.length - submittedRows.length;

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
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Tổng học viên" value={roster.length} tone="brand" />
        <Stat
          label="Chưa nộp"
          value={notSubmittedCount}
          tone={notSubmittedCount > 0 ? "accent" : "success"}
        />
        <Stat
          label="Chờ chấm"
          value={pendingCount}
          tone={pendingCount > 0 ? "accent" : "success"}
        />
        <Stat label="Đã chấm" value={gradedCount} tone="success" />
      </div>

      {/* Roster: STT – Người nộp – Trạng thái, theo danh sách đăng ký khoá học */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Danh sách{" "}
          <span className="text-sm font-normal text-faint">
            ({roster.length})
          </span>
        </h2>
        {roster.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="👥"
              title={
                ctx.kind === "tournament"
                  ? "Chưa có ai nộp bài"
                  : "Khoá học chưa có học viên"
              }
              description={
                ctx.kind === "tournament"
                  ? "Khi có người tham gia nộp bài, danh sách sẽ hiện ở đây."
                  : "Chưa có học viên nào đăng ký khoá học này."
              }
              actions={[
                { label: ctx.kind === "tournament" ? "Quay lại mission" : "Xem khoá học", href: ctx.backHref, variant: "secondary" },
              ]}
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-token">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--surface-muted))] text-left text-xs text-faint">
                <tr className="border-b border-token">
                  <th className="px-3 py-2 font-medium">STT</th>
                  <th className="px-3 py-2 font-medium">Người nộp</th>
                  <th className="px-3 py-2 font-medium">Trạng thái</th>
                  <th className="px-3 py-2 font-medium">Ngày giờ nộp</th>
                  <th className="px-3 py-2 font-medium">Bài làm</th>
                  <th className="px-3 py-2 font-medium text-right">Điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {roster.map((r, i) => {
                  const s = r.submission;
                  const isGraded = s?.status === "graded";
                  return (
                    <tr key={r.user.id}>
                      <td className="px-3 py-2 tabular-nums text-muted">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <UserAvatar name={r.user.displayName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium leading-tight">
                              {r.user.displayName}
                            </p>
                            <p className="truncate text-xs text-faint">
                              {r.user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={s ? (isGraded ? "success" : "warning") : "neutral"}
                        >
                          {s ? "Đã nộp" : "Chưa nộp"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {s ? (
                          <DateTime value={s.submittedAt} format="datetime" />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {s ? (
                          <a href={`#s-${s.id}`} className="link text-xs">
                            Xem bài làm
                          </a>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {!s ? (
                          <span className="text-faint">—</span>
                        ) : isGraded ? (
                          <span className="font-semibold">
                            {s.score}/{assignment.maxScore}
                          </span>
                        ) : (
                          <span className="text-faint">Chưa chấm</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Chi tiết bài làm + chấm điểm */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Bài nộp{" "}
          <span className="text-sm font-normal text-faint">
            ({submittedRows.length})
          </span>
        </h2>
        {submittedRows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Chưa có bài nộp nào để chấm.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {submittedRows.map((r) => {
              const s = r.submission!;
              const isGraded = s.status === "graded";
              return (
                <li
                  id={`s-${s.id}`}
                  key={s.id}
                  className={`scroll-mt-20 overflow-hidden rounded-2xl border bg-[rgb(var(--surface))] shadow-card ${
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
                      <UserAvatar name={r.user.displayName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {r.user.displayName}
                        </p>
                        <p className="mt-0.5 truncate text-xs opacity-80">
                          {r.user.email}
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
