import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse, isAdmin, listSubmissionsForInstructor } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import RosterTable from "./RosterTable";
import { EmptyState } from "@/components/ui";

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
          <RosterTable roster={roster} maxScore={assignment.maxScore} />
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
