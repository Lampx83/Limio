import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { Radio } from "lucide-react";
import { canEditCourse, getRoomScope } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import LiveDashboard from "./LiveDashboard";

export const dynamic = "force-dynamic";

export default async function ExamLiveDashboardPage({
  params,
}: {
  params: { id: string; examId: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}/live`,
    );

  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { id: true, courseId: true, title: true, durationMin: true, accessMode: true },
  });
  if (!exam || exam.courseId !== params.id) notFound();

  const isInstructor = await canEditCourse(session.user.id, exam.courseId);
  const scope = isInstructor
    ? null
    : await getRoomScope(session.user.id, exam.id);
  if (!isInstructor && (!scope || scope.proctorRoomIds.length === 0)) {
    redirect("/instructor/exam-sessions");
  }

  // Restrict initial seed to candidates of proctor's rooms (the SSE stream
  // applies the same filter; this just keeps the SSR snapshot consistent).
  let proctorCandidateIds: string[] | null = null;
  if (!isInstructor && scope) {
    const cands = await prisma.examCandidate.findMany({
      where: { examId: exam.id, roomId: { in: scope.proctorRoomIds } },
      select: { id: true },
    });
    proctorCandidateIds = cands.map((c) => c.id);
  }

  // Ordered list of questions — passed to client so every attempt row uses the
  // same dot positions (so instructor can scan "câu 3 chưa ai làm" easily).
  const questions = await prisma.examQuestion.findMany({
    where: { examId: exam.id },
    select: { id: true, orderInExam: true },
    orderBy: { orderInExam: "asc" },
  });
  const totalQuestions = questions.length;

  // Initial list — only attempts started in the last 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const attempts = await prisma.examAttempt.findMany({
    where: {
      examId: exam.id,
      startedAt: { gt: since },
      ...(proctorCandidateIds !== null
        ? { candidateId: { in: proctorCandidateIds } }
        : {}),
    },
    select: {
      id: true,
      userId: true,
      candidateId: true,
      candidateDisplayName: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      durationSec: true,
      resumeCount: true,
      lastHeartbeatAt: true,
      user: { select: { displayName: true, email: true } },
      candidate: { select: { displayName: true, accessCode: true } },
      _count: { select: { incidents: true } },
      answers: { select: { questionId: true } },
    },
    orderBy: { startedAt: "asc" },
  });

  const examAccessMode = exam.accessMode ?? "authenticated";

  const initial = attempts.map((a) => {
    const subjectType: "user" | "open" | "assigned" = a.userId
      ? "user"
      : a.candidate?.accessCode
        ? "assigned"
        : examAccessMode === "assigned_code"
          ? "assigned"
          : "open";
    return {
    attemptId: a.id,
    userId: a.userId,
    userName:
      a.user?.displayName ??
      a.user?.email ??
      a.candidate?.displayName ??
      a.candidateDisplayName ??
      "(no name)",
    subjectType,
    status: a.status,
    startedAt: a.startedAt.getTime(),
    expiresAt: a.startedAt.getTime() + a.durationSec * 1000,
    submittedAt: a.submittedAt?.getTime() ?? null,
    answeredQuestionIds: a.answers.map((x) => x.questionId),
    totalQuestions,
    incidentCount: a._count.incidents,
    lastSeenAt:
      a.lastHeartbeatAt?.getTime() ??
      a.submittedAt?.getTime() ??
      a.startedAt.getTime(),
    resumeCount: a.resumeCount,
    };
  });

  // Also expose exam.accessMode to the page so we can fetch it for the
  // server-render select above (just used for derivation, no extra query).

  return (
    <main>
      <Link
        href={`/instructor/courses/${exam.courseId}/exams/${exam.id}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Quay lại bài thi
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Radio className="h-5 w-5 shrink-0 text-red-500" /> Live — {exam.title}</h1>
          <p className="mt-1 text-sm text-faint">
            Theo dõi trạng thái sinh viên đang thi realtime (24h gần nhất)
          </p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
          Thời lượng: {exam.durationMin} phút · Tổng {totalQuestions} câu
        </span>
      </div>

      <LiveDashboard
        examId={exam.id}
        initial={initial}
        questions={questions.map((q) => ({ id: q.id, order: q.orderInExam }))}
      />
    </main>
  );
}
