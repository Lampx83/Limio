import { notFound, redirect } from "next/navigation";
import { getPracticeSession } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import PracticePlayer from "@/components/exam/PracticePlayer";

export const dynamic = "force-dynamic";

export default async function PracticeSessionPage({ params }: { params: { slug: string; examId: string; sessionId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/learn/${params.slug}/exams/${params.examId}/practice/${params.sessionId}`);
  const s = await getPracticeSession(session.user.id, params.sessionId).catch(() => null);
  if (!s || s.examId !== params.examId) notFound();
  if (s.status !== "in_progress") redirect(`/learn/${params.slug}/exams/${params.examId}/practice/${params.sessionId}/result`);
  return (
    <PracticePlayer
      slug={params.slug}
      examId={params.examId}
      sessionId={s.sessionId}
      checkEnabled={s.checkEnabled}
      timed={s.timed}
      startedAt={s.startedAt.toISOString()}
      questions={s.questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        passageId: q.passageId,
        sectionTitle: q.sectionTitle,
        languageSkill: q.languageSkill,
        config: q.config,
      }))}
      passages={s.passages.map((p) => ({ id: p.id, title: p.title, contentJson: p.contentJson as unknown as { type: "doc"; content: unknown[] } }))}
      initialAnswers={s.answers}
    />
  );
}
