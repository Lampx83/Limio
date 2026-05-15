import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@feedbackme/db";
import { getAttemptRuntime } from "@feedbackme/core-lms";
import { requireExamSubject } from "@/lib/session";
import ExamPlayer from "@/components/ExamPlayer";
import SebBrowserPrompt from "@/components/exam/SebBrowserPrompt";
import { detectSeb, requiresSeb } from "@/lib/seb";

export const dynamic = "force-dynamic";

/**
 * A5.8 — Public exam-take page for candidate-owned attempts.
 *
 * Auth: exam_session cookie (set by /api/public/exam/claim-code, D4). The
 * cookie is scoped to (candidateId, attemptId, examId) so requireExamSubject
 * rejects mismatches automatically.
 *
 * Same data shape as /learn/.../page.tsx so ExamPlayer reuses 100% — the only
 * difference is `resultUrl` points back to /exam (Q6: re-enter code each time).
 */
export default async function ExamTakePage({
  params,
  searchParams,
}: {
  params: { attemptId: string };
  searchParams: { st?: string };
}) {
  const subject = await requireExamSubject(params.attemptId, {
    candidateOnly: true,
  });
  if (!subject) {
    // No valid candidate cookie. The real link arrives with /exam/[code] →
    // claim → /exam-take/<id>; standalone hits bounce to root.
    redirect("/");
  }

  const runtime = await getAttemptRuntime(subject, params.attemptId).catch(
    () => null,
  );
  if (!runtime) notFound();

  if (runtime.status !== "in_progress") {
    redirect(`/exam-take/${params.attemptId}/result`);
  }

  const examDetail = await prisma.exam.findUniqueOrThrow({
    where: { id: runtime.examId },
    include: {
      passages: { orderBy: { orderIndex: "asc" } },
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

  // A7.8 — Strict proctoring: block non-SEB resume of an in-progress attempt.
  if (requiresSeb(examDetail.proctoringLevel)) {
    const { isSeb } = detectSeb(headers());
    if (!isSeb) {
      const h = headers();
      const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
      const proto = h.get("x-forwarded-proto") ?? "http";
      return (
        <SebBrowserPrompt
          examTitle={examDetail.title}
          targetUrl={`${proto}://${host}/exam-take/${params.attemptId}`}
        />
      );
    }
  }

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
      resultUrl={`/exam-take/${params.attemptId}/submitted`}
    />
  );
}

interface TiptapDoc {
  type: "doc";
  content: unknown[];
}
