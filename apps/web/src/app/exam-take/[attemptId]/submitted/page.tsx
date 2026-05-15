import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { CheckCircle } from "lucide-react";
import { requireExamSubject } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * A5.8 — Confirmation after a candidate submits their attempt.
 *
 * Q6: result lookup is via re-enter code (built in D6) at /exam/[code]/result.
 * This page just acknowledges receipt + tells the candidate how to view their
 * score later. Cookie may still be valid for a short window — used here only
 * to fetch the exam title for display, NOT to gate access.
 */
export default async function ExamSubmittedPage({
  params,
}: {
  params: { attemptId: string };
}) {
  const subject = await requireExamSubject(params.attemptId, {
    candidateOnly: true,
  });

  let examTitle: string | null = null;
  if (subject) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: params.attemptId },
      select: { exam: { select: { title: true } } },
    });
    examTitle = attempt?.exam.title ?? null;
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-10 text-center">
      <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        Đã nộp bài thi
      </h1>
      {examTitle && (
        <p className="mt-1 text-sm text-faint">{examTitle}</p>
      )}
      <p className="mt-6 text-sm text-slate-700">
        Bài thi của bạn đã được ghi nhận. Để xem kết quả, vui lòng nhập lại mã
        thi tại trang kết quả khi giám thị thông báo.
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
