import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getAttemptRuntime } from "@feedbackme/core-lms";
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
    select: { title: true },
  });

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
        ✓
      </div>
      <h1 className="mb-2 text-h3">Đã nộp bài vấn đáp</h1>
      <p className="mb-1 text-body text-faint">{exam?.title}</p>
      <p className="mt-4 banner-info px-4 py-3 text-sm">
        Buổi vấn đáp đã kết thúc. Giảng viên sẽ nghe lại và chấm điểm — kết
        quả sẽ được thông báo riêng, không hiện tự động ở đây.
      </p>
      <a href={`/learn/${params.slug}`} className="btn btn-secondary btn-sm mt-6">
        Quay lại khoá học
      </a>
    </main>
  );
}
