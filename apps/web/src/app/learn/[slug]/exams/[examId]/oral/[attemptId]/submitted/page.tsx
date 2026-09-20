import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getAttemptRuntime, getOralAttemptQuota } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * A6.3/A6.4 — Vấn đáp AI KHÔNG có endpoint cho sinh viên xem điểm: điểm chỉ
 * có ý nghĩa sau khi GV duyệt (xem oral-evaluation.ts — chỉ GV gọi được), và
 * chưa có UI/route công bố điểm đã duyệt cho sinh viên. Trang này vì vậy chỉ
 * xác nhận đã nộp, không poll/không hiện điểm — khác trang result của thi viết.
 */
export default async function OralExamSubmittedPage({
  params,
}: {
  params: { slug: string; examId: string; attemptId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/learn/${params.slug}/exams/${params.examId}/oral/${params.attemptId}/submitted`,
    );
  }

  const runtime = await getAttemptRuntime(
    { kind: "user", userId: session.user.id },
    params.attemptId,
  ).catch(() => null);
  if (!runtime || runtime.examId !== params.examId) notFound();

  if (runtime.status === "in_progress") {
    redirect(`/learn/${params.slug}/exams/${params.examId}/oral/${params.attemptId}`);
  }

  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { title: true, courseId: true },
  });

  // Thi nhiều lượt: hiện số lượt đã dùng + nút "Thi lại" (chỉ khi còn lượt và không có lượt đang làm dở).
  const quota = await getOralAttemptQuota(session.user.id, params.examId);
  let retakeHref: string | null = null;
  if (quota.canRetake) {
    if (exam?.courseId) {
      retakeHref = `/learn/${params.slug}/exams/${params.examId}?retake=1`;
    } else {
      // Đề độc lập không có trang khoá học — vào lại bằng mã tham gia của buổi vấn đáp.
      const session2 = await prisma.examSession.findFirst({
        where: { examId: params.examId, oralJoinCode: { not: null } },
        select: { oralJoinCode: true },
      });
      if (session2?.oralJoinCode) retakeHref = `/oral/${session2.oralJoinCode}?retake=1`;
    }
  }

  return (
    <main className="relative mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <a
        href={`/learn/${params.slug}`}
        className="absolute left-4 top-4 text-sm font-medium text-lime-700 hover:text-lime-800 hover:underline dark:text-lime-400 dark:hover:text-lime-300 sm:left-6 sm:top-6"
      >
        ← Khoá học
      </a>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
        ✓
      </div>
      <h1 className="mb-2 text-h3">Đã nộp bài vấn đáp</h1>
      <p className="mb-1 text-body text-faint">{exam?.title}</p>
      <p className="mt-4 banner-info px-4 py-3 text-sm">
        Buổi vấn đáp đã kết thúc. Giảng viên sẽ nghe lại và chấm điểm — kết
        quả sẽ được thông báo riêng, không hiện tự động ở đây.
      </p>
      {quota.policy === "multi" && (
        <p className="mt-4 text-sm text-faint">
          Bạn đã dùng {quota.used}/{quota.max} lượt.
          {quota.remaining === 0 && " Đã hết lượt thi."}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {retakeHref && (
          <a href={retakeHref} className="btn btn-primary btn-sm">
            Thi lại (còn {quota.remaining} lượt)
          </a>
        )}
        <a href={`/learn/${params.slug}`} className="btn btn-secondary btn-sm">
          Quay lại khoá học
        </a>
      </div>
    </main>
  );
}
