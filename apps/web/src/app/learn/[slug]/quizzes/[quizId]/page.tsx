import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isUserEnrolled, startAttempt, QuizError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import QuizPlayer from "@/components/QuizPlayer";

export const dynamic = "force-dynamic";

const ERROR_LABEL: Record<string, string> = {
  max_attempts_exceeded: "Bạn đã hết số lần làm bài cho phép.",
  no_questions: "Quiz này chưa có câu hỏi nào.",
};

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

  if (!(await isUserEnrolled(userId, quiz.courseId)) {
    redirect(`/catalog/${params.slug}`);
  }

  let attemptId: string;
  try {
    const result = await startAttempt(userId, quiz.id);
    attemptId = result.attemptId;
  } catch (e) {
    if (e instanceof QuizError) {
      return (
        <main className="mx-auto max-w-2xl px-6 py-12">
          <Link
            href={`/learn/${params.slug}`}
            className="link inline-flex items-center gap-1 text-sm"
          >
            ← Quay lại khóa học
          </Link>
          <div className="mt-6 rounded-2xl border border-danger-100 bg-danger-50 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-100 text-2xl">
                          </div>
            <h1 className="mt-4 h-display text-2xl font-bold text-danger-700">
              Không thể bắt đầu quiz
            </h1>
            <p className="mt-3 text-sm text-danger-600">
              {ERROR_LABEL[e.code] ?? `Lỗi: ${e.code}`}
            </p>
          </div>
        </main>
      );
    }
    throw e;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/learn/${params.slug}`}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Quay lại khóa học
      </Link>
      <div className="mt-6">
        <QuizPlayer attemptId={attemptId} courseSlug={params.slug} />
      </div>
    </main>
  );
}
