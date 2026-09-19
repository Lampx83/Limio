import { redirect } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { ELIGIBLE_QUESTION_TYPES } from "@/lib/gameshow/constants";
import NewGameshowClient from "./NewGameshowClient";

export const dynamic = "force-dynamic";

export default async function NewGameshowPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/gameshow/new`);
  }
  const userId = session.user.id;

  const courseIds = (
    await prisma.courseInstructor.findMany({ where: { userId }, select: { courseId: true } })
  ).map((c) => c.courseId);

  const [quizzes, courses, questionSets] = await Promise.all([
    prisma.quiz.findMany({
      where: {
        courseId: { in: courseIds },
        isHidden: false,
        cuepointOnly: false,
        tournamentMissionId: null,
      },
      select: {
        id: true,
        title: true,
        courseId: true,
        lesson: { select: { id: true, title: true, orderIndex: true, module: { select: { orderIndex: true } } } },
        questions: { select: { type: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } }),
    prisma.gameQuestionSet.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, _count: { select: { items: true } } },
    }),
  ]);
  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

  const eligible = quizzes
    .map((q) => ({
      id: q.id,
      title: q.title,
      courseId: q.courseId ?? "",
      courseTitle: (q.courseId && courseTitleById.get(q.courseId)) ?? "—",
      lessonId: q.lesson?.id ?? null,
      lessonTitle: q.lesson?.title ?? null,
      lessonOrder: q.lesson ? q.lesson.module.orderIndex * 10000 + q.lesson.orderIndex : null,
      questionCount: q.questions.filter((qq) =>
        (ELIGIBLE_QUESTION_TYPES as readonly string[]).includes(qq.type),
      ).length,
    }))
    .filter((q) => q.questionCount > 0);

  const eligibleSets = questionSets
    .map((s) => ({ id: s.id, title: s.title, questionCount: s._count.items }))
    .filter((s) => s.questionCount > 0);

  return (
    <main className="w-full py-4">
      <div className="flex items-center gap-3">
        <span className="tool-icon"><Gamepad2 size={20} strokeWidth={1.75} /></span>
        <div>
          <h1 className="tool-title">Tạo Gameshow</h1>
          <p className="tool-subtitle">
            Chọn nguồn câu hỏi. Học viên tham gia bằng mã, không cần đăng nhập.
          </p>
        </div>
      </div>
      <NewGameshowClient quizzes={eligible} questionSets={eligibleSets} />
    </main>
  );
}
