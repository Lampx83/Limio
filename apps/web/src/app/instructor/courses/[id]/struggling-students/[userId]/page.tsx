import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StudentMisconceptionsPage({
  params,
}: {
  params: { id: string; userId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/struggling-students/${params.userId}`,
    );
  }
  const me = session.user.id;

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, title: true },
  });
  if (!course) notFound();

  if (!(await canEditCourse(me, course.id))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Bạn không có quyền xem trang này.
        </p>
      </main>
    );
  }

  const student = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, displayName: true, email: true },
  });
  if (!student) notFound();

  // Course-scoped misconceptions: only those tested by some quiz option in this
  // course's quizzes.
  const courseMcOpts = await prisma.questionOption.findMany({
    where: {
      misconceptionId: { not: null },
      question: { quiz: { courseId: course.id } },
    },
    select: {
      misconceptionId: true,
      label: true,
      question: { select: { id: true, prompt: true, quiz: { select: { title: true } } } },
    },
  });
  const courseMcIds = Array.from(
    new Set(
      courseMcOpts
        .map((o) => o.misconceptionId)
        .filter((x): x is string => x !== null),
    ),
  );

  const flags = courseMcIds.length === 0
    ? []
    : await prisma.misconceptionFlag.findMany({
        where: {
          userId: student.id,
          misconceptionId: { in: courseMcIds },
        },
        include: {
          misconception: { select: { id: true, code: true, name: true, description: true } },
        },
        orderBy: [{ resolved: "asc" }, { lastDetectedAt: "desc" }],
      });

  // Group trap options by misconceptionId for display.
  const trapsByMc = new Map<
    string,
    Array<{ questionId: string; prompt: string; quizTitle: string; wrongLabel: string }>
  >();
  for (const o of courseMcOpts) {
    if (!o.misconceptionId) continue;
    const arr = trapsByMc.get(o.misconceptionId) ?? [];
    arr.push({
      questionId: o.question.id,
      prompt: o.question.prompt,
      quizTitle: o.question.quiz.title,
      wrongLabel: o.label,
    });
    trapsByMc.set(o.misconceptionId, arr);
  }

  const unresolved = flags.filter((f) => !f.resolved);
  const resolved = flags.filter((f) => f.resolved);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href={`/instructor/courses/${course.id}/struggling-students`}
        className="text-sm underline"
      >
        ← Tất cả học viên
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        {student.displayName}{" "}
        <span className="text-base font-normal text-slate-500">— {course.title}</span>
      </h1>
      <p className="mt-1 text-sm text-slate-500">{student.email}</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Lỗi tư duy chưa khắc phục ({unresolved.length})
        </h2>
        {unresolved.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Học viên này hiện không còn lỗi tư duy nào trong khóa.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {unresolved.map((f) => {
              const traps = trapsByMc.get(f.misconceptionId) ?? [];
              return (
                <li
                  key={f.id}
                  className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{f.misconception.name}</p>
                    <span className="text-xs text-slate-500">
                      {f.count} lần · gần nhất {new Date(f.lastDetectedAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  {f.misconception.description && (
                    <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
                      {f.misconception.description}
                    </p>
                  )}
                  {traps.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-amber-800 hover:underline dark:text-amber-200">
                        Xem {traps.length} câu đã bẫy lỗi này
                      </summary>
                      <ul className="mt-2 space-y-2 text-sm">
                        {traps.map((t, i) => (
                          <li
                            key={`${t.questionId}-${i}`}
                            className="rounded bg-white p-2 dark:bg-slate-900"
                          >
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              {t.quizTitle}
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap">{t.prompt}</p>
                            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                              Đáp án bẫy: <span className="font-mono">{t.wrongLabel}</span>
                            </p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {resolved.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">
            Đã khắc phục ({resolved.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {resolved.map((f) => (
              <li
                key={f.id}
                className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-900/20"
              >
                <span className="text-emerald-900 dark:text-emerald-100">
                  ✓ {f.misconception.name}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  {f.resolvedAt
                    ? `khắc phục ${new Date(f.resolvedAt).toLocaleString("vi-VN")}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
