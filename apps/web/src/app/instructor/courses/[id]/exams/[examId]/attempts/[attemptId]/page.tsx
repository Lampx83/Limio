import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getRoomScope } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import SafeHtml from "@/components/SafeHtml";
import { StatusBadge } from "@/components/ui";
import { plainToRichHtml } from "@/lib/richText";
import { formatDateTime } from "@/lib/datetime";
import GradeForm from "../../grading/GradeForm";
import EssayRubric, { essayRubricOf } from "../../grading/EssayRubric";

export const dynamic = "force-dynamic";

const FINISHED = ["submitted", "auto_submitted", "graded"] as const;

const TYPE_LABEL: Record<string, string> = {
  mcq: "Trắc nghiệm",
  multi: "Chọn nhiều đáp án",
  true_false_notgiven: "Đúng / Sai / Không đề cập",
  gap_fill: "Điền chỗ trống",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
  ordering: "Sắp xếp",
  matching: "Ghép đôi",
  numerical: "Điền số",
  drag_drop_fill: "Kéo thả điền chỗ trống",
};

const TFNG_LABEL: Record<string, string> = {
  true: "Đúng",
  false: "Sai",
  notgiven: "Không đề cập",
};

/**
 * Bài làm của MỘT thí sinh/học viên, dành cho giảng viên và người chấm:
 * từng câu kèm đáp án đã chọn, đáp án đúng, điểm đạt; câu tự luận / trả lời
 * ngắn có ô chấm ngay tại chỗ. ("Xem log làm bài" — tiến độ, sự cố, dòng thời
 * gian — là trang khác, ở /live/[attemptId].)
 */
