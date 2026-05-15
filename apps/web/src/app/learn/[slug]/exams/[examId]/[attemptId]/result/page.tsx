import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getExamAttemptResult, getExamAttemptReview } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import AnswerReview from "./AnswerReview";

export const dynamic = "force-dynamic";

export default async function ExamResultPage({
  params,
}: {
  params: { slug: string; examId: string; attemptId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/learn/${params.slug}/exams/${params.examId}/${params.attemptId}/result`,
    );
  }
  const result = await getExamAttemptResult(session.user.id, params.attemptId).catch(() => null);
  if (!result || result.examId !== params.examId) notFound();

  const review = result.showDetails
    ? await getExamAttemptReview(session.user.id, params.attemptId).catch(() => null)
    : null;

  const pending = result.status !== "graded";
  const pct = result.scorePct ?? null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold">{result.examTitle}</h1>
      <p className="mb-6 text-sm text-faint">
        Trạng thái:{" "}
        <span className="font-mono">{translateStatus(result.status)}</span>
      </p>

      {pending ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          Bài thi đang chờ chấm. Bạn sẽ thấy điểm sau khi giảng viên hoàn tất phần
          chấm tay.
        </div>
      ) : (
        <div className="rounded border border-default bg-white p-6 text-center">
          <div className="text-5xl font-bold tabular-nums">
            {pct !== null ? `${pct.toFixed(1)}%` : "—"}
          </div>
          <div className="mt-2 text-sm text-faint">
            {result.score} / {totalPoints(result)} điểm
          </div>
          <div
            className={`mt-4 inline-block rounded-full px-4 py-1 text-sm font-medium ${
              result.passed
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {result.passed ? "Đạt" : "Chưa đạt"} (ngưỡng {result.passScore}%)
          </div>
        </div>
      )}

      {review && <AnswerReview questions={review.questions} />}

      <div className="mt-8">
        <Link
          href={`/learn/${params.slug}`}
          className="text-sm text-blue-600 underline"
        >
          ← Về khóa học
        </Link>
      </div>
    </main>
  );
}

function translateStatus(s: string): string {
  switch (s) {
    case "submitted":
      return "Đã nộp (chờ chấm)";
    case "auto_submitted":
      return "Tự động nộp do hết giờ";
    case "graded":
      return "Đã chấm";
    case "flagged":
      return "Đang xem xét";
    default:
      return s;
  }
}

function totalPoints(result: {
  score: number | null;
  scorePct: number | null;
}): string {
  if (result.score === null || result.scorePct === null || result.scorePct === 0) {
    return "—";
  }
  return Math.round((result.score / result.scorePct) * 100).toString();
}
