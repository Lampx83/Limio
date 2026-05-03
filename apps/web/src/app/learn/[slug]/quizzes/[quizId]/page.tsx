import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isUserEnrolled, startAttempt, QuizError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import QuizPlayer from "@/components/QuizPlayer";

export const dynamic = "force-dynamic";

export default async function QuizPage({
  params,
}: {
  params: { slug: string; quizId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/learn/${params.slug}/quizzes/${params.quizId}`);
  }
  const userId = session.user.id;

  const quiz = await prisma.quiz.findUnique({
    where: { id: params.quizId },
    select: { id: true, courseId: true },
  });
  if (!quiz || !quiz.courseId) notFound();
  const course = await prisma.course.findUnique({
    where: { id: quiz.courseId },
    select: { slug: true },
  });
  if (!course || course.slug !== params.slug) notFound();

  if (!(await isUserEnrolled(userId, quiz.courseId))) {
    redirect(`/catalog/${params.slug}`);
  }

  // Start (or reuse) attempt.
  let attemptId: string;
  try {
    const result = await startAttempt(userId, quiz.id);
    attemptId = result.attemptId;
  } catch (e) {
    if (e instanceof QuizError) {
      return (
        <main className="mx-auto max-w-2xl px-6 py-12">
          <Link href={`/learn/${params.slug}`} className="text-sm underline">
            ← Quay lại khóa học
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Không thể bắt đầu quiz</h1>
          <p className="mt-3 text-red-600">Lỗi: {e.code}</p>
          {e.code === "max_attempts_exceeded" && (
            <p className="mt-2 text-sm text-slate-500">Bạn đã hết số lần làm bài cho phép.</p>
          )}
          {e.code === "no_questions" && (
            <p className="mt-2 text-sm text-slate-500">Quiz chưa có câu hỏi nào.</p>
          )}
        </main>
      );
    }
    throw e;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/learn/${params.slug}`} className="text-sm underline">
        ← Quay lại khóa học
      </Link>
      <div className="mt-6">
        <QuizPlayer attemptId={attemptId} courseSlug={params.slug} />
      </div>
    </main>
  );
}
