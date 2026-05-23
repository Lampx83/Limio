import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse, evaluateAttemptPatterns } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import AttemptDetailLive from "./AttemptDetailLive";

export const dynamic = "force-dynamic";

export default async function ExamAttemptDrillDownPage({
  params,
}: {
  params: { id: string; examId: string; attemptId: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}/live/${params.attemptId}`,
    );

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: params.attemptId },
    select: {
      id: true,
      examId: true,
      userId: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      durationSec: true,
      resumeCount: true,
      lastHeartbeatAt: true,
      score: true,
      scorePct: true,
      passed: true,
      user: { select: { displayName: true, email: true } },
      exam: {
        select: {
          id: true,
          courseId: true,
          title: true,
          durationMin: true,
        },
      },
    },
  });
  if (!attempt || attempt.examId !== params.examId) notFound();
  if (attempt.exam.courseId !== params.id) notFound();

  const ok = await canEditCourse(session.user.id, attempt.exam.courseId);
  if (!ok) redirect("/instructor/exams");

  // Load questions ordered + answers + incidents + messages in parallel.
  const [questions, answers, incidents, messages] = await Promise.all([
    prisma.examQuestion.findMany({
      where: { examId: attempt.examId },
      select: { id: true, orderInExam: true, prompt: true, type: true },
      orderBy: { orderInExam: "asc" },
    }),
    prisma.examAnswer.findMany({
      where: { attemptId: attempt.id },
      select: { questionId: true, updatedAt: true, autoScore: true, manualScore: true },
    }),
    prisma.examIncident.findMany({
      where: { attemptId: attempt.id },
      select: { id: true, type: true, payload: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.examMessage.findMany({
      where: {
        OR: [
          { attemptId: attempt.id },
          { attemptId: null, examId: attempt.examId, sentAt: { gte: attempt.startedAt } },
        ],
      },
      select: { id: true, attemptId: true, body: true, sentAt: true, readAt: true },
      orderBy: { sentAt: "asc" },
    }),
  ]);

  const totalQuestions = questions.length;
  const answeredAt = new Map(
    answers.map((a) => [a.questionId, a.updatedAt.getTime()]),
  );

  const { flags: patternFlags } = await evaluateAttemptPatterns(attempt.id);
  const incidentCounts = incidents.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={`/instructor/courses/${attempt.exam.courseId}/exams/${attempt.examId}/live`}
          className="text-blue-600 hover:underline"
        >
          ← Live dashboard
        </Link>
        <span className="text-slate-400">·</span>
        <span className="text-slate-600">{attempt.exam.title}</span>
      </div>

      <AttemptDetailLive
        initial={{
          attemptId: attempt.id,
          userId: attempt.userId,
          userName: attempt.user?.displayName ?? attempt.user?.email ?? "(no name)",
          status: attempt.status,
          startedAt: attempt.startedAt.getTime(),
          expiresAt:
            attempt.startedAt.getTime() + attempt.durationSec * 1000,
          submittedAt: attempt.submittedAt?.getTime() ?? null,
          resumeCount: attempt.resumeCount,
          lastSeenAt:
            attempt.lastHeartbeatAt?.getTime() ??
            attempt.submittedAt?.getTime() ??
            attempt.startedAt.getTime(),
          score: attempt.score,
          scorePct: attempt.scorePct,
          passed: attempt.passed,
          answeredQuestionIds: Array.from(answeredAt.keys()),
          totalQuestions,
        }}
        examId={attempt.examId}
        questions={questions.map((q) => ({
          id: q.id,
          order: q.orderInExam,
          prompt: q.prompt.slice(0, 80),
          answeredAt: answeredAt.get(q.id) ?? null,
        }))}
        initialIncidents={incidents.map((i) => ({
          id: i.id,
          type: i.type,
          payload: i.payload as Record<string, unknown> | null,
          at: i.occurredAt.getTime(),
        }))}
        initialMessages={messages.map((m) => ({
          id: m.id,
          kind: m.attemptId ? "direct" : "broadcast",
          body: m.body,
          at: m.sentAt.getTime(),
        }))}
        patternFlags={patternFlags}
        incidentCounts={incidentCounts}
      />
    </main>
  );
}
