import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import {
  ExamError,
  isUserEnrolled,
  startExamAttempt,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Entry point for taking an exam. Starts/resumes an attempt server-side and
 * redirects to the per-attempt runtime URL. We rely on startExamAttempt being
 * idempotent w.r.t. resuming an in-progress attempt — so re-hitting this URL
 * never creates a second attempt.
 */
export default async function ExamLandingPage({
  params,
}: {
  params: { slug: string; examId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/learn/${params.slug}/exams/${params.examId}`);
  }
  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (!course) notFound();
  if (!(await isUserEnrolled(session.user.id, course.id))) {
    redirect(`/catalog/${params.slug}`);
  }

  // Server-side validation: exam must exist and belong to this course.
  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { id: true, courseId: true, title: true, status: true },
  });
  if (!exam || exam.courseId !== course.id) notFound();

  try {
    const r = await startExamAttempt(session.user.id, params.examId);
    redirect(
      `/learn/${params.slug}/exams/${params.examId}/${r.attemptId}?st=${encodeURIComponent(r.sessionToken)}`,
    );
  } catch (e) {
    if (e instanceof ExamError) {
      // Already submitted → jump to result. Other failures bubble up as UI.
      if (e.code === "attempt_already_submitted") {
        const existing = await prisma.examAttempt.findUnique({
          where: { examId_userId: { examId: exam.id, userId: session.user.id } },
          select: { id: true },
        });
        if (existing) {
          redirect(
            `/learn/${params.slug}/exams/${params.examId}/${existing.id}/result`,
          );
        }
      }
      return (
        <main className="mx-auto max-w-2xl px-6 py-16 text-center">
          <h1 className="mb-4 text-2xl font-semibold">Không thể bắt đầu bài thi</h1>
          <p className="text-faint">{describeExamError(e.code)}</p>
        </main>
      );
    }
    throw e;
  }
}

function describeExamError(code: string): string {
  switch (code) {
    case "exam_not_open":
      return "Bài thi chưa mở.";
    case "exam_window_closed":
      return "Bài thi đã đóng.";
    case "not_enrolled":
      return "Bạn chưa đăng ký khóa học này.";
    default:
      return `Lỗi: ${code}`;
  }
}
