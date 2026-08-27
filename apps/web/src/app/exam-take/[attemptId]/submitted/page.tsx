import Link from "next/link";
import { CheckCircle, Clock, XCircle, Check } from "lucide-react";
import {
  ExamError,
  getCandidateResultByAttemptId,
} from "@feedbackme/core-lms";
import { requireExamSubject } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * A5.8 — Confirmation after a candidate submits their attempt.
 *
 * Behavior depends on the exam's `showResultsAfterSubmit` flag:
 *   - flag=true + fully graded → show score + per-question correctness inline
 *   - flag=true + still grading → show "đang chấm, refresh sau" with auto-refresh
 *   - flag=false                → just show "đã nộp" confirmation
 *
 * The candidate cookie set during the attempt is still valid here, so we can
 * look up the result directly by attemptId — no need to make the candidate
 * re-enter their code at /exam/[code]/result for the immediate post-submit
 * view. The re-enter flow remains available as a separate "lookup later"
 * entry point.
 */
export default async function ExamSubmittedPage({
  params,
}: {
  params: { attemptId: string };
}) {
  const subject = await requireExamSubject(params.attemptId, {
    candidateOnly: true,
  });

  // Cookie expired / wrong attempt → fall back to a generic confirmation
  // without trying to fetch results (avoid leaking another candidate's data).
  if (!subject) {
    return <Generic />;
  }

  let result: Awaited<ReturnType<typeof getCandidateResultByAttemptId>> | null = null;
  let pending = false;
  try {
    result = await getCandidateResultByAttemptId(params.attemptId);
  } catch (e) {
    if (e instanceof ExamError && e.code === "result_not_yet_graded") {
      pending = true;
    } else {
      // Unknown error → fall back to generic confirmation; don't crash.
      return <Generic />;
    }
  }

  // Status A — still grading. Auto-refresh every 5s so the page updates as
  // soon as the worker / recovery cron finalises the score.
  if (pending) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-10 text-center">
        <meta httpEquiv="refresh" content="5" />
        <Clock className="mx-auto h-16 w-16 text-amber-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          Đã nộp bài — đang chấm
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Hệ thống đang chấm bài. Trang sẽ tự làm mới sau vài giây để hiển thị
          kết quả.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
        >
          Về trang chủ
        </Link>
      </main>
    );
  }

  // Status B — graded but instructor disabled detailed view. Just confirm
  // receipt; tell the candidate to ask the teacher for the score.
  if (result && !result.showDetail && !result.fullyGraded) {
    return <Generic examTitle={result.examTitle} />;
  }
  if (result && !result.showDetail) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-10 text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          Đã nộp bài thi
        </h1>
        <p className="mt-1 text-sm text-faint">{result.examTitle}</p>
        <p className="mt-6 text-sm text-slate-700">
          Bài thi đã được ghi nhận. Giảng viên sẽ thông báo kết quả sau.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
        >
          Về trang chủ
        </Link>
      </main>
    );
  }

  // Status C — graded + instructor enabled showResultsAfterSubmit → show full
  // detail. The candidate sees score, pass/fail, and per-question correctness.
  if (result && result.showDetail) {
    const totalPoints = result.details?.reduce((s, d) => s + d.points, 0) ?? 0;
    const correctCount =
      result.details?.filter((d) => d.correct === true).length ?? 0;
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            {result.examTitle}
          </h1>
          <p className="mt-1 text-sm text-faint">{result.candidateName}</p>
        </div>

        {/* Score card */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-faint">
                Điểm số
              </div>
              <div className="mt-1 text-3xl font-bold text-slate-900">
                {result.score ?? 0}
                <span className="text-base font-normal text-faint">
                  {" "}
                  / {totalPoints}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-faint">
                Tỷ lệ đúng
              </div>
              <div className="mt-1 text-3xl font-bold text-slate-900">
                {result.scorePct != null ? result.scorePct.toFixed(0) : "—"}%
              </div>
            </div>
          </div>
          {result.passed !== null && (
            <div className="mt-4">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                  result.passed
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {result.passed ? (
                  <>
                    <Check className="h-4 w-4" /> Đạt
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" /> Chưa đạt
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Per-question breakdown */}
        {result.details && result.details.length > 0 && (
          <div className="mt-6">
            <h2 className="text-base font-semibold text-slate-900">
              Chi tiết câu trả lời ({correctCount}/{result.details.length} đúng)
            </h2>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
              {result.details.map((d, i) => {
                const status: "correct" | "wrong" | "pending" =
                  d.correct === true
                    ? "correct"
                    : d.correct === false
                      ? "wrong"
                      : "pending";
                return (
                  <li
                    key={i}
                    className={`flex items-start gap-3 px-4 py-3 text-sm ${
                      status === "correct"
                        ? "bg-emerald-50/30"
                        : status === "wrong"
                          ? "bg-rose-50/30"
                          : ""
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        status === "correct"
                          ? "bg-emerald-500 text-white"
                          : status === "wrong"
                            ? "bg-rose-500 text-white"
                            : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {status === "correct" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : status === "wrong" ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : (
                        "?"
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">
                        Câu {i + 1}
                      </div>
                      <p className="mt-0.5 truncate text-slate-600">
                        {d.prompt}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-slate-900">
                        {d.awarded ?? 0}/{d.points}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-block rounded bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
          >
            Về trang chủ
          </Link>
        </div>
      </main>
    );
  }

  return <Generic />;
}

/** Generic "đã nộp" confirmation — used when we can't (or shouldn't) show details. */
function Generic({ examTitle }: { examTitle?: string } = {}) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-10 text-center">
      <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Đã nộp bài thi</h1>
      {examTitle && <p className="mt-1 text-sm text-faint">{examTitle}</p>}
      <Link
        href="/"
        className="mt-6 inline-block rounded bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
      >
        Về trang chủ
      </Link>
    </main>
  );
}
