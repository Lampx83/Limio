import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse, listSubmissionsForInstructor } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import GradeForm from "./GradeForm";

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
    },
  });
  if (!assignment) notFound();

  const courseId = assignment.lesson.module.course.id;
  if (!(await canEditCourse(userId, courseId))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Bạn không có quyền xem trang này.
        </div>
      </main>
    );
  }

  const submissions = await listSubmissionsForInstructor(userId, params.id);
  const gradedCount = submissions.filter((s) => s.status === "graded").length;
  const pendingCount = submissions.length - gradedCount;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/instructor/courses/${courseId}`}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← {assignment.lesson.module.course.title}
      </Link>

      {/* Header */}
      <div className="mt-4">
        <span className="chip-brand">Bài tập</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          {assignment.title}
        </h1>
        <p className="mt-2 text-muted">
          Lesson:{" "}
          <span className="font-medium text-[rgb(var(--text))]">
            {assignment.lesson.title}
          </span>{" "}
          · Max <span className="font-semibold">{assignment.maxScore}</span> điểm
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
          <div className="mt-4 rounded-2xl border border-dashed border-token p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
                          </div>
            <p className="mt-4 text-muted">Chưa có học viên nào nộp bài.</p>
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
                    className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 ${
                      isGraded
                        ? "bg-success-50 text-success-700"
                        : "bg-accent-50 text-accent-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                        {s.user.displayName.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-semibold leading-tight">
                          {s.user.displayName}
                        </p>
                        <p className="mt-0.5 text-xs opacity-80">
                          {s.user.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-medium">
                        {isGraded ? "✓ Đã chấm" : "Chờ chấm"}
                      </p>
                      <p className="opacity-70">
                        {new Date(s.submittedAt).toLocaleString("vi-VN")}
                      </p>
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
                        <p className="mt-2 text-xs">
                          {" "}
                          <a
                            href={s.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link"
                          >
                            {s.attachmentUrl}
                          </a>
                        </p>
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
