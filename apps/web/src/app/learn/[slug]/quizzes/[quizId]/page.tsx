import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import {
  canEditCourse,
  isUserEnrolled,
  startAttempt,
  QuizError,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import QuizPlayer from "@/components/QuizPlayer";
import QuizBackLink from "@/components/QuizBackLink";
import ExamRoomChrome from "@/components/exam/ExamRoomChrome";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/dict";

export const dynamic = "force-dynamic";

const ERROR_LABEL_KEY: Record<string, MessageKey> = {
  max_attempts_exceeded: "practice.quiz.page.err.max",
  quiz_not_open: "practice.quiz.page.err.notOpen",
  quiz_past_due: "practice.quiz.page.err.pastDue",
  no_questions: "practice.quiz.page.err.noQuestions",
};

export default async function QuizPage({
  params,
}: {
  params: { slug: string; quizId: string };
}) {
  const t = await getT();
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

  const enrolled = await isUserEnrolled(userId, quiz.courseId);
  const instructorPreview = !enrolled
    ? await canEditCourse(userId, quiz.courseId)
    : false;
  if (!enrolled && !instructorPreview) {
    redirect(`/catalog/${params.slug}`);
  }

  let attemptId: string;
  try {
    const result = await startAttempt(userId, quiz.id);
    attemptId = result.attemptId;
  } catch (e) {
    if (e instanceof QuizError) {
      return (
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
          <Link
            href={`/learn/${params.slug}`}
            className="link inline-flex items-center gap-1 text-sm"
          >
            {t("practice.quiz.backToCourse")}
          </Link>
          <div className="mt-6 rounded-2xl border border-danger-100 bg-danger-50 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-100 text-2xl">
                          </div>
            <h1 className="mt-4 h-display text-2xl font-bold text-danger-700">
              {t("practice.quiz.page.cantStart")}
            </h1>
            <p className="mt-3 text-sm text-danger-600">
              {ERROR_LABEL_KEY[e.code] ? t(ERROR_LABEL_KEY[e.code]!) : t("practice.quiz.page.err.generic", { code: e.code })}
            </p>
          </div>
        </main>
      );
    }
    throw e;
  }

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8">
      {/* Làm quiz là một trang riêng: ẩn thanh đầu trang (tài khoản, thông báo,
          Đấu trường), chân trang và nút nổi, để người học chỉ thấy đề. Phản hồi
          của sinh viên ở Thực hành 1: các nút đó nổi hơn cả câu hỏi và bấm nhầm là
          bị đưa ra khỏi bài. Cùng cơ chế với phòng thi thử (ExamRoomChrome). */}
      <ExamRoomChrome />
      <QuizBackLink href={`/learn/${params.slug}`} />
      {instructorPreview && (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-soft px-5 py-3">
          <p className="text-sm font-semibold text-brand-700">
            {t("practice.quiz.page.preview")}
          </p>
          <p className="text-xs text-brand-600">
            {t("practice.quiz.page.previewHelp")}
          </p>
        </div>
      )}
      <div className="mt-6">
        <QuizPlayer attemptId={attemptId} courseSlug={params.slug} />
      </div>
    </main>
  );
}
