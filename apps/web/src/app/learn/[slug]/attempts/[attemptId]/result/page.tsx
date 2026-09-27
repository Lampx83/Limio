import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getAttemptResult, QuizError } from "@feedbackme/core-lms";
import {
  getDeliveriesForAttempt,
  getLearningPath,
  recordPathShown,
} from "@feedbackme/core-feedback";
import { LearningEventType } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import FeedbackRater from "@/components/FeedbackRater";
import RemediationLink from "@/components/RemediationLink";
import LearningPathList from "@/components/LearningPathList";
import MasteryBadge from "@/components/MasteryBadge";
import SafeHtml from "@/components/SafeHtml";
import AnswerBreakdown from "@/components/quiz/AnswerBreakdown";
import ConfidenceStars from "@/components/quiz/ConfidenceStars";
import { plainToRichHtml } from "@/lib/richText";

export const dynamic = "force-dynamic";

interface FeedbackByQuestion {
  deliveryId: string;
  body: string;
  rating: number | null;
  remediationLessonIds: string[];
}

export default async function ResultPage({
  params,
}: {
  params: { slug: string; attemptId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/learn/${params.slug}/attempts/${params.attemptId}/result`);
  }
  const userId = session.user.id;

  let result;
  try {
    result = await getAttemptResult(userId, params.attemptId);
  } catch (e) {
    if (e instanceof QuizError) {
      if (
        e.code === "attempt_not_found" ||
        e.code === "attempt_belongs_to_other"
      ) {
        notFound();
      }
    }
    throw e;
  }

  const correctCount = result.items.filter((i) => i.isCorrect).length;

  // B4 AC-2.9 — sau MỌI lần nộp (không chờ trượt 2 lần): nhãn của bài vừa làm
  // + bước tiếp theo trong lộ trình. Quiz không gắn bài thì chưa có nhãn để nói.
  const quizContext = await prisma.quiz.findUnique({
    where: { id: result.attempt.quizId },
    select: {
      courseId: true,
      lesson: { select: { id: true, title: true } },
    },
  });
  const pathLesson = quizContext?.lesson ?? null;
  const path =
    pathLesson && quizContext?.courseId
      ? await getLearningPath(userId, quizContext.courseId)
      : null;
  const pathLabel = path?.enabled && pathLesson ? path.labels[pathLesson.id] : undefined;
  const nextSteps = path?.enabled ? path.steps.slice(0, 1) : [];
  if (quizContext?.courseId && nextSteps.length > 0) {
    await recordPathShown(userId, quizContext.courseId, nextSteps, "quiz_result").catch(() => {});
  }

  const xpEvent = await prisma.learningEvent.findFirst({
    where: {
      userId,
      eventType: LearningEventType.XpAwarded,
      payload: { path: ["sourceId"], equals: params.attemptId },
    },
    orderBy: { occurredAt: "desc" },
  });
  const xpPayload = xpEvent?.payload as
    | {
        amount?: number;
        baseAmount?: number;
        adaptiveMultiplier?: number;
        avgMastery?: number | null;
      }
    | undefined;

  const resolvedEvents = await prisma.learningEvent.findMany({
    where: {
      userId,
      eventType: LearningEventType.MisconceptionResolved,
      payload: { path: ["attemptId"], equals: params.attemptId },
    },
    orderBy: { occurredAt: "asc" },
  });
  const resolvedMcIds = Array.from(
    new Set(
      resolvedEvents.flatMap((e) => {
        const p = e.payload as { misconceptionId?: string } | null;
        return p?.misconceptionId ? [p.misconceptionId] : [];
      }),
    ),
  );
  const resolvedMcs = resolvedMcIds.length
    ? await prisma.misconception.findMany({
        where: { id: { in: resolvedMcIds } },
        select: { id: true, name: true, code: true },
      })
    : [];

  const resolvedXpEvents =
    resolvedMcIds.length === 0
      ? []
      : await prisma.learningEvent.findMany({
          where: {
            userId,
            eventType: LearningEventType.XpAwarded,
            payload: { path: ["attemptId"], equals: params.attemptId },
          },
        });
  const resolvedXpTotal = resolvedXpEvents.reduce((acc, e) => {
    const p = e.payload as { reason?: string; amount?: number } | null;
    if (p?.reason === "misconception.resolved" && typeof p.amount === "number") {
      return acc + p.amount;
    }
    return acc;
  }, 0);

  // B11 — lời chào ở đầu trang, một lần cho cả lượt làm bài. Gọi tên để xưng
  // hô, không để đánh giá: feedback cấp `self` (khen/chê con người) là cấp mà
  // Hattie & Timperley cảnh báo có thể làm giảm học tập.
  const learner = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });
  const greetName = learner?.displayName?.trim() || null;

  // B11 — nút "hỏi thêm" dẫn về bài học chứa quiz, nơi AI tutor đang sống.
  const quizLesson = await prisma.quiz.findUnique({
    where: { id: result.attempt.quizId },
    select: { lessonId: true },
  });

  const deliveries = await getDeliveriesForAttempt(userId, params.attemptId);
  const feedbackByQuestion = new Map<string, FeedbackByQuestion>();
  for (const d of deliveries) {
    if (!d.questionId || feedbackByQuestion.has(d.questionId)) continue;
    feedbackByQuestion.set(d.questionId, {
      deliveryId: d.id,
      body: d.body,
      rating: d.rating,
      remediationLessonIds: Array.isArray(d.remediationLessonIds)
        ? (d.remediationLessonIds as unknown as string[])
        : [],
    });
  }

  const allRemediationIds = Array.from(
    new Set(
      [...feedbackByQuestion.values()].flatMap((f) => f.remediationLessonIds),
    ),
  );
  const lessonMap =
    allRemediationIds.length === 0
      ? new Map<string, { title: string; courseSlug: string }>()
      : new Map(
          (
            await prisma.lesson.findMany({
              where: { id: { in: allRemediationIds } },
              select: {
                id: true,
                title: true,
                module: { select: { course: { select: { slug: true } } } },
              },
            })
          ).map((l) => [
            l.id,
            { title: l.title, courseSlug: l.module.course.slug },
          ]),
        );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <Link
        href={`/learn/${params.slug}`}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Quay lại khóa học
      </Link>

      {/* Hero score */}
      <section
        className="relative mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-8 text-white shadow-card-hover"
      >
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/15 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 -left-12 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative">
          {greetName && (
            <p className="mt-3 text-lg font-semibold">Chào {greetName},</p>
          )}
          <p className="mt-4 h-display text-6xl font-bold tabular-nums">
            {result.attempt.scorePct?.toFixed(1) ?? "—"}
            <span className="text-3xl opacity-70">%</span>
          </p>
          <p className="mt-2 text-sm opacity-90">
            {correctCount}/{result.items.length} câu đúng
          </p>
          {xpPayload?.amount !== undefined && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 backdrop-blur">
              <span className="text-lg"></span>
              <span className="font-semibold">+{xpPayload.amount} XP</span>
              {xpPayload.adaptiveMultiplier !== undefined &&
                xpPayload.adaptiveMultiplier !== 1 && (
                  <span className="text-xs opacity-80">
                    · ×{xpPayload.adaptiveMultiplier}
                    {xpPayload.adaptiveMultiplier < 1
                      ? " (đã master)"
                      : " (skill khó · bonus)"}
                  </span>
                )}
            </div>
          )}
        </div>
      </section>

      {/* Misconceptions resolved */}
      {resolvedMcs.length > 0 && (
        <div className="mt-6 rounded-2xl border border-success-100 bg-success-50 p-5">
          <p className="text-sm font-semibold text-success-700">
            Bạn vừa khắc phục {resolvedMcs.length} lỗi tư duy
            {resolvedXpTotal > 0 && (
              <span className="ml-2 text-accent-700">+{resolvedXpTotal} XP</span>
            )}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-success-700/90">
            {resolvedMcs.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="text-success-600">✓</span>
                {m.name}
              </li>
            ))}
          </ul>
          {resolvedXpTotal === 0 && resolvedMcs.length > 0 && (
            <p className="mt-3 text-xs italic text-success-700/70">
              (Đã thưởng XP cho lần khắc phục đầu tiên — lần này không cộng thêm.)
            </p>
          )}
        </div>
      )}

      {/* B4 — lộ trình: nhãn bài vừa làm + bước tiếp theo */}
      {pathLesson && pathLabel && (
        <section className="mt-6 rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-card">
          <p className="text-meta">Mức nắm vững sau lần làm này</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="break-words font-semibold">{pathLesson.title}</span>
            <MasteryBadge label={pathLabel} />
          </div>
          {nextSteps.length > 0 ? (
            <>
              <p className="text-meta mt-4">Bước tiếp theo</p>
              <div className="mt-2">
                <LearningPathList
                  steps={nextSteps}
                  courseSlug={params.slug}
                  surface="quiz_result"
                />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Bạn đã đi hết lộ trình của khoá này.
            </p>
          )}
          <Link href={`/learn/${params.slug}`} className="link mt-3 inline-block text-sm">
            Xem cả lộ trình →
          </Link>
        </section>
      )}

      {/* Per-question results */}
      <ol className="mt-8 space-y-4">
        {result.items.map((item, i) => {
          const fb = feedbackByQuestion.get(item.questionId);
          const isCorrect = item.isCorrect;
          return (
            <li
              key={item.questionId}
              className={`overflow-hidden rounded-2xl border bg-[rgb(var(--surface))] shadow-card ${
                isCorrect ? "border-success-100" : "border-danger-100"
              }`}
            >
              <header
                className={`flex items-center justify-between gap-3 px-5 py-3 ${
                  isCorrect
                    ? "bg-success-50 text-success-700"
                    : "bg-danger-50 text-danger-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      isCorrect ? "bg-success-500 text-white" : "bg-danger-500 text-white"
                    }`}
                  >
                    {isCorrect ? "✓" : "✗"}
                  </span>
                  <span className="text-sm font-semibold">
                    Câu {i + 1} · {item.points} điểm
                  </span>
                </div>
                {item.confidence !== null && (
                  <span className="flex items-center gap-1.5 text-xs opacity-80">
                    Tự tin:
                    <ConfidenceStars value={item.confidence} readOnly size={14} />
                  </span>
                )}
              </header>

              <div className="p-5">
                <SafeHtml
                  html={plainToRichHtml(item.prompt)}
                  className="prose prose-sm max-w-none font-medium dark:prose-invert"
                />

                {/* Bạn đã chọn gì, đáp án đúng là gì — đặt TRƯỚC phản hồi và
                    giải thích, vì cả hai đều nói về những phương án này. */}
                <AnswerBreakdown item={item} />

                {!isCorrect && fb && (
                  <div className="mt-4 rounded-xl bg-danger-50 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-danger-700">
                        Phản hồi
                      </p>
                      <FeedbackRater
                        deliveryId={fb.deliveryId}
                        initialRating={fb.rating}
                      />
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-danger-700/90">
                      {fb.body}
                    </p>
                    {quizLesson?.lessonId && (
                      <Link
                        href={`/learn/${params.slug}/lessons/${quizLesson.lessonId}?hoi=${encodeURIComponent(
                          `Mình vừa làm sai câu: “${item.prompt.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)}”. ` +
                            `Bạn giải thích giúp mình vì sao đáp án mình chọn lại chưa đúng nhé.`,
                        )}`}
                        className="mt-3 inline-flex items-center gap-1 rounded-lg border border-danger-200 bg-[rgb(var(--surface))] px-3 py-1.5 text-xs font-medium text-danger-700 transition-colors hover:bg-danger-50"
                      >
                        Chỗ này mình chưa rõ — hỏi thêm
                      </Link>
                    )}
                    {fb.remediationLessonIds.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-danger-700">
                          Tài liệu nên xem lại
                        </p>
                        <ul className="mt-2 space-y-1">
                          {fb.remediationLessonIds.map((lid) => {
                            const l = lessonMap.get(lid);
                            if (!l) return null;
                            return (
                              <li key={lid}>
                                {/* B9.2 — records uptake without delaying the click. */}
                                <RemediationLink
                                  deliveryId={fb.deliveryId}
                                  lessonId={lid}
                                  href={`/learn/${l.courseSlug}/lessons/${lid}`}
                                  className="inline-flex items-center gap-1 text-sm font-medium text-danger-700 underline-offset-2 hover:underline"
                                >
                                  {l.title}
                                </RemediationLink>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* B11 — câu sai đã có giải thích ghép sẵn trong khối phản hồi;
                    hiện lại ở đây là bắt đọc hai lần. */}
                {item.explanation && !fb && (
                  <div className="mt-4 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Giải thích
                    </p>
                    <SafeHtml
                      html={plainToRichHtml(item.explanation)}
                      className="prose prose-sm mt-1.5 max-w-none dark:prose-invert"
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
