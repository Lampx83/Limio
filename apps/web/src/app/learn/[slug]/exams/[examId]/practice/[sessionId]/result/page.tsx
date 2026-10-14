import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPracticeResult, getPracticeSession } from "@feedbackme/core-lms";
import { LANGUAGE_SKILL_LABEL, isLanguageSkill } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import { QuestionCard } from "@/components/exam/AnswerReview";
import PracticeRetryButton from "@/components/exam/PracticeRetryButton";

export const dynamic = "force-dynamic";

export default async function PracticeResultPage({ params }: { params: { slug: string; examId: string; sessionId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/learn/${params.slug}/exams/${params.examId}/practice/${params.sessionId}/result`);
  const userId = session.user.id;
  const s = await getPracticeSession(userId, params.sessionId).catch(() => null);
  if (!s || s.examId !== params.examId) notFound();
  if (s.status === "in_progress") redirect(`/learn/${params.slug}/exams/${params.examId}/practice/${params.sessionId}`);
  const r = await getPracticeResult(userId, params.sessionId);
  const skillName = (k: string) => (isLanguageSkill(k) ? LANGUAGE_SKILL_LABEL[k] : "Khác");

  return (
    <main className="mx-auto max-w-4xl px-4 py-6" data-testid="practice-result">
      <h1 className="text-h1">Kết quả luyện đề</h1>
      <p className="text-meta mt-1">Luyện đề không cộng XP và không ảnh hưởng điểm thi thử.</p>

      <section className="mt-5 rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
        <h2 className="text-h3">Theo kỹ năng</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {r.bySkill.map((x) => (
            <li key={x.skill} className="flex items-center justify-between rounded border border-token px-3 py-2 text-sm">
              <span className="font-medium">{skillName(x.skill)}</span>
              <span className="tabular-nums">
                {x.total > 0 ? `đúng ${x.correct}/${x.total}` : "—"}
                {x.manual > 0 && <span className="ml-2 text-xs text-amber-700">+ {x.manual} câu tự luận</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-h3">Câu cần xem lại ({r.wrong.length})</h2>
        {r.wrong.length === 0 ? (
          <p className="banner-success mt-3">Bạn trả lời đúng hết các câu chấm tự động trong buổi này.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {r.wrong.map((w, i) => (
              <div key={w.questionId}>
                {!w.answered && <p className="mb-1 text-xs font-medium text-amber-700">Bỏ trống</p>}
                <QuestionCard
                  idx={i}
                  q={{
                    id: w.questionId,
                    orderInExam: 0,
                    type: (s.questions.find((q) => q.id === w.questionId)?.type ?? "mcq"),
                    prompt: w.prompt,
                    points: s.questions.find((q) => q.id === w.questionId)?.points ?? 1,
                    config: w.config,
                    explanation: null,
                    answer: w.answered ? { answerJson: w.yourAnswer, score: 0, needsGrading: false, comment: null } : null,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        {r.wrong.length > 0 && <PracticeRetryButton slug={params.slug} examId={params.examId} sessionId={params.sessionId} />}
        <Link href={`/learn/${params.slug}/exams/${params.examId}/practice`} className="rounded-full border border-token px-5 py-2 text-sm hover:bg-brand-soft">
          Luyện tiếp
        </Link>
        <Link href={`/learn/${params.slug}`} className="text-sm text-blue-600 underline">← Về trang khoá</Link>
      </div>
    </main>
  );
}
