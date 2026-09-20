import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import {
  ExamError,
  isUserEnrolled,
  startExamAttempt,
  startOralExamAttempt,
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
  searchParams,
}: {
  params: { slug: string; examId: string };
  searchParams?: { retake?: string };
}) {
  // ?retake=1 chỉ do nút "Thi lại" ở trang đã nộp tạo ra — mở lại link/refresh thì không tự đốt lượt (xem decideOralStart).
  const retake = searchParams?.retake === "1";
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
    select: { id: true, courseId: true, title: true, status: true, kind: true },
  });
  if (!exam || exam.courseId !== course.id) notFound();

  // A6.3 — Vấn đáp AI không có ExamQuestion/shuffle/sessionToken query-param
  // như thi viết, nên đi luồng bắt đầu riêng và runtime URL riêng (/oral/...).
  if (exam.kind === "oral") {
    try {
      const r = await startOralExamAttempt(session.user.id, params.examId, { retake });
      redirect(`/learn/${params.slug}/exams/${params.examId}/oral/${r.attemptId}`);
    } catch (e) {
      if (e instanceof ExamError) {
        if (e.code === "attempt_already_submitted" || e.code === "attempt_limit_reached") {
          const existing = await prisma.examAttempt.findFirst({
            where: { examId: exam.id, userId: session.user.id },
            orderBy: { startedAt: "desc" },
            select: { id: true },
          });
          if (existing) {
            redirect(
              `/learn/${params.slug}/exams/${params.examId}/oral/${existing.id}/submitted`,
            );
          }
        }
        return (
          <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 text-center">
            <h1 className="mb-4 text-2xl font-semibold">Không thể bắt đầu buổi vấn đáp</h1>
            <p className="text-faint">{describeExamError(e.code)}</p>
          </main>
        );
      }
      throw e;
    }
  }

  try {
    const r = await startExamAttempt(session.user.id, params.examId);
    redirect(
      `/learn/${params.slug}/exams/${params.examId}/${r.attemptId}?st=${encodeURIComponent(r.sessionToken)}`,
    );
  } catch (e) {
    if (e instanceof ExamError) {
      // Already submitted → jump to result. Other failures bubble up as UI.
      if (e.code === "attempt_already_submitted") {
        const existing = await prisma.examAttempt.findFirst({
          where: { examId: exam.id, userId: session.user.id },
          select: { id: true },
        });
        if (existing) {
          redirect(
            `/learn/${params.slug}/exams/${params.examId}/${existing.id}/result`,
          );
        }
      }
      return (
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 text-center">
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
    case "attempt_limit_reached":
      return "Bạn đã dùng hết số lượt thi cho phép.";
    case "not_enrolled":
      return "Bạn chưa đăng ký khóa học này.";
    default:
      return `Lỗi: ${code}`;
  }
}
