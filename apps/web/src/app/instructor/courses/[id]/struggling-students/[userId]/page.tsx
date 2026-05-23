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
      <main>
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Bạn không có quyền xem trang này.
        </div>
      </main>
    );
  }

  const student = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, displayName: true, email: true },
  });
  if (!student) notFound();

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
    <main>
      <Link
        href={`/instructor/courses/${course.id}/struggling-students`}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Tất cả học viên
      </Link>

      {/* Student header */}
      <header className="mt-4 flex items-start gap-4 card">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-base font-semibold text-white shadow-sm">
          {student.displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <span className="chip-brand">Hồ sơ học viên</span>
          <h1 className="mt-2 h-display text-2xl font-bold sm:text-3xl">
            {student.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted">{student.email}</p>
          <p className="mt-1 text-xs text-faint">{course.title}</p>
        </div>
      </header>

      {/* Unresolved */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Lỗi tư duy chưa khắc phục{" "}
          <span className="text-sm font-normal text-faint">
            ({unresolved.length})
          </span>
        </h2>
        {unresolved.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-token p-8 text-center text-sm text-muted">
            Học viên này hiện không còn lỗi tư duy nào trong khóa.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {unresolved.map((f) => {
              const traps = trapsByMc.get(f.misconceptionId) ?? [];
              return (
                <li
                  key={f.id}
                  className="rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-transparent p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">{f.misconception.name}</p>
                    <span className="text-xs text-faint">
                      {f.count} lần · gần nhất{" "}
                      {new Date(f.lastDetectedAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  {f.misconception.description && (
                    <p className="mt-2 text-sm text-accent-800">
                      {f.misconception.description}
                    </p>
                  )}
                  {traps.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-accent-700 hover:underline">
                        Xem {traps.length} câu đã bẫy lỗi này
                      </summary>
                      <ul className="mt-3 space-y-2">
                        {traps.map((t, i) => (
                          <li
                            key={`${t.questionId}-${i}`}
                            className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3 text-sm"
                          >
                            <p className="text-xs font-medium uppercase tracking-wide text-faint">
                              {t.quizTitle}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{t.prompt}</p>
                            <p className="mt-2 text-xs text-danger-700">
                              Đáp án bẫy:{" "}
                              <span className="font-mono">{t.wrongLabel}</span>
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

      {/* Resolved */}
      {resolved.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">
            ✓ Đã khắc phục{" "}
            <span className="text-sm font-normal text-faint">
              ({resolved.length})
            </span>
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {resolved.map((f) => (
              <li
                key={f.id}
                className="flex items-start gap-2 rounded-xl border border-success-100 bg-success-50 p-3"
              >
                <span className="text-success-600">✓</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-success-700">
                    {f.misconception.name}
                  </p>
                  {f.resolvedAt && (
                    <p className="mt-0.5 text-xs text-success-700/70">
                      Khắc phục {new Date(f.resolvedAt).toLocaleString("vi-VN")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
