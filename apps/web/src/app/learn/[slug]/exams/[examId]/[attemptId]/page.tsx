import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { endCurrentSection, getAttemptRuntime, toPublicQuestionConfig } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ExamPlayer from "@/components/ExamPlayer";
import ExamRoomChrome from "@/components/exam/ExamRoomChrome";

export const dynamic = "force-dynamic";

// URL của trang này mang khoá phiên (?st=). Không gửi nó đi qua Referer khi bài
// thi có liên kết ra ngoài (đoạn văn, tài liệu tham khảo).
export const metadata = { referrer: "no-referrer" as const };

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

  const runtime = await getAttemptRuntime(
    { kind: "user", userId: session.user.id },
    params.attemptId,
  ).catch(() => null);
  if (!runtime || runtime.examId !== params.examId) notFound();

  if (runtime.status !== "in_progress") {
    redirect(`/learn/${params.slug}/exams/${params.examId}/${params.attemptId}/result`);
  }

  // LANG G5a — đề thi thử: chỉ phần đang chạy được gửi xuống trình duyệt. Hết giờ
  // mọi phần mà bài chưa được nộp thì nộp nốt rồi sang trang kết quả.
  const flow = runtime.sectionFlow;
  if (flow?.finished) {
    await endCurrentSection({ kind: "user", userId: session.user.id }, params.attemptId).catch(() => null);
    redirect(`/learn/${params.slug}/exams/${params.examId}/${params.attemptId}/result`);
  }
  const visibleIds = flow ? new Set(flow.activeQuestionIds) : null;

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

  const questions = visibleIds
    ? examDetail.questions.filter((q) => visibleIds.has(q.id))
    : examDetail.questions;
  const passageIds = new Set(questions.map((q) => q.passageId).filter((x): x is string => !!x));
  const passages = visibleIds
    ? examDetail.passages.filter((p) => passageIds.has(p.id))
    : examDetail.passages;
  const activeIndex = flow ? flow.sections.findIndex((x) => x.id === flow.activeSectionId) : -1;
  const mock =
    flow && activeIndex >= 0
      ? {
          sections: flow.sections.map((x) => ({
            id: x.id,
            title: x.title,
            languageSkill: x.languageSkill,
            durationSec: x.durationSec,
            questionCount: x.questionCount,
            state: x.state,
          })),
          activeSectionId: flow.activeSectionId!,
          activeIndex,
          sectionEndsAt: flow.sections[activeIndex]!.endsAt,
          numberOffset: flow.sections.slice(0, activeIndex).reduce((a, x) => a + x.questionCount, 0),
        }
      : undefined;

  return (
    <>
    {mock && <ExamRoomChrome />}
    <ExamPlayer
      key={mock?.activeSectionId ?? "all"}
      mock={mock}
      exitHref={`/learn/${params.slug}`}
      attemptId={runtime.attemptId}
      sessionToken={searchParams.st ?? runtime.sessionToken}
      startedAt={runtime.startedAt}
      durationSec={runtime.durationSec}
      serverNow={runtime.serverNow}
      exam={{
        id: examDetail.id,
        title: examDetail.title,
        showResultsAfterSubmit: examDetail.showResultsAfterSubmit,
        proctoringLevel: examDetail.proctoringLevel,
      }}
      passages={passages.map((p) => ({
        id: p.id,
        title: p.title,
        contentJson: p.contentJson as unknown as TiptapDoc,
      }))}
      questions={questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        passageId: q.passageId,
        orderInPassage: q.orderInPassage,
        orderInExam: q.orderInExam,
        config: toPublicQuestionConfig(q.type, q.config),
      }))}
      shuffleSnapshot={runtime.shuffleSnapshot}
      initialAnswers={runtime.answers}
      resultUrl={`/learn/${params.slug}/exams/${params.examId}/${params.attemptId}/result`}
    />
    </>
  );
}

interface TiptapDoc {
  type: "doc";
  content: unknown[];
}
