import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getAttemptRuntime } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import OralExamRoom from "@/components/exam/OralExamRoom";
import OralVoiceRoom from "@/components/exam/OralVoiceRoom";

export const dynamic = "force-dynamic";

/**
 * A6.3/A6.6 — Phòng thi vấn đáp AI. Không dùng ExamPlayer: không có
 * passages/questions/shuffleSnapshot, luồng là hội thoại tuần tự với
 * runOralExamTurn thay vì trả lời từng câu độc lập. Hai giao diện cho cùng
 * một attempt tuỳ exam.answerMode — cả hai đọc/ghi chung OralExamTurn nên
 * chuyển đề giữa hai chế độ không mất lịch sử.
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

  const turns = await prisma.oralExamTurn.findMany({
    where: { attemptId: params.attemptId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  const roomProps = {
    examId: params.examId,
    attemptId: params.attemptId,
    examTitle: exam.title,
    courseTitle: exam.course.title,
    startedAt: runtime.startedAt,
    durationSec: runtime.durationSec,
    serverNow: runtime.serverNow,
    initialTurns: turns,
    submittedUrl: `/learn/${params.slug}/exams/${params.examId}/oral/${params.attemptId}/submitted`,
  };

  if (exam.answerMode === "voice") {
    return <OralVoiceRoom {...roomProps} />;
  }
  return <OralExamRoom {...roomProps} />;
}
