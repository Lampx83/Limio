import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse, getRoomScope } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import GradeForm from "./GradeForm";
import RegradeAllButton from "./RegradeAllButton";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";
import { formatDateTime } from "@/lib/datetime";
import { StatusBadge } from "@/components/ui";

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
    select: { id: true, title: true, courseId: true, kind: true },
  });
  if (!exam || exam.courseId !== course.id) notFound();

  // A6.4 — Vấn đáp AI chấm theo TỪNG LƯỢT THI (transcript hội thoại), không
  // theo từng câu hỏi như thi viết — ExamAnswer không tồn tại cho oral. Bản
  // này cũng chưa có khái niệm room-grader cho vấn đáp (chỉ SV đăng nhập +
  // ghi danh, xem oral-attempts.ts) nên chỉ giảng viên thật mới chấm được.
  if (exam.kind === "oral") {
    if (!(await canEditCourse(session.user.id, course.id))) {
      redirect("/instructor/courses");
    }
    const attempts = await prisma.examAttempt.findMany({
      where: { examId: exam.id, status: { in: ["submitted", "graded"] } },
      select: {
        id: true,
        submittedAt: true,
        status: true,
        user: { select: { displayName: true, email: true } },
        oralEvaluation: {
          select: { aiSuggestedScore: true, instructorScore: true, status: true },
        },
      },
      orderBy: { submittedAt: "asc" },
    });

    return (
      <main>
        <Link
          href={`/instructor/courses/${course.id}/exams/${exam.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← {exam.title}
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Chấm vấn đáp</h1>
        <p className="mt-1 text-sm text-faint">
          Chỉ hiện các lượt thi đã kết thúc. AI chỉ đề xuất điểm — điểm chính
          thức do bạn duyệt/sửa trong từng lượt.
        </p>

        {attempts.length === 0 ? (
          <p className="mt-6 rounded border border-dashed border-default px-4 py-6 text-center text-sm text-faint">
            Chưa có lượt vấn đáp nào kết thúc.
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {attempts.map((a) => {
              const ev = a.oralEvaluation;
              const graded = a.status === "graded";
              return (
                <li key={a.id}>
                  <Link
                    href={`/instructor/courses/${course.id}/exams/${exam.id}/grading/${a.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default bg-white p-4 hover:border-brand-400"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {a.user?.displayName ?? "Sinh viên"}
                      </p>
                      <p className="text-caption text-faint">
                        {a.user?.email}
                        {a.submittedAt && ` · Nộp ${formatDateTime(a.submittedAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ev?.aiSuggestedScore !== null && ev?.aiSuggestedScore !== undefined && !graded && (
                        <span className="text-caption text-faint">
                          AI gợi ý: {ev.aiSuggestedScore}
                        </span>
                      )}
                      {graded ? (
                        <StatusBadge tone="success">
                          Đã chấm — {ev?.instructorScore}/100
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Chờ chấm</StatusBadge>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    );
  }

  // P1 — instructor-tier (incl. non-editing-teacher/teaching-assistant, via
  // getRoomScope's canGradeCourse check) OR room grader. Graders see only
  // their rooms.
  const roomScope = await getRoomScope(session.user.id, exam.id);
  const isInstructor = roomScope.isInstructor;
  const scope = isInstructor ? null : roomScope;
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

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Chấm bài</h1>
          <p className="mt-1 text-sm text-faint">
            Chỉ hiển thị câu tự luận (Essay) và trả lời ngắn (Short) cần chấm tay.
            Sau khi sửa đáp án trắc nghiệm, bấm “Chấm lại tất cả”.
          </p>
        </div>
        <RegradeAllButton examId={exam.id} />
      </div>

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
      // A5.8 — candidate attempts (open_code / assigned_code) carry the
      // submitter's details in candidate.metadata, not a User row.
      candidateDisplayName: true,
      user: {
        select: { id: true, displayName: true, email: true },
      },
      candidate: {
        select: { displayName: true, metadata: true },
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
    candidateDisplayName: string | null;
    user: { id: string; displayName: string; email: string } | null;
    candidate: { displayName: string; metadata: unknown } | null;
  };
  question: { type: string; prompt: string; points: number };
};

/** Pull a string field out of the candidate's free-form metadata JSON. */
function metaStr(metadata: unknown, key: string): string {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const v = (metadata as Record<string, unknown>)[key];
    if (typeof v === "string") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

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
  const meta = item.attempt.candidate?.metadata;
  const name =
    item.attempt.user?.displayName ??
    item.attempt.candidate?.displayName ??
    item.attempt.candidateDisplayName ??
    "Thí sinh";
  const email = item.attempt.user?.email || metaStr(meta, "email");
  const studentCode = metaStr(meta, "studentCode");
  const phone = metaStr(meta, "phone");
  const klass = metaStr(meta, "class");
  const details: Array<[string, string]> = [
    ["MSSV", studentCode],
    ["Lớp", klass],
    ["SĐT", phone],
    ["Email", email],
  ].filter(([, v]) => v !== "") as Array<[string, string]>;
  return (
    <div className="rounded-lg border border-default bg-white p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-sm font-medium">{name}</span>
          {details.length > 0 && (
            <span className="ml-2 text-xs text-faint">
              {details.map(([k, v]) => `${k}: ${v}`).join(" · ")}
            </span>
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
