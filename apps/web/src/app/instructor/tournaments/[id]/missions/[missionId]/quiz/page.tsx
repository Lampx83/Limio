import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@feedbackme/core-lms";
import AddQuestionForm from "@/app/instructor/courses/[id]/AddQuestionForm";
import QuestionRow from "@/app/instructor/courses/[id]/QuestionRow";
import BulkImportQuestions from "@/app/instructor/courses/[id]/BulkImportQuestions";

export const dynamic = "force-dynamic";

export default async function TournamentMissionQuizEditorPage({
  params,
}: {
  params: { id: string; missionId: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const mission = await prisma.tournamentMission.findFirst({
    where: { id: params.missionId, tournamentId: params.id },
    include: {
      tournament: { select: { id: true, title: true, creatorId: true, courseId: true } },
      quiz: {
        include: {
          questions: {
            orderBy: { orderIndex: "asc" },
            include: {
              options: { orderBy: { orderIndex: "asc" }, include: { misconception: true } },
              skillTags: { include: { skill: true } },
            },
          },
        },
      },
    },
  });
  if (!mission) notFound();

  // Authorization — admins always pass; otherwise tournament creator (or
  // anyone with edit rights on the linked course) can edit.
  const admin = await isAdmin(userId);
  const isCreator = mission.tournament.creatorId === userId;
  if (!admin && !isCreator) {
    // Course-linked tournament — could still be a co-instructor; defer to
    // server actions to enforce. For now block obvious non-creators.
    return (
      <main className="text-sm text-muted">
        Bạn không có quyền sửa quiz của mission này.
      </main>
    );
  }

  if (mission.verifyMode !== "AUTO_GRADE" || !mission.quiz) {
    return (
      <main className="text-sm text-muted">
        Mission này không dùng Quiz tự chấm.
      </main>
    );
  }

  const nextOrderIndex =
    mission.quiz.questions.length > 0
      ? Math.max(...mission.quiz.questions.map((q) => q.orderIndex)) + 1
      : 0;

  return (
    <main>
      <Link
        href={`/instructor/tournaments/${params.id}`}
        className="link text-sm"
      >
        ← {mission.tournament.title}
      </Link>
      <h1 className="mt-3 h-display text-2xl font-bold">
        Quiz: {mission.title}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {mission.quiz.questions.length} câu hỏi
      </p>

      {/* Question list */}
      {mission.quiz.questions.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-token p-8 text-center text-sm text-muted">
          Chưa có câu hỏi. Thêm câu hỏi đầu tiên bên dưới.
        </div>
      ) : (
        <ol className="mt-6 space-y-3">
          {mission.quiz.questions.map((q, i) => (
            <li key={q.id}>
              <QuestionRow
                question={{
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
                  skillTags: q.skillTags.map((st) => ({
                    skillId: st.skillId,
                    skill: { code: st.skill.code, name: st.skill.name },
                  })),
                }}
                order={i + 1}
              />
            </li>
          ))}
        </ol>
      )}

      {/* Add question + bulk import */}
      <div className="mt-6 space-y-3">
        <AddQuestionForm quizId={mission.quiz.id} nextOrderIndex={nextOrderIndex} />
        <BulkImportQuestions quizId={mission.quiz.id} />
      </div>
    </main>
  );
}
