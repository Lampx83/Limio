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
        <p className="rounded border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Bạn không có quyền xem trang này.
        </p>
      </main>
    );
  }

  const submissions = await listSubmissionsForInstructor(userId, params.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href={`/instructor/courses/${courseId}`}
        className="text-sm underline"
      >
        ← {assignment.lesson.module.course.title}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">📋 {assignment.title}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Lesson: {assignment.lesson.title} · Max {assignment.maxScore} điểm
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Bài nộp ({submissions.length})
        </h2>
        {submissions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Chưa có học viên nào nộp bài.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {submissions.map((s) => (
              <li
                key={s.id}
                className={`rounded-lg border p-4 ${
                  s.status === "graded"
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                    : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <p className="font-medium">{s.user.displayName}</p>
                  <span className="text-xs text-slate-500">
                    {new Date(s.submittedAt).toLocaleString("vi-VN")} ·{" "}
                    {s.status === "graded" ? "đã chấm" : "chưa chấm"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{s.user.email}</p>
                <details className="mt-3" open={s.status !== "graded"}>
                  <summary className="cursor-pointer text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Nội dung bài nộp
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap rounded bg-white p-3 text-sm dark:bg-slate-900">
                    {s.body}
                  </p>
                  {s.attachmentUrl && (
                    <p className="mt-2 text-xs">
                      📎{" "}
                      <a
                        href={s.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {s.attachmentUrl}
                      </a>
                    </p>
                  )}
                </details>
                <div className="mt-3">
                  <GradeForm
                    submissionId={s.id}
                    maxScore={assignment.maxScore}
                    initialScore={s.score}
                    initialFeedback={s.feedback}
                    isGraded={s.status === "graded"}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
