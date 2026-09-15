import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { ExamError, getOralEvaluation } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import OralGradeForm from "./OralGradeForm";
import OralRubricEditor from "../OralRubricEditor";

export const dynamic = "force-dynamic";

/** A6.4 — Chấm 1 lượt vấn đáp: toàn bộ hội thoại + điểm AI đề xuất + form GV duyệt. */
export default async function OralGradingDetailPage({
  params,
}: {
  params: { id: string; examId: string; attemptId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}/grading/${params.attemptId}`,
    );
  }

  // getOralEvaluation tự kiểm tra quyền (assertCanEditCourse) + exam.kind
  // + attempt đã kết thúc — bắt lỗi ở đây thay vì tự lặp lại các guard đó.
  let view;
  try {
    view = await getOralEvaluation(session.user.id, params.attemptId);
  } catch (e) {
    if (e instanceof ExamError) notFound();
    throw e;
  }

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: params.attemptId },
    select: {
      submittedAt: true,
      user: { select: { displayName: true, email: true } },
      exam: {
        select: {
          id: true,
          title: true,
          courseId: true,
          oralRubricText: true,
          course: { select: { title: true } },
        },
      },
    },
  });
  if (
    !attempt ||
    attempt.exam.id !== params.examId ||
    (attempt.exam.courseId ?? "none") !== params.id
  ) {
    notFound();
  }

  const breakdown = Array.isArray(view.evaluation?.aiRubricBreakdown)
    ? (view.evaluation!.aiRubricBreakdown as unknown as { topic: string; note: string }[])
    : null;

  return (
    <main>
      <Link
        href={`/instructor/courses/${params.id}/exams/${params.examId}/grading`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Danh sách chấm
      </Link>
      <div className="mt-3">
        <h1 className="text-2xl font-bold">
          {attempt.user?.displayName ?? "Sinh viên"}
        </h1>
        <p className="mt-1 text-sm text-faint">
          {attempt.exam.title} · {attempt.exam.course?.title ?? "Đề độc lập"}
          {attempt.submittedAt && ` · Nộp ${formatDateTime(attempt.submittedAt)}`}
        </p>
      </div>

      <div className="mt-6">
        <OralRubricEditor
          examId={params.examId}
          initialRubric={attempt.exam.oralRubricText ?? ""}
        />
      </div>

      <section className="mt-2 rounded border border-default bg-white p-5">
        <h2 className="mb-3 text-base font-semibold">Toàn bộ hội thoại</h2>
        {view.turns.length === 0 ? (
          <p className="text-sm text-faint">Chưa có lượt hỏi-đáp nào.</p>
        ) : (
          <ul className="space-y-3">
            {view.turns.map((t) => (
              <li
                key={t.id}
                className={t.role === "examiner" ? "flex justify-start" : "flex justify-end"}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    t.role === "examiner"
                      ? "border border-token bg-slate-50"
                      : "bg-brand-gradient text-white"
                  }`}
                >
                  <p className="mb-0.5 text-caption font-medium opacity-70">
                    {t.role === "examiner" ? "AI giám khảo" : "Sinh viên"}
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed">{t.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6">
        <OralGradeForm
          examId={params.examId}
          attemptId={params.attemptId}
          aiSuggestedScore={view.evaluation?.aiSuggestedScore ?? null}
          aiSummary={view.evaluation?.aiSummary ?? null}
          aiRubricBreakdown={breakdown}
          instructorScore={view.evaluation?.instructorScore ?? null}
          instructorNotes={view.evaluation?.instructorNotes ?? ""}
          graded={
            view.evaluation?.status === "approved" ||
            view.evaluation?.status === "overridden"
          }
        />
      </div>
    </main>
  );
}