export default async function ExamAttemptReviewPage({
  params,
}: {
  params: { id: string; examId: string; attemptId: string };
}) {
  const base = `/instructor/courses/${params.id}/exams/${params.examId}`;
  const session = await auth();
  if (!session?.user?.id)
    redirect(`/signin?callbackUrl=${base}/attempts/${params.attemptId}`);
  const userId = session.user.id;

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: params.attemptId },
    select: {
      id: true,
      examId: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      score: true,
      scorePct: true,
      candidateId: true,
      candidateDisplayName: true,
      user: { select: { displayName: true, email: true } },
      candidate: { select: { displayName: true, metadata: true, roomId: true } },
      exam: { select: { id: true, title: true, courseId: true, kind: true } },
      answers: {
        select: {
          id: true,
          questionId: true,
          answerJson: true,
          autoScore: true,
          manualScore: true,
          needsGrading: true,
          comment: true,
        },
      },
    },
  });
  if (!attempt || attempt.examId !== params.examId) notFound();
  if ((attempt.exam.courseId ?? "none") !== params.id) notFound();
  // Vấn đáp AI chấm theo hội thoại, có màn riêng.
  if (attempt.exam.kind === "oral") redirect(`${base}/grading/${attempt.id}`);

  // Giảng viên xem hết; người chấm phòng chỉ xem thí sinh thuộc phòng mình chấm.
  const scope = await getRoomScope(userId, params.examId);
  const roomId = attempt.candidate?.roomId ?? null;
  const canView =
    scope.isInstructor ||
    (roomId !== null && scope.graderRoomIds.includes(roomId));
  if (!canView) redirect("/instructor/courses");
  const canGrade = canView; // cùng điều kiện với route chấm điểm.

  let candidateFilter: { in: string[] } | undefined;
  if (!scope.isInstructor) {
    const cands = await prisma.examCandidate.findMany({
      where: { examId: params.examId, roomId: { in: scope.graderRoomIds } },
      select: { id: true },
    });
    candidateFilter = { in: cands.map((c) => c.id) };
  }

  const [questions, siblings] = await Promise.all([
    prisma.examQuestion.findMany({
      where: { examId: params.examId },
      orderBy: { orderInExam: "asc" },
      select: { id: true, orderInExam: true, type: true, prompt: true, points: true, config: true },
    }),
    // Danh sách bài đã nộp của đề này để chuyển qua lại giữa các thí sinh.
    prisma.examAttempt.findMany({
      where: {
        examId: params.examId,
        status: { in: [...FINISHED] },
        ...(candidateFilter ? { candidateId: candidateFilter } : {}),
      },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      select: { id: true },
    }),
  ]);

  const answerByQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const pending = attempt.answers.filter((a) => a.needsGrading).length;
  const idx = siblings.findIndex((s) => s.id === attempt.id);
  const prevId = idx > 0 ? siblings[idx - 1]!.id : null;
  const nextId = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1]!.id : null;

  const name =
    attempt.user?.displayName ??
    attempt.candidate?.displayName ??
    attempt.candidateDisplayName ??
    "Thí sinh";
  const meta = attempt.candidate?.metadata;
  const details = (
    [
      ["MSSV", metaStr(meta, "studentCode")],
      ["Lớp", metaStr(meta, "class")],
      ["SĐT", metaStr(meta, "phone")],
      ["Email", attempt.user?.email || metaStr(meta, "email")],
    ] as Array<[string, string]>
  ).filter(([, v]) => v !== "");

  return (
    <main className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={`${base}/grading`} className="text-blue-600 hover:underline">
          ← Chấm bài
        </Link>
        <div className="flex items-center gap-3">
          {idx >= 0 && (
            <span className="text-faint">
              {idx + 1}/{siblings.length}
            </span>
          )}
          {prevId ? (
            <Link href={`${base}/attempts/${prevId}`} className="text-blue-600 hover:underline">
              ← Bài trước
            </Link>
          ) : (
            <span className="text-faint">← Bài trước</span>
          )}
          {nextId ? (
            <Link href={`${base}/attempts/${nextId}`} className="text-blue-600 hover:underline">
              Bài sau →
            </Link>
          ) : (
            <span className="text-faint">Bài sau →</span>
          )}
        </div>
      </div>

      <header className="mt-3 rounded-lg border border-default bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{name}</h1>
            {details.length > 0 && (
              <p className="mt-1 text-sm text-faint">
                {details.map(([k, v]) => `${k}: ${v}`).join(" · ")}
              </p>
            )}
            <p className="mt-1 text-sm text-faint">
              {attempt.exam.title}
              {attempt.submittedAt && ` · Nộp ${formatDateTime(attempt.submittedAt)}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {attempt.score ?? "—"}
              <span className="text-base font-normal text-faint"> / {totalPoints}</span>
            </p>
            {pending > 0 ? (
              <StatusBadge tone="warning">Còn {pending} câu chờ chấm</StatusBadge>
            ) : attempt.status === "graded" ? (
              <StatusBadge tone="success">Đã chấm xong</StatusBadge>
            ) : null}
            <p className="mt-2 text-xs">
              <Link
                href={`${base}/live/${attempt.id}`}
                className="text-blue-600 hover:underline"
              >
                Xem log làm bài
              </Link>
            </p>
          </div>
        </div>
      </header>

      <ol className="mt-4 space-y-4">
        {questions.map((q, i) => {
          const ans = answerByQ.get(q.id) ?? null;
          const awarded = ans ? (ans.manualScore ?? ans.autoScore) : null;
          const manual = q.type === "essay" || q.type === "short_answer";
          return (
            <li key={q.id} className="rounded-lg border border-default bg-white p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">
                  Câu {i + 1}
                  <span className="ml-2 text-xs font-normal text-faint">
                    {TYPE_LABEL[q.type] ?? q.type}
                  </span>
                </span>
                <ScoreBadge awarded={awarded} points={q.points} pending={!!ans?.needsGrading} answered={!!ans} />
              </div>
              <SafeHtml
                html={plainToRichHtml(q.prompt)}
                className="prose prose-sm mb-3 max-w-none rounded bg-slate-50 px-3 py-2 dark:prose-invert"
              />
              {manual && canGrade && (
                <EssayRubric rubric={essayRubricOf(q.type, q.config)} />
              )}
              <AnswerView type={q.type} config={q.config} answerJson={ans?.answerJson ?? null} />
              {manual && ans && canGrade && (
                <div className="mt-3">
                  <GradeForm
                    answerId={ans.id}
                    maxScore={q.points}
                    initialScore={ans.manualScore}
                    initialComment={ans.comment ?? ""}
                    defaultOpen={ans.manualScore === null}
                    graded={ans.manualScore !== null}
                  />
                </div>
              )}
              {!manual && ans?.comment && (
                <p className="mt-2 text-xs text-faint">Nhận xét: {ans.comment}</p>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}

function ScoreBadge({
  awarded,
  points,
  pending,
  answered,
}: {
  awarded: number | null;
  points: number;
  pending: boolean;
  answered: boolean;
}) {
  if (!answered)
    return <span className="text-xs text-faint">Không trả lời · 0/{points}</span>;
  if (pending) return <StatusBadge tone="warning">Chờ chấm · ?/{points}</StatusBadge>;
  const full = awarded !== null && awarded >= points;
  return (
    <StatusBadge tone={full ? "success" : awarded && awarded > 0 ? "warning" : "danger"}>
      {awarded ?? 0}/{points}
    </StatusBadge>
  );
}

type Option = { id: string; label: string; isCorrect: boolean };

function AnswerView({
  type,
  config,
  answerJson,
}: {
  type: string;
  config: unknown;
  answerJson: unknown;
}) {
  const a = (answerJson && typeof answerJson === "object" ? answerJson : {}) as Record<
    string,
    unknown
  >;

  if (type === "mcq" || type === "multi") {
    const options = ((config as { options?: Option[] })?.options ?? []) as Option[];
    const chosen = new Set(
      Array.isArray(a.optionIds) ? (a.optionIds as unknown[]).filter((x): x is string => typeof x === "string") : [],
    );
    return (
      <ul className="space-y-1.5">
        {options.map((o) => {
          const picked = chosen.has(o.id);
          const tone = o.isCorrect
            ? "border-emerald-400 bg-emerald-50"
            : picked
              ? "border-red-400 bg-red-50"
              : "border-default bg-white";
          return (
            <li
              key={o.id}
              className={`flex items-start justify-between gap-3 rounded border px-3 py-2 text-sm ${tone}`}
            >
              <span>{o.label}</span>
              <span className="shrink-0 text-xs font-medium">
                {picked && (o.isCorrect ? "✓ Đã chọn — đúng" : "✗ Đã chọn — sai")}
                {!picked && o.isCorrect && "Đáp án đúng"}
              </span>
            </li>
          );
        })}
        {chosen.size === 0 && (
          <li className="text-xs italic text-faint">(không chọn đáp án nào)</li>
        )}
      </ul>
    );
  }

  if (type === "true_false_notgiven") {
    const correct = (config as { correct?: string })?.correct ?? "";
    const chosen = typeof a.correct === "string" ? a.correct : "";
    return (
      <p className="text-sm">
        Đã chọn: <b>{TFNG_LABEL[chosen] ?? "(không chọn)"}</b> · Đáp án đúng:{" "}
        <b>{TFNG_LABEL[correct] ?? correct}</b>
      </p>
    );
  }

  if (type === "essay" || type === "short_answer") {
    const text = typeof a.text === "string" ? a.text : "";
    return (
      <p className="whitespace-pre-wrap rounded border border-default px-3 py-2 text-sm">
        {text || <em className="text-faint">(học viên không trả lời)</em>}
      </p>
    );
  }

  // Các dạng còn lại (điền chỗ trống, sắp xếp, ghép đôi, điền số…): hiện nguyên
  // dữ liệu đã nộp; điểm tự chấm đã hiện ở góc phải của câu.
  const empty = !answerJson || Object.keys(a).length === 0;
  return empty ? (
    <p className="text-xs italic text-faint">(không trả lời)</p>
  ) : (
    <pre className="overflow-x-auto rounded border border-default bg-slate-50 px-3 py-2 text-xs">
      {JSON.stringify(answerJson, null, 2)}
    </pre>
  );
}

/** Pull a string field out of the candidate's free-form metadata JSON. */
function metaStr(metadata: unknown, key: string): string {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const v = (metadata as Record<string, unknown>)[key];
    if (typeof v === "string") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}
