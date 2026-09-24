import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import QuizEditorClient from "./QuizEditorClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trang soạn quiz toàn màn hình: danh sách câu bên trái, vùng soạn ở giữa.
 * Thay cho khối <details> lồng trong trang bài học (chật, form bị ép hẹp).
 */
export default async function QuizEditorPage({
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

  const quiz = await prisma.quiz.findUnique({
    where: { id: params.quizId },
    include: {
      lesson: { select: { id: true, title: true } },
      questions: {
        orderBy: { orderIndex: "asc" },
        include: {
          options: {
            orderBy: { orderIndex: "asc" },
            include: { misconception: true },
          },
          skillTags: { include: { skill: true } },
        },
      },
    },
  });
  if (!quiz || quiz.courseId !== params.id) notFound();

  return (
    <QuizEditorClient
      courseId={params.id}
      lessonId={quiz.lessonId}
      lessonTitle={quiz.lesson?.title ?? null}
      quiz={{
        id: quiz.id,
        title: quiz.title,
        difficulty: quiz.difficulty,
        requireConfidence: quiz.requireConfidence,
        timeLimitSec: quiz.timeLimitSec,
        maxAttempts: quiz.maxAttempts,
        dueAt: quiz.dueAt ? quiz.dueAt.toISOString() : null,
        opensAt: quiz.opensAt ? quiz.opensAt.toISOString() : null,
        scoringPolicy: quiz.scoringPolicy,
        isHidden: quiz.isHidden,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          points: q.points,
          orderIndex: q.orderIndex,
          explanation: q.explanation,
          extra: q.extra,
          options: q.options.map((o) => ({
            id: o.id,
            label: o.label,
            isCorrect: o.isCorrect,
            orderIndex: o.orderIndex,
            misconceptionId: o.misconceptionId,
            misconception: o.misconception
              ? { id: o.misconception.id, code: o.misconception.code, name: o.misconception.name }
              : null,
            extra: o.extra,
          })),
          skillTags: q.skillTags.map((t) => ({
            skillId: t.skillId,
            skill: { code: t.skill.code, name: t.skill.name },
          })),
        })),
      }}
    />
  );
}
