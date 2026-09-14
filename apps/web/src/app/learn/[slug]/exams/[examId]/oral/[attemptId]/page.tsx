import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getAttemptRuntime } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import OralExamRoom from "@/components/exam/OralExamRoom";

export const dynamic = "force-dynamic";

/**
 * A6.3 — Phòng thi vấn đáp AI (chế độ text). Không dùng ExamPlayer: không có
 * passages/questions/shuffleSnapshot, luồng là hội thoại tuần tự với
 * runOralExamTurn thay vì trả lời từng câu độc lập.
 */
export default async function OralExamRuntimePage({
  params,
}: {
  params: { slug: string; examId: string; attemptId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/learn/${params.slug}/exams/${params.examId}/oral/${params.attemptId}`,
    );
  }

  const runtime = await getAttemptRuntime(
    { kind: "user", userId: session.user.id },
    params.attemptId,
  ).catch(() => null);
  if (!runtime || runtime.examId !== params.examId) notFound();

  if (runtime.status !== "in_progress") {
    redirect(`/learn/${params.slug}/exams/${params.examId}/oral/${params.attemptId}/submitted`);
  }

  const exam = await prisma.exam.findUniqueOrThrow({
    where: { id: params.examId },
    select: {
      kind: true,
      answerMode: true,
      title: true,
      course: { select: { title: true } },
    },
  });
  if (exam.kind !== "oral") notFound();

  if (exam.answerMode === "voice") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-3 text-xl font-semibold">Đang phát triển</h1>
        <p className="text-faint">
          Vấn đáp bằng giọng nói chưa có giao diện — liên hệ giảng viên để đổi
          đề sang chế độ nhắn tin, hoặc quay lại sau.
        </p>
      </main>
    );
  }

  const turns = await prisma.oralExamTurn.findMany({
    where: { attemptId: params.attemptId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  return (
    <OralExamRoom
      examId={params.examId}
      attemptId={params.attemptId}
      examTitle={exam.title}
      courseTitle={exam.course.title}
      startedAt={runtime.startedAt}
      durationSec={runtime.durationSec}
      serverNow={runtime.serverNow}
      initialTurns={turns}
      submittedUrl={`/learn/${params.slug}/exams/${params.examId}/oral/${params.attemptId}/submitted`}
    />
  );
}
