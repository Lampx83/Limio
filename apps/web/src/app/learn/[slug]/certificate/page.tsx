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
        <Link href={`/learn/${params.slug}`} className="text-sm underline">
          ← {course.title}
        </Link>
        <p className="mt-6 rounded border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          Bạn chưa hoàn thành khóa này ({progress.courseCompletionPct}%). Hãy
          hoàn thành tất cả bài học để nhận chứng nhận.
        </p>
      </main>
    );
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { displayName: true, email: true },
  });

  // Find when the course was completed — first CourseCompleted event for this
  // user + course.
  const completedEvent = await prisma.learningEvent.findFirst({
    where: {
      userId,
      courseId: course.id,
      eventType: LearningEventType.CourseCompleted,
    },
    orderBy: { occurredAt: "asc" },
  });
  const completedAt = completedEvent?.occurredAt ?? new Date();

  // Earned skill-master badges in this course (D4) — most relevant signal.
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/learn/${params.slug}`} className="text-sm underline">
        ← {course.title}
      </Link>

      <article className="mt-6 rounded-2xl border-4 border-double border-amber-400 bg-gradient-to-br from-amber-50 to-white p-10 text-center shadow-md dark:from-amber-950/30 dark:to-slate-900">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700 dark:text-amber-300">
          🏆 Chứng nhận hoàn thành
        </p>
        <h1 className="mt-6 text-2xl font-semibold text-slate-700 dark:text-slate-300">
          Chứng nhận này được trao cho
        </h1>
        <p className="mt-3 text-4xl font-bold tracking-tight">
          {user.displayName}
        </p>
        <p className="mt-6 text-base text-slate-700 dark:text-slate-300">
          đã hoàn thành xuất sắc khóa học
        </p>
        <p className="mt-2 text-2xl font-semibold text-amber-800 dark:text-amber-200">
          {course.title}
        </p>
        {course.description && (
          <p className="mt-2 text-sm italic text-slate-500">
            {course.description.length > 200
              ? course.description.slice(0, 200) + "…"
              : course.description}
          </p>
        )}

        {skillBadges.length > 0 && (
          <div className="mt-8">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Skill master đã đạt
            </p>
            <ul className="mt-2 flex flex-wrap justify-center gap-2">
              {skillBadges.map((sb) => (
                <li
                  key={sb.id}
                  className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
                >
                  {sb.badge.emoji} {sb.badge.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <div className="text-left">
            <p className="text-xs uppercase tracking-wide">Hoàn thành ngày</p>
            <p className="mt-1 font-medium">
              {new Date(completedAt).toLocaleDateString("vi-VN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide">Mã chứng nhận</p>
            <p className="mt-1 font-mono text-xs">{certNumber}</p>
          </div>
        </div>
      </article>

      <p className="mt-6 text-center text-xs text-slate-500">
        Để in: <kbd className="rounded border px-1">Cmd/Ctrl+P</kbd> · Mã trên dùng
        để verify chứng nhận.
      </p>
    </main>
  );
}
