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
import SkipLessonBanner from "@/components/SkipLessonBanner";
import LessonForumSection from "@/components/LessonForumSection";
import AiTutorPanel from "@/components/AiTutorPanel";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";
import LessonTabs, { type TabKey } from "@/components/lesson/LessonTabs";
import LessonTasksTab, {
  type TaskItem,
} from "@/components/lesson/LessonTasksTab";
import LessonStickyActions from "@/components/lesson/LessonStickyActions";
import LessonCompletionPrompt from "@/components/lesson/LessonCompletionPrompt";
import LessonNotesDrawer from "@/components/lesson/LessonNotesDrawer";
import { isNativeVideoUrl } from "@/components/LessonContent";

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
      module: { include: { course: { select: { id: true, slug: true, title: true, priceCents: true, currency: true, version: true, status: true } } } },
      contentItems: { orderBy: { orderIndex: "asc" } },
      quizzes: {
        select: {
          id: true,
          title: true,
          isHidden: true,
          createdAt: true,
          cuepointOnly: true,
        },
      },
      assignments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          dueAt: true,
          maxScore: true,
          isHidden: true,
          createdAt: true,
          pedagogicalIntent: true,
          responseFormat: true,
          requireSelfRating: true,
          requireReflection: true,
          countsTowardGrade: true,
          submissions: {
            where: { userId },
            select: {
              id: true,
              status: true,
              submittedAt: true,
              score: true,
              feedback: true,
              selfRating: true,
              reflection: true,
            },
          },
        },
      },
    },
  });
  if (!lesson || lesson.module.course.slug !== params.slug) notFound();
  if (lesson.isHidden) notFound();

  const enrolled = await isUserEnrolled(userId, lesson.module.course.id);
  if (!enrolled) {
    if (lesson.previewable) {
      // Allow viewing — fall through and render as preview below
    } else {
      const paid = lesson.module.course.priceCents !== null && lesson.module.course.priceCents > 0;
      redirect(`/catalog/${params.slug}${paid ? "?paywall=1" : ""}`);
    }
  }

  const allLessons = await prisma.lesson.findMany({
    where: { module: { courseId: lesson.module.course.id } },
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: { id: true, title: true },
  });
  const idx = allLessons.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? allLessons[idx - 1]! : null;
  const next = idx < allLessons.length - 1 ? allLessons[idx + 1]! : null;

  // Preview mode: non-enrolled user accessing a previewable lesson.
  // Skip enrollment-dependent queries and render with a CTA banner.
  if (!enrolled) {
    const threads = await listThreadsForLesson(lesson.id);
    const course = lesson.module.course;
    const paid = course.priceCents !== null && course.priceCents > 0;
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        <Link href={`/catalog/${params.slug}`} className="link inline-flex items-center gap-1 text-sm">
          ← {course.title}
        </Link>
        {/* Preview banner */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-soft px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-brand-700">Bài học preview miễn phí</p>
            <p className="text-xs text-brand-600">
              {paid ? "Mua khoá học để truy cập toàn bộ nội dung." : "Đăng ký miễn phí để học toàn bộ khoá."}
            </p>
          </div>
          <a
            href={`/catalog/${params.slug}`}
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {paid ? "Xem khoá học" : "Đăng ký ngay"}
          </a>
        </div>
        <header className="mt-6">
          <span className="chip">{lesson.module.title}</span>
          <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">{lesson.title}</h1>
          {lesson.description && (
            <SafeHtml
              html={plainToRichHtml(lesson.description)}
              className="prose prose-sm mt-3 max-w-none text-muted dark:prose-invert"
            />
          )}
        </header>
        <div className="mt-8">
          <LessonContent
            items={lesson.contentItems
              .filter((c) => !c.isHidden)
              .map((c) => ({ id: c.id, type: c.type, payload: c.payload, orderIndex: c.orderIndex }))}
            courseId={course.id}
            lessonId={lesson.id}
          />
        </div>
        <LessonForumSection threads={threads} lessonId={lesson.id} courseSlug={params.slug} />
      </main>
    );
  }

  const enrollment = await prisma.enrollment.findUniqueOrThrow({
    where: { userId_courseId: { userId, courseId: lesson.module.course.id } },
  });

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

  const skipSuggestion = completedEvent
    ? null
    : await shouldSkipLesson(userId, lesson.id);

  // Visible tasks: quizzes (excluding hidden + cuepoint-only) + assignments,
  // merged & sorted by createdAt so the order matches what the instructor
  // authored. Quiz "status" comes from the user's best attempt.
  const visibleQuizzes = lesson.quizzes.filter(
    (q) => !q.isHidden && !q.cuepointOnly,
  );
  const visibleAssignments = lesson.assignments.filter((a) => !a.isHidden);

  const quizAttempts = visibleQuizzes.length
    ? await prisma.quizAttempt.findMany({
        where: { userId, quizId: { in: visibleQuizzes.map((q) => q.id) } },
        select: { quizId: true, status: true, scorePct: true, passed: true },
        orderBy: { startedAt: "desc" },
      })
    : [];
  const bestAttemptByQuiz = new Map<
    string,
    { passed: boolean | null; scorePct: number | null; attempted: boolean }
  >();
  for (const att of quizAttempts) {
    const cur = bestAttemptByQuiz.get(att.quizId);
    const score = att.scorePct ?? null;
    if (!cur) {
      bestAttemptByQuiz.set(att.quizId, {
        attempted: true,
        passed: att.passed ?? null,
        scorePct: score,
      });
    } else {
      // Keep "passed" sticky; otherwise prefer the higher score.
      const passed = cur.passed || (att.passed ?? false) ? true : cur.passed;
      const bestScore =
        score !== null && (cur.scorePct === null || score > cur.scorePct)
          ? score
          : cur.scorePct;
      bestAttemptByQuiz.set(att.quizId, {
        attempted: true,
        passed,
        scorePct: bestScore,
      });
    }
  }

  const tasks: TaskItem[] = [
    ...visibleQuizzes.map<TaskItem>((q) => {
      const best = bestAttemptByQuiz.get(q.id);
      return {
        kind: "quiz",
        id: q.id,
        title: q.title,
        attempted: best?.attempted ?? false,
        passed: best?.passed ?? null,
        scorePct: best?.scorePct ?? null,
        _sort: q.createdAt.getTime(),
      } as TaskItem & { _sort: number };
    }),
    ...visibleAssignments.map<TaskItem>((a) => ({
      kind: "assignment",
      id: a.id,
      title: a.title,
      description: a.description,
      dueAt: a.dueAt,
      maxScore: a.maxScore,
      pedagogicalIntent: a.pedagogicalIntent,
      responseFormat: a.responseFormat,
      requireSelfRating: a.requireSelfRating,
      requireReflection: a.requireReflection,
      submission: a.submissions[0]
        ? {
            status: a.submissions[0].status,
            submittedAt: a.submissions[0].submittedAt,
            score: a.submissions[0].score,
            feedback: a.submissions[0].feedback,
          }
        : null,
      _sort: a.createdAt.getTime(),
    }) as TaskItem & { _sort: number }),
  ]
    .sort((a, b) => (a as any)._sort - (b as any)._sort)
    .map(({ _sort, ...rest }: any) => rest);

  const tasksUndone =
    tasks.filter((t) =>
      t.kind === "quiz" ? !t.passed : t.submission?.status !== "graded",
    ).length;

  const defaultTab: TabKey = tasksUndone > 0 ? "tasks" : "forum";

  // Auto-complete criteria. Computed server-side because we already know all
  // the inputs here (content shape + per-user activity status). Client-side
  // tracker (LessonStickyActions) only handles the live signals we can't
  // determine from the server: ongoing video watch %, and scroll-to-end.
  //
  // Rules:
  //   - Video required iff the lesson has at least one native (<video>-playable)
  //     video ContentItem. Provider iframes (YouTube/Vimeo) can't be tracked.
  //   - Activities required iff the lesson has any visible quiz or assignment.
  //   - Scroll-to-end ONLY when neither video nor activities apply (text/PDF/
  //     embed lessons). Avoids forcing a scroll on lessons where the video or
  //     quiz already verifies engagement.
  const hasNativeVideo = lesson.contentItems.some(
    (c) =>
      c.type === "video" &&
      !c.isHidden &&
      isNativeVideoUrl(
        ((c.payload as { url?: string } | null)?.url ?? "") as string,
      ),
  );
  const hasAnyActivity =
    visibleQuizzes.length > 0 || visibleAssignments.length > 0;
  // Pending = quizzes not yet passed + assignments without any submission.
  const pendingActivityCount =
    visibleQuizzes.filter((q) => !(bestAttemptByQuiz.get(q.id)?.passed === true))
      .length +
    visibleAssignments.filter((a) => a.submissions.length === 0).length;
  const totalActivityCount = visibleQuizzes.length + visibleAssignments.length;
  const autoCompleteConfig = {
    requireVideoWatch: hasNativeVideo,
    videoThresholdPct: lesson.completionThresholdPct ?? 80,
    requireAllActivities: hasAnyActivity,
    pendingActivityCount,
    totalActivityCount,
    // Scroll fallback only when there's no other engagement signal to verify.
    requireScrollToEnd: !hasNativeVideo && !hasAnyActivity,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      {/* Breadcrumb + lesson meta */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Link
          href={`/learn/${params.slug}`}
          className="link inline-flex items-center gap-1 text-sm"
        >
          ← {lesson.module.course.title}
        </Link>
        <span className="text-xs text-faint">
          Bài {idx + 1} / {allLessons.length} · {progress.courseCompletionPct}% hoàn thành
        </span>
      </div>

      {/* Header */}
      <header className="mt-4">
        <span className="chip">{lesson.module.title}</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          {lesson.title}
        </h1>
        {lesson.description && (
          <SafeHtml
            html={plainToRichHtml(lesson.description)}
            className="prose prose-sm mt-3 max-w-none text-muted dark:prose-invert"
          />
        )}
      </header>

      {/* Lesson progress mini-bar */}
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
          style={{ width: `${progress.courseCompletionPct}%` }}
        />
      </div>

      {skipSuggestion?.shouldSkip && (
        <div className="mt-6">
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
        </div>
      )}

      {/*
        Completion prompt + auto-tracker. Mounted high so the learner sees what's
        still pending before scrolling into content. Self-hides once the lesson
        is already completed (server-rendered state via completedEvent).
      */}
      <div className="mt-6">
        <LessonCompletionPrompt
          lessonId={lesson.id}
          courseSlug={params.slug}
          initiallyCompleted={completedEvent !== null}
          autoComplete={autoCompleteConfig}
        />
      </div>

      {/* Lesson content */}
      <div className="mt-8">
        <LessonContent
          items={lesson.contentItems
            .filter((c) => !c.isHidden)
            .map((c) => ({
              id: c.id,
              type: c.type,
              payload: c.payload,
              orderIndex: c.orderIndex,
            }))}
          courseId={lesson.module.course.id}
          lessonId={lesson.id}
        />
      </div>

      <LessonTabs
        defaultTab={defaultTab}
        tabs={[
          { key: "tasks", label: "Bài tập", icon: "📝", count: tasksUndone },
          { key: "forum", label: "Thảo luận", icon: "💬", count: threads.length },
        ]}
      >
        {{
          tasks: (
            <LessonTasksTab items={tasks} courseSlug={params.slug} />
          ),
          forum: (
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
          ),
        }}
      </LessonTabs>

      <LessonNotesDrawer lessonId={lesson.id} />

      {/* Sentinel for scroll-to-end auto-complete tracker (text-only lessons). */}
      <div id="lesson-end-sentinel" aria-hidden className="h-px w-full" />

      <LessonStickyActions
        lessonId={lesson.id}
        courseSlug={params.slug}
        completed={completedEvent !== null}
        initialResumeSec={
          enrollment.lastLessonId === lesson.id
            ? enrollment.lastPositionSec ?? 0
            : 0
        }
        prevLessonId={prev?.id ?? null}
        prevTitle={prev?.title ?? null}
        nextLessonId={next?.id ?? null}
        nextTitle={next?.title ?? null}
      />

      <AiTutorPanel lessonId={lesson.id} />
    </main>
  );
}
