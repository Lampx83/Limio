import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse, getRoomScope } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import GradeForm from "./GradeForm";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function GradingInboxPage({
  params,
}: {
  params: { id: string; examId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}/grading`,
    );
  }
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, title: true },
  });
  if (!course) notFound();
  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { id: true, title: true, courseId: true },
  });
  if (!exam || exam.courseId !== course.id) notFound();

  // P1 — instructor OR room grader. Graders see only their rooms.
  const isInstructor = await canEditCourse(session.user.id, course.id);
  const scope = isInstructor
    ? null
    : await getRoomScope(session.user.id, exam.id);
  if (!isInstructor && (!scope || scope.graderRoomIds.length === 0)) {
    redirect("/instructor/courses");
  }

  // Restrict to candidates of grader's rooms when not instructor.
  let candidateIdFilter: { in: string[] } | undefined;
  if (!isInstructor && scope) {
    const cands = await prisma.examCandidate.findMany({
      where: { examId: exam.id, roomId: { in: scope.graderRoomIds } },
      select: { id: true },
    });
    candidateIdFilter = { in: cands.map((c) => c.id) };
  }

  // Pending (essay/short awaiting manual grade).
  const pending = await prisma.examAnswer.findMany({
    where: {
      needsGrading: true,
      attempt: {
        examId: exam.id,
        ...(candidateIdFilter ? { candidateId: candidateIdFilter } : {}),
      },
      question: { type: { in: ["essay", "short_answer"] } },
    },
    orderBy: [{ attempt: { submittedAt: "asc" } }, { updatedAt: "asc" }],
    select: pendingShape,
  });

  // Graded — essay/short with a manualScore. Lets the instructor regrade.
  const graded = await prisma.examAnswer.findMany({
    where: {
      needsGrading: false,
      manualScore: { not: null },
      attempt: {
        examId: exam.id,
        ...(candidateIdFilter ? { candidateId: candidateIdFilter } : {}),
      },
      question: { type: { in: ["essay", "short_answer"] } },
    },
    orderBy: { gradedAt: "desc" },
    take: 50,
    select: pendingShape,
  });

  return (
    <main>
      <Link
        href={`/instructor/courses/${course.id}/exams/${exam.id}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← {exam.title}
      </Link>

      <h1 className="mt-3 text-2xl font-bold">Chấm bài</h1>
      <p className="mt-1 text-sm text-faint">
        Chỉ hiển thị câu tự luận (Essay) và trả lời ngắn (Short) cần chấm tay.
      </p>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
          Chờ chấm ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded border border-dashed border-default px-4 py-6 text-center text-sm text-faint">
            Không có bài nào đang chờ chấm.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((a) => (
              <li key={a.id}>
                <AnswerCard item={a} initialEditing />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
          Đã chấm ({graded.length})
        </h2>
        {graded.length === 0 ? (
          <p className="rounded border border-dashed border-default px-4 py-6 text-center text-sm text-faint">
            Chưa có bài nào được chấm.
          </p>
        ) : (
          <ul className="space-y-3">
            {graded.map((a) => (
              <li key={a.id}>
                <AnswerCard item={a} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const pendingShape = {
  id: true,
  questionId: true,
  attemptId: true,
  answerJson: true,
  manualScore: true,
  comment: true,
  gradedAt: true,
  attempt: {
    select: {
      submittedAt: true,
      user: {
        select: { id: true, displayName: true, email: true },
      },
    },
  },
  question: {
    select: { type: true, prompt: true, points: true },
  },
} as const;

type AnswerItem = {
  id: string;
  questionId: string;
  attemptId: string;
  answerJson: unknown;
  manualScore: number | null;
  comment: string | null;
  gradedAt: Date | null;
  attempt: {
    submittedAt: Date | null;
    // A5.8 — null for candidate attempts (open_code / assigned_code).
    user: { id: string; displayName: string; email: string } | null;
  };
  question: { type: string; prompt: string; points: number };
};

function AnswerCard({
  item,
  initialEditing,
}: {
  item: AnswerItem;
  initialEditing?: boolean;
}) {
  const text =
    typeof item.answerJson === "object" && item.answerJson !== null && "text" in item.answerJson
      ? String((item.answerJson as { text: unknown }).text ?? "")
      : "";
  return (
    <div className="rounded-lg border border-default bg-white p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-sm font-medium">{item.attempt.user?.displayName ?? "Thí sinh"}</span>
          {item.attempt.user?.email && (
            <span className="ml-2 text-xs text-faint">{item.attempt.user.email}</span>
          )}
        </div>
        <span className="text-xs text-faint">
          {item.question.type === "essay" ? "Tự luận" : "Trả lời ngắn"} ·{" "}
          {item.question.points} điểm
          {item.attempt.submittedAt &&
            ` · Nộp ${formatDateTime(item.attempt.submittedAt)}`}
        </span>
      </div>
      <p className="mb-1 text-sm font-medium">Đề:</p>
      <SafeHtml
        html={plainToRichHtml(item.question.prompt)}
        className="prose prose-sm mb-3 max-w-none rounded bg-slate-50 px-3 py-2 dark:prose-invert"
      />
      <p className="mb-1 text-sm font-medium">Bài làm:</p>
      <p className="mb-3 whitespace-pre-wrap rounded border border-default px-3 py-2 text-sm">
        {text || <em className="text-faint">(học viên không trả lời)</em>}
      </p>
      <GradeForm
        answerId={item.id}
        maxScore={item.question.points}
        initialScore={item.manualScore}
        initialComment={item.comment ?? ""}
        defaultOpen={initialEditing && item.manualScore === null}
        graded={item.manualScore !== null}
      />
    </div>
  );
}
