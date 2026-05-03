import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getCourseProgress, isUserEnrolled } from "@feedbackme/core-lms";
import { LearningEventType } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CertificatePage({
  params,
}: {
  params: { slug: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/learn/${params.slug}/certificate`);
  }
  const userId = session.user.id;

  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    select: { id: true, title: true, description: true, language: true },
  });
  if (!course) notFound();
  if (!(await isUserEnrolled(userId, course.id))) {
    redirect(`/catalog/${params.slug}`);
  }

  const progress = await getCourseProgress(userId, course.id);
  if (progress.courseCompletionPct < 100) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href={`/learn/${params.slug}`}
          className="link inline-flex items-center gap-1 text-sm"
        >
          ← {course.title}
        </Link>
        <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-6">
          <p className="text-sm font-semibold text-accent-700">
            ⏳ Bạn chưa hoàn thành khóa này ({progress.courseCompletionPct}%)
          </p>
          <p className="mt-2 text-sm text-accent-700/90">
            Hãy hoàn thành tất cả bài học để nhận chứng nhận.
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/60">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
              style={{ width: `${progress.courseCompletionPct}%` }}
            />
          </div>
        </div>
      </main>
    );
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { displayName: true, email: true },
  });

  const completedEvent = await prisma.learningEvent.findFirst({
    where: {
      userId,
      courseId: course.id,
      eventType: LearningEventType.CourseCompleted,
    },
    orderBy: { occurredAt: "asc" },
  });
  const completedAt = completedEvent?.occurredAt ?? new Date();

  const skillBadges = await prisma.userBadge.findMany({
    where: {
      userId,
      badge: { category: "skill" },
      context: { path: ["courseId"], equals: course.id },
    },
    include: { badge: { select: { name: true, emoji: true } } },
  });

  const certNumber = `FBM-${course.id.slice(0, 8).toUpperCase()}-${userId.slice(0, 8).toUpperCase()}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 print:py-0">
      <Link
        href={`/learn/${params.slug}`}
        className="link inline-flex items-center gap-1 text-sm print:hidden"
      >
        ← {course.title}
      </Link>

      <article className="relative mt-6 overflow-hidden rounded-3xl border-4 border-double border-accent-400 bg-gradient-to-br from-accent-50 via-white to-brand-50 p-10 text-center shadow-card-hover sm:p-14 print:border-2 print:shadow-none">
        {/* Decorative corner glows */}
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-accent-200/40 blur-3xl" aria-hidden />
        <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />

        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1 text-xs font-bold uppercase tracking-[0.3em] text-accent-700 backdrop-blur">
            🏆 Chứng nhận hoàn thành
          </p>

          <h1 className="mt-8 h-display text-xl font-medium text-muted">
            Chứng nhận này được trao cho
          </h1>
          <p className="mt-3 h-display text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-gradient">{user.displayName}</span>
          </p>
          <p className="mt-6 text-base text-muted">
            đã hoàn thành xuất sắc khóa học
          </p>
          <p className="mt-2 h-display text-2xl font-semibold sm:text-3xl">
            {course.title}
          </p>
          {course.description && (
            <p className="mx-auto mt-3 max-w-xl text-sm italic text-faint">
              {course.description.length > 200
                ? course.description.slice(0, 200) + "…"
                : course.description}
            </p>
          )}

          {skillBadges.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Skill master đã đạt
              </p>
              <ul className="mt-3 flex flex-wrap justify-center gap-2">
                {skillBadges.map((sb) => (
                  <li
                    key={sb.id}
                    className="inline-flex items-center gap-1 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700"
                  >
                    <span>{sb.badge.emoji}</span>
                    {sb.badge.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-12 grid grid-cols-2 gap-6 border-t border-accent-200 pt-6 text-sm">
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Hoàn thành ngày
              </p>
              <p className="mt-1 font-semibold">
                {new Date(completedAt).toLocaleDateString("vi-VN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Mã chứng nhận
              </p>
              <p className="mt-1 font-mono text-xs">{certNumber}</p>
            </div>
          </div>
        </div>
      </article>

      <p className="mt-6 text-center text-xs text-faint print:hidden">
        Để in:{" "}
        <kbd className="rounded border border-token bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 font-mono">
          Cmd/Ctrl+P
        </kbd>{" "}
        · Mã trên dùng để verify chứng nhận.
      </p>
    </main>
  );
}
