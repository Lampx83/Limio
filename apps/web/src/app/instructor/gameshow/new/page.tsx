import { redirect } from "next/navigation";
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
      courseTitle: (q.courseId && courseTitleById.get(q.courseId)) ?? "—",
      questionCount: q.questions.filter((qq) =>
        (ELIGIBLE_QUESTION_TYPES as readonly string[]).includes(qq.type),
      ).length,
    }))
    .filter((q) => q.questionCount > 0);

  const eligibleSets = questionSets
    .map((s) => ({ id: s.id, title: s.title, questionCount: s._count.items }))
    .filter((s) => s.questionCount > 0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">🎮 Tạo Gameshow</h1>
      <p className="mt-1 text-sm text-faint">
        Chọn nguồn câu hỏi. Học viên tham gia bằng mã, không cần đăng nhập.
      </p>
      <NewGameshowClient quizzes={eligible} questionSets={eligibleSets} />
    </main>
  );
}
