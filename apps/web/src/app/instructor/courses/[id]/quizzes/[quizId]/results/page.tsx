import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import QuizResultsClient from "./QuizResultsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GV xem kết quả 1 quiz cụ thể: stats tổng + bảng SV + drawer detail.
 * Vào từ `/instructor/courses/[id]` → QuizSection → nút "Kết quả".
 */
export default async function QuizResultsPage({
  params,
}: {
  params: { id: string; quizId: string };
}) {
  const userId = await requireUserId();
  if (!userId) redirect("/login");

  try {
    await assertCanEditCourse(userId, params.id);
  } catch (err) {
    if (err instanceof CourseAuthzError) {
      if (err.code === "not_found") notFound();
      redirect("/403");
    }
    throw err;
  }

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, title: true },
  });
  if (!course) notFound();

  const quiz = await prisma.quiz.findUnique({
    where: { id: params.quizId },
    select: { id: true, courseId: true, title: true },
  });
  if (!quiz || quiz.courseId !== params.id) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <nav className="text-sm text-muted">
        <Link
          href={`/instructor/courses/${params.id}`}
          className="inline-flex items-center gap-1 hover:text-default"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {course.title}
        </Link>
      </nav>

      <header>
        <h1 className="text-2xl font-bold text-default">
          Kết quả: {quiz.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Danh sách lượt làm bài + chi tiết từng SV. Reload trang để cập nhật.
        </p>
      </header>

      <QuizResultsClient courseId={params.id} quizId={params.quizId} />
    </div>
  );
}
