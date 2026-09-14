import Link from "next/link";
import { CheckCircle, Clock } from "lucide-react";
import {
  ExamError,
  getCandidateResultByAttemptId,
  getExamAttemptReview,
} from "@feedbackme/core-lms";
import AnswerReview from "@/components/exam/AnswerReview";
import { requireExamSubject } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * A5.8 — Confirmation after a candidate submits their attempt.
 *
 * Behavior depends on the SESSION's reveal policy (xem reveal-policy.ts —
 * ca thắng gói đề), qua hai cờ độc lập `showScore` / `showDetail`:
 *   - still grading                → "đang chấm, refresh sau" với auto-refresh
 *   - fully graded, !showScore     → chỉ xác nhận "đã nộp"
 *   - fully graded, showScore only → điểm số cuối cùng, KHÔNG kèm đáp án
 *   - fully graded, showDetail     → điểm + đáp án + giải thích từng câu
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

  // Status B — chưa chấm xong hẳn (vd. bị gắn cờ) — xác nhận chung, chưa có
  // gì để hiện.
  if (result && !result.fullyGraded) {
    return <Generic examTitle={result.examTitle} />;
  }

  // Status C — đã chấm xong nhưng chính sách ca thi không cho xem điểm.
  if (result && !result.showScore) {
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

  // Status D — đã chấm xong và ca thi cho xem điểm. showDetail (đáp án từng
  // câu) là một cờ RIÊNG — chính sách "score_only" cho xem điểm ở đây mà
  // không kèm AnswerReview bên dưới.
  //
  // Thí sinh vào bằng mã xem được ĐÚNG thứ học viên đăng nhập xem: câu trả lời
  // của mình, đáp án đúng, và giải thích. Trước đây chỗ này chỉ có chấm xanh/đỏ
  // — biết mình sai câu nào mà không biết sai chỗ nào thì chưa gọi là chữa bài.
  if (result && result.showScore) {
    const review = result.showDetail
      ? await getExamAttemptReview(subject, params.attemptId).catch(() => null)
      : null;
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
                  / {result.totalPoints}
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
        </div>

        {review && <AnswerReview questions={review.questions} />}

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
