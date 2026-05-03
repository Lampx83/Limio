import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import {
  getCourseProgress,
  isUserEnrolled,
  listThreadsForLesson,
} from "@feedbackme/core-lms";
import { shouldSkipLesson } from "@feedbackme/core-feedback";
import { LearningEventType } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import LessonContent from "@/components/LessonContent";
import LessonActions, { LessonNotes } from "@/components/LessonActions";
import SkipLessonBanner from "@/components/SkipLessonBanner";
import AssignmentSubmitForm from "@/components/AssignmentSubmitForm";
import LessonForumSection from "@/components/LessonForumSection";
import AiTutorPanel from "@/components/AiTutorPanel";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: { slug: string; lessonId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/learn/${params.slug}/lessons/${params.lessonId}`);
  }
  const userId = session.user.id;

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: {
      module: { include: { course: true } },
      contentItems: { orderBy: { orderIndex: "asc" } },
      quizzes: { select: { id: true, title: true } },
      assignments: {
        orderBy: { createdAt: "asc" },
        include: {
          submissions: {
            where: { userId },
            select: {
              id: true,
              status: true,
              submittedAt: true,
              score: true,
              feedback: true,
            },
          },
        },
      },
    },
  });
  if (!lesson || lesson.module.course.slug !== params.slug) notFound();

  if (!(await isUserEnrolled(userId, lesson.module.course.id))) {
    redirect(`/catalog/${params.slug}`);
  }

  // Find prev/next lesson by walking modules in orderIndex order.
  const allLessons = await prisma.lesson.findMany({
    where: { module: { courseId: lesson.module.course.id } },
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: { id: true, title: true },
  });
  const idx = allLessons.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? allLessons[idx - 1]! : null;
  const next = idx < allLessons.length - 1 ? allLessons[idx + 1]! : null;

  const enrollment = await prisma.enrollment.findUniqueOrThrow({
    where: { userId_courseId: { userId, courseId: lesson.module.course.id } },
  });

  // Check if this lesson is already completed.
  const completedEvent = await prisma.learningEvent.findFirst({
    where: {
      userId,
      courseId: lesson.module.course.id,
      eventType: LearningEventType.LessonCompleted,
      eventKey: `lesson.completed:${userId}:${lesson.id}`,
    },
  });

  const progress = await getCourseProgress(userId, lesson.module.course.id);
  const threads = await listThreadsForLesson(lesson.id);

  // B4 — show skip banner only when this lesson hasn't been completed yet AND
  // the learner has mastered all of its tagged skills.
  const skipSuggestion = completedEvent
    ? null
    : await shouldSkipLesson(userId, lesson.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/learn/${params.slug}`} className="text-sm underline">
        ← {lesson.module.course.title}
      </Link>
      <p className="mt-3 text-xs text-slate-500">
        {lesson.module.title} · {idx + 1} / {allLessons.length} · {progress.courseCompletionPct}% hoàn
        thành
      </p>
      <h1 className="mt-1 text-3xl font-bold">{lesson.title}</h1>
      {lesson.description && (
        <p className="mt-2 text-slate-600 dark:text-slate-400">{lesson.description}</p>
      )}

      {skipSuggestion?.shouldSkip && (
        <SkipLessonBanner
          lessonId={lesson.id}
          courseSlug={params.slug}
          nextLessonId={next?.id ?? null}
          masteries={skipSuggestion.masteries.map((m) => ({
            skillCode: m.skillCode,
            skillName: m.skillName,
            masteryProbability: m.masteryProbability,
          }))}
        />
      )}

      <div className="mt-6">
        <LessonContent
          items={lesson.contentItems.map((c) => ({
            id: c.id,
            type: c.type,
            payload: c.payload,
            orderIndex: c.orderIndex,
          }))}
          courseId={lesson.module.course.id}
          lessonId={lesson.id}
        />
      </div>

      {lesson.quizzes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Bài kiểm tra</h2>
          <ul className="mt-3 space-y-2">
            {lesson.quizzes.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/learn/${params.slug}/quizzes/${q.id}`}
                  className="inline-block rounded border border-slate-300 px-3 py-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                >
                  📝 {q.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lesson.assignments.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">📋 Assignments</h2>
          <ul className="mt-3 space-y-4">
            {lesson.assignments.map((a) => {
              const sub = a.submissions[0] ?? null;
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-slate-300 p-4 dark:border-slate-700"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{a.title}</p>
                    <span className="text-xs text-slate-500">
                      max {a.maxScore}đ
                      {a.dueAt && (
                        <>
                          {" · hạn "}
                          {new Date(a.dueAt).toLocaleString("vi-VN")}
                        </>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                    {a.description}
                  </p>
                  {sub?.status === "graded" && (
                    <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-900/20">
                      <p className="font-medium text-emerald-900 dark:text-emerald-100">
                        ✅ Đã chấm: {sub.score} / {a.maxScore} điểm
                      </p>
                      {sub.feedback && (
                        <p className="mt-1 whitespace-pre-wrap text-emerald-800 dark:text-emerald-200">
                          {sub.feedback}
                        </p>
                      )}
                    </div>
                  )}
                  {sub?.status === "submitted" && (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                      ⏳ Đã nộp lúc{" "}
                      {new Date(sub.submittedAt).toLocaleString("vi-VN")} — chờ
                      chấm điểm
                    </p>
                  )}
                  <AssignmentSubmitForm assignmentId={a.id} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <LessonActions
        lessonId={lesson.id}
        courseSlug={params.slug}
        initiallyCompleted={completedEvent !== null}
        initialResumeSec={
          enrollment.lastLessonId === lesson.id ? enrollment.lastPositionSec ?? 0 : 0
        }
        nextLessonId={next?.id ?? null}
      />

      <LessonNotes lessonId={lesson.id} />

      <LessonForumSection
        lessonId={lesson.id}
        courseSlug={params.slug}
        threads={threads.map((t) => ({
          id: t.id,
          title: t.title,
          body: t.body,
          resolvedPostId: t.resolvedPostId,
          createdAt: t.createdAt,
          author: { displayName: t.author.displayName },
          _count: { posts: t._count.posts },
        }))}
      />

      <nav className="mt-10 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
        {prev ? (
          <Link
            href={`/learn/${params.slug}/lessons/${prev.id}`}
            className="text-sm hover:underline"
          >
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/learn/${params.slug}/lessons/${next.id}`}
            className="text-sm hover:underline"
          >
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <AiTutorPanel lessonId={lesson.id} />
    </main>
  );
}
