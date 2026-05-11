import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getExamAttemptResult } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

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

      {result.showDetails && result.answers.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-base font-semibold">Chi tiết từng câu</h2>
          <ul className="space-y-1 text-sm">
            {result.answers.map((a, i) => {
              const effective = a.manualScore ?? a.autoScore;
              return (
                <li
                  key={a.questionId}
                  className="flex items-center justify-between border-b border-default py-1.5"
                >
                  <span>Câu {i + 1}</span>
                  <span className="font-mono">
                    {a.needsGrading ? "(chờ chấm)" : `${effective ?? 0} điểm`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
