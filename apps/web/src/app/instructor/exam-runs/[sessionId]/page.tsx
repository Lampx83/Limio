import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { formatDateTime } from "@/lib/datetime";
import { auth } from "@/lib/auth";
import ResultsPanel from "../../courses/[id]/exams/[examId]/ResultsPanel";

export const dynamic = "force-dynamic";

/**
 * Kết quả của MỘT lần thi.
 *
 * Kết quả nói về "ai đã làm", mà "ai" thuộc buổi thi chứ không thuộc gói đề —
 * nên nó sống ở đây, không phải trong màn hình soạn đề. Gói đề chỉ còn là nội
 * dung.
 *
 * Phân tích câu hỏi ở đây là "câu nào lớp NÀY sai nhiều". Còn "câu này chạy ra
 * sao qua các đợt" thì ở tab Chất lượng của ngân hàng câu hỏi.
 */
export default async function ExamRunPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(`/signin?callbackUrl=/instructor/exam-runs/${params.sessionId}`);

  const run = await prisma.examSession.findFirst({
    where: {
      id: params.sessionId,
      exam: { course: { instructors: { some: { userId: session.user.id } } } },
    },
    select: {
      id: true,
      openCode: true,
      opensAt: true,
      closesAt: true,
      timingMode: true,
      status: true,
      durationOverrideMin: true,
      exam: {
        select: { id: true, title: true, courseId: true, durationMin: true, kind: true },
      },
    },
  });
  if (!run) notFound();

  // A6.5 — ResultsPanel bên dưới giả định ExamQuestion/ExamAnswer (câu nào
  // lớp sai nhiều, %điểm theo câu...) — vấn đáp AI không có gì trong số đó
  // và có màn tương ứng riêng (live + chấm bài theo hội thoại).
  if (run.exam.kind === "oral") {
    redirect(`/instructor/courses/${run.exam.courseId}/exams/${run.exam.id}/live`);
  }

  const durationMin = run.durationOverrideMin ?? run.exam.durationMin;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <Link href="/instructor/organize" className="text-sm text-faint hover:underline">
        ← Tổ chức thi
      </Link>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold">{run.exam.title}</h1>
        {run.openCode && (
          <span className="font-mono text-sm font-semibold tracking-widest text-faint">
            {run.openCode}
          </span>
        )}
      </div>
      <p className="mt-1 text-body text-faint">
        Mở {formatDateTime(run.opensAt)} · {durationMin} phút ·{" "}
        {run.closesAt
          ? `đóng ${formatDateTime(run.closesAt)}`
          : run.timingMode === "manual"
            ? "đóng khi giáo viên bấm"
            : "chưa đặt giờ đóng"}
      </p>
      <p className="mt-1 text-caption text-faint">
        Nội dung câu hỏi của gói đề này soạn ở{" "}
        <Link
          href={`/instructor/courses/${run.exam.courseId ?? "none"}/exams/${run.exam.id}`}
          className="underline"
        >
          mục Đề thi
        </Link>
        .
      </p>

      <div className="mt-6">
        <ResultsPanel
          examId={run.exam.id}
          courseId={run.exam.courseId ?? "none"}
          lockedSessionId={run.id}
        />
      </div>
    </main>
  );
}
