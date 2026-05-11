import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getAttemptRuntime } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ExamPlayer from "@/components/ExamPlayer";

export const dynamic = "force-dynamic";

export default async function ExamRuntimePage({
  params,
  searchParams,
}: {
  params: { slug: string; examId: string; attemptId: string };
  searchParams: { st?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/learn/${params.slug}/exams/${params.examId}/${params.attemptId}`);
  }

  const runtime = await getAttemptRuntime(session.user.id, params.attemptId).catch(() => null);
  if (!runtime || runtime.examId !== params.examId) notFound();

  if (runtime.status !== "in_progress") {
    redirect(`/learn/${params.slug}/exams/${params.examId}/${params.attemptId}/result`);
  }

  // Load passages + questions for display. We re-shape them in render order
  // using the shuffleSnapshot already stored on the attempt.
  const examDetail = await prisma.exam.findUniqueOrThrow({
    where: { id: params.examId },
    include: {
      passages: {
        orderBy: { orderIndex: "asc" },
      },
      questions: {
        select: {
          id: true,
          type: true,
          prompt: true,
          points: true,
          passageId: true,
          config: true,
          orderInPassage: true,
          orderInExam: true,
        },
      },
    },
  });

  return (
    <ExamPlayer
      attemptId={runtime.attemptId}
      sessionToken={searchParams.st ?? runtime.sessionToken}
      startedAt={runtime.startedAt}
      durationSec={runtime.durationSec}
      serverNow={runtime.serverNow}
      exam={{
        id: examDetail.id,
        title: examDetail.title,
        showResultsAfterSubmit: examDetail.showResultsAfterSubmit,
      }}
      passages={examDetail.passages.map((p) => ({
        id: p.id,
        title: p.title,
        contentJson: p.contentJson as unknown as TiptapDoc,
      }))}
      questions={examDetail.questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        passageId: q.passageId,
        orderInPassage: q.orderInPassage,
        orderInExam: q.orderInExam,
        config: q.config as Record<string, unknown>,
      }))}
      shuffleSnapshot={runtime.shuffleSnapshot}
      initialAnswers={runtime.answers}
      courseSlug={params.slug}
    />
  );
}

interface TiptapDoc {
  type: "doc";
  content: unknown[];
}
