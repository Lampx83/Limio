import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getAttemptResult, QuizError } from "@feedbackme/core-lms";
import {
  getDeliveriesForAttempt,
  getRemedialSuggestion,
} from "@feedbackme/core-feedback";
import { LearningEventType } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import FeedbackRater from "@/components/FeedbackRater";

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
  const passed = result.attempt.passed ?? false;

  // B4 — remedial inject after consecutive failures.
  const remedial = passed
    ? null
    : await getRemedialSuggestion(userId, result.attempt.quizId);

  // D3 — read the xp.awarded event for this attempt to surface the adaptive
  // multiplier annotation. Null if no XP was granted (failed quiz, speed-run,
  // or capped).
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

  // B2.5 / D1 — misconceptions resolved by this very attempt. Each resolution
  // emits one MisconceptionResolved event keyed by attemptId, and one
  // XpAwarded event with reason="misconception.resolved" per first-time clear.
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

  // Pull all FeedbackDelivery rows persisted by core-feedback at submit time.
  // Pick the most recent one per questionId (deliveries are already DESC).
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

  // Resolve remediation lesson titles + slugs in one query.
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/learn/${params.slug}`} className="text-sm underline">
        ← Quay lại khóa học
      </Link>

      <div
        className={`mt-6 rounded-lg p-5 ${
          passed
            ? "bg-emerald-50 dark:bg-emerald-900/20"
            : "bg-amber-50 dark:bg-amber-900/20"
        }`}
      >
        <p className="text-sm uppercase tracking-wide text-slate-500">
          {passed ? "Đạt yêu cầu" : "Chưa đạt"}
        </p>
        <p className="mt-1 text-4xl font-bold">
          {result.attempt.scorePct?.toFixed(1) ?? "—"}%
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {correctCount}/{result.items.length} câu đúng
        </p>
        {xpPayload?.amount !== undefined && (
          <p className="mt-2 text-sm">
            <span className="font-medium text-amber-700 dark:text-amber-300">
              +{xpPayload.amount} XP
            </span>
            {xpPayload.adaptiveMultiplier !== undefined &&
              xpPayload.adaptiveMultiplier !== 1 && (
                <span className="ml-2 text-xs text-slate-600 dark:text-slate-400">
                  · ×{xpPayload.adaptiveMultiplier}
                  {xpPayload.adaptiveMultiplier < 1
                    ? " (đã master skill này)"
                    : " (skill khó với bạn — bonus)"}
                </span>
              )}
          </p>
        )}
      </div>

      {resolvedMcs.length > 0 && (
        <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            🌟 Bạn vừa khắc phục {resolvedMcs.length} lỗi tư duy
            {resolvedXpTotal > 0 && (
              <span className="ml-2 text-amber-700 dark:text-amber-300">
                +{resolvedXpTotal} XP
              </span>
            )}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-emerald-800 dark:text-emerald-200">
            {resolvedMcs.map((m) => (
              <li key={m.id}>✓ {m.name}</li>
            ))}
          </ul>
          {resolvedXpTotal === 0 && resolvedMcs.length > 0 && (
            <p className="mt-2 text-xs italic opacity-70">
              (Đã thưởng XP cho lần khắc phục đầu tiên — lần này không cộng thêm.)
            </p>
          )}
        </div>
      )}

      {remedial?.shouldShow && remedial.weakestSkill && (
        <div className="mt-6 rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
          <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
            🎯 Đề xuất ôn lại
          </p>
          <p className="mt-1 text-sm text-orange-800 dark:text-orange-200">
            Bạn đang struggle với{" "}
            <span className="font-medium">{remedial.weakestSkill.skillName}</span>{" "}
            <span className="text-xs opacity-70">
              ({Math.round(remedial.weakestSkill.masteryProbability * 100)}% mastery)
            </span>
            . Hãy ôn lại trước khi thử lại quiz này.
          </p>
          {remedial.lesson && (
            <Link
              href={`/learn/${remedial.lesson.courseSlug}/lessons/${remedial.lesson.id}`}
              className="mt-3 inline-block rounded bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
            >
              📖 Mở: {remedial.lesson.title}
            </Link>
          )}
        </div>
      )}

      <ol className="mt-8 space-y-6">
        {result.items.map((item, i) => {
          const fb = feedbackByQuestion.get(item.questionId);
          return (
            <li
              key={item.questionId}
              className={`rounded-lg border p-4 ${
                item.isCorrect
                  ? "border-emerald-300 dark:border-emerald-800"
                  : "border-red-300 dark:border-red-900"
              }`}
            >
              <p className="text-sm text-slate-500">
                Câu {i + 1} · {item.points} điểm · {item.isCorrect ? "✓ đúng" : "✗ sai"}
                {item.confidence !== null && ` · tự tin: ${item.confidence}/5`}
              </p>
              <p className="mt-1 whitespace-pre-wrap font-medium">{item.prompt}</p>

              {/* Phase 2 B3 — diagnostic feedback for wrong answers. */}
              {!item.isCorrect && fb && (
                <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm dark:bg-red-950/30">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-red-800 dark:text-red-300">
                      Phản hồi
                    </p>
                    <FeedbackRater
                      deliveryId={fb.deliveryId}
                      initialRating={fb.rating}
                    />
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-red-900 dark:text-red-100">
                    {fb.body}
                  </p>
                  {fb.remediationLessonIds.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-red-800 dark:text-red-300">
                        Tài liệu nên xem lại
                      </p>
                      <ul className="mt-1 space-y-1">
                        {fb.remediationLessonIds.map((lid) => {
                          const l = lessonMap.get(lid);
                          if (!l) return null;
                          return (
                            <li key={lid}>
                              <Link
                                href={`/learn/${l.courseSlug}/lessons/${lid}`}
                                className="text-sm text-red-900 underline hover:no-underline dark:text-red-100"
                              >
                                {l.title}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {item.explanation && (
                <div className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <p className="text-xs font-medium uppercase text-slate-500">Giải thích</p>
                  <p className="mt-1 whitespace-pre-wrap">{item.explanation}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
