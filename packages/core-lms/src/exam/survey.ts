import { prisma, type PrismaClient, type SurveyPhase } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditExam } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { surveyQuestionCode } from "./schemas";
import { ExamError } from "./types";

/**
 * Đề thi dạng Khảo sát (docs/tieu-chi/de-thi-khao-sat.md).
 *
 * "Phần" của phiếu là ExamPassage (tiêu đề + lời dẫn hiện cho sinh viên), gắn với
 * một lần đo qua `surveyPhase` (NULL = cả hai lần). Ca (ExamSession) mở ở lần đo
 * nào thì chỉ hiện phần của lần đó.
 */

export const SURVEY_PHASE_LABEL: Record<SurveyPhase, string> = {
  pre: "Lần trước",
  post: "Lần sau",
};

/** Phần có hiện ở ca này không. Ca không phân lần (null) hiện mọi phần. */
export function isPassageVisibleInPhase(
  passagePhase: SurveyPhase | null | undefined,
  sessionPhase: SurveyPhase | null | undefined,
): boolean {
  if (!sessionPhase || !passagePhase) return true;
  return passagePhase === sessionPhase;
}

/**
 * Lọc câu và phần sinh viên thấy trong một ca. Câu không thuộc phần nào luôn hiện.
 * Dùng chung cho trang làm phiếu và bảng xuất (cột của câu bị ẩn để trống).
 */
export function filterSurveyContent<
  P extends { id: string; surveyPhase?: SurveyPhase | null },
  Q extends { passageId: string | null },
>(passages: P[], questions: Q[], sessionPhase: SurveyPhase | null | undefined) {
  const visible = passages.filter((p) => isPassageVisibleInPhase(p.surveyPhase, sessionPhase));
  const ids = new Set(visible.map((p) => p.id));
  return {
    passages: visible,
    questions: questions.filter((q) => q.passageId === null || ids.has(q.passageId)),
  };
}

// ---------------------------------------------------------------------------
// Xuất câu trả lời
// ---------------------------------------------------------------------------

export interface SurveyQuestionColumn {
  id: string;
  /** Tiêu đề cột: mã câu, thiếu thì "Câu n". */
  header: string;
  type: string;
  prompt: string;
  partTitle: string | null;
  phase: SurveyPhase | null;
  /** "1 = …" cho câu lựa chọn; khoảng cho thang trượt; rỗng cho câu chữ. */
  legend: string;
}

/** Ô của một câu: số thứ tự lựa chọn (theo thứ tự soạn), số, hoặc chữ nguyên văn. */
export function surveyAnswerCell(type: string, config: unknown, answerJson: unknown): string | number | null {
  if (answerJson === null || answerJson === undefined) return null;
  const a = answerJson as Record<string, unknown>;
  switch (type) {
    case "mcq":
    case "multi": {
      const options = ((config as { options?: Array<{ id: string }> } | null)?.options ?? []).map((o) => o.id);
      const chosen = Array.isArray(a.optionIds) ? a.optionIds.filter((x): x is string => typeof x === "string") : [];
      const nums = chosen
        .map((id) => options.indexOf(id) + 1)
        .filter((n) => n > 0)
        .sort((x, y) => x - y);
      if (nums.length === 0) return null;
      return type === "mcq" && nums.length === 1 ? nums[0]! : nums.join(";");
    }
    case "slider": {
      const v = typeof a.value === "number" ? a.value : Number(a.value);
      return Number.isFinite(v) ? v : null;
    }
    case "short_answer":
    case "essay": {
      const t = typeof a.text === "string" ? a.text.trim() : "";
      return t ? t : null;
    }
    default:
      return null;
  }
}

function legendFor(type: string, config: unknown): string {
  const c = (config ?? {}) as Record<string, unknown>;
  if (type === "mcq" || type === "multi") {
    const options = Array.isArray(c.options) ? (c.options as Array<{ label?: unknown }>) : [];
    return options.map((o, i) => `${i + 1} = ${typeof o.label === "string" ? o.label : ""}`).join("; ");
  }
  if (type === "slider") {
    const lo = typeof c.minLabel === "string" && c.minLabel ? ` (${c.minLabel})` : "";
    const hi = typeof c.maxLabel === "string" && c.maxLabel ? ` (${c.maxLabel})` : "";
    return `${c.min}${lo} đến ${c.max}${hi}, bước ${c.step}`;
  }
  return "";
}

export interface SurveyExportRow {
  name: string;
  email: string;
  studentCode: string;
  className: string;
  phase: SurveyPhase | null;
  sessionLabel: string;
  startedAt: Date;
  submittedAt: Date | null;
  status: string;
  cells: Array<string | number | null>;
}

export interface SurveyExport {
  examTitle: string;
  columns: SurveyQuestionColumn[];
  rows: SurveyExportRow[];
}

export interface SurveyExportFilter {
  sessionId?: string | null;
  phase?: SurveyPhase | null;
}

/** Cột câu hỏi theo thứ tự sinh viên thấy: theo phần, rồi câu không thuộc phần. */
export function buildSurveyColumns(
  passages: Array<{ id: string; title: string; orderIndex: number; surveyPhase: SurveyPhase | null }>,
  questions: Array<{
    id: string;
    type: string;
    prompt: string;
    config: unknown;
    passageId: string | null;
    orderInPassage: number | null;
    orderInExam: number;
  }>,
): SurveyQuestionColumn[] {
  const byPassage = new Map(passages.map((p) => [p.id, p]));
  const sortedPassages = [...passages].sort((a, b) => a.orderIndex - b.orderIndex);
  const ordered = [
    ...sortedPassages.flatMap((p) =>
      questions
        .filter((q) => q.passageId === p.id)
        .sort((a, b) => (a.orderInPassage ?? 0) - (b.orderInPassage ?? 0) || a.orderInExam - b.orderInExam),
    ),
    ...questions.filter((q) => !q.passageId || !byPassage.has(q.passageId)).sort((a, b) => a.orderInExam - b.orderInExam),
  ];
  return ordered.map((q, i) => {
    const part = q.passageId ? byPassage.get(q.passageId) : undefined;
    return {
      id: q.id,
      header: surveyQuestionCode(q.config) ?? `Câu ${i + 1}`,
      type: q.type,
      prompt: q.prompt,
      partTitle: part?.title ?? null,
      phase: part?.surveyPhase ?? null,
      legend: legendFor(q.type, q.config),
    };
  });
}

const STATUS_LABEL: Record<string, string> = {
  in_progress: "Đang làm",
  submitted: "Đã nộp",
  auto_submitted: "Nộp tự động",
  graded: "Đã nộp",
  flagged: "Đã nộp",
};

/**
 * Câu trả lời của mọi lượt (mỗi lượt một dòng) của một đề Khảo sát. Quyền: chỉ người
 * sửa được đề. Không trả lượt của Bản thử (preview không tạo lượt).
 */
export async function loadSurveyExport(
  actorUserId: string,
  examId: string,
  filter: SurveyExportFilter = {},
  db: PrismaClient = prisma,
): Promise<SurveyExport> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      courseId: true,
      createdById: true,
      purpose: true,
      passages: { select: { id: true, title: true, orderIndex: true, surveyPhase: true } },
      questions: {
        select: { id: true, type: true, prompt: true, config: true, passageId: true, orderInPassage: true, orderInExam: true },
      },
    },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  if (exam.purpose !== "survey") throw new ExamError("validation_failed", "not_a_survey");

  const columns = buildSurveyColumns(exam.passages, exam.questions);
  const configOf = new Map(exam.questions.map((q) => [q.id, q.config]));

  const attempts = await db.examAttempt.findMany({
    where: {
      examId,
      ...(filter.sessionId ? { sessionId: filter.sessionId } : {}),
      ...(filter.phase ? { session: { surveyPhase: filter.phase } } : {}),
    },
    orderBy: [{ startedAt: "asc" }],
    select: {
      id: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      user: { select: { id: true, displayName: true, email: true, studentCode: true } },
      candidate: { select: { displayName: true, metadata: true, userId: true } },
      session: { select: { title: true, code: true, openCode: true, surveyPhase: true } },
      answers: { select: { questionId: true, answerJson: true } },
    },
  });

  // Lượt vào bằng mã (claimByAccount) gắn tài khoản qua ExamCandidate.userId.
  const candUserIds = [
    ...new Set(
      attempts
        .filter((a) => !a.user)
        .map((a) => a.candidate?.userId)
        .filter((x): x is string => !!x),
    ),
  ];
  const candUsers = candUserIds.length
    ? await db.user.findMany({
        where: { id: { in: candUserIds } },
        select: { id: true, displayName: true, email: true, studentCode: true },
      })
    : [];
  const userById = new Map(candUsers.map((u) => [u.id, u]));
  const userOf = (a: (typeof attempts)[number]) =>
    a.user ?? (a.candidate?.userId ? userById.get(a.candidate.userId) ?? null : null);
  const userIds = [...new Set(attempts.map((a) => userOf(a)?.id).filter((x): x is string => !!x))];
  const enrollments = userIds.length && exam.courseId
    ? await db.enrollment.findMany({
        where: { courseId: exam.courseId!, userId: { in: userIds } },
        select: { userId: true, section: { select: { name: true } } },
      })
    : [];
  const classOf = new Map(enrollments.map((e) => [e.userId, e.section.name]));

  const rows: SurveyExportRow[] = attempts.map((a) => {
    const u = userOf(a);
    const meta = (a.candidate?.metadata ?? {}) as Record<string, unknown>;
    const answerOf = new Map(a.answers.map((x) => [x.questionId, x.answerJson]));
    const s = a.session;
    return {
      name: u?.displayName ?? a.candidate?.displayName ?? "",
      email: u?.email ?? (typeof meta.email === "string" ? meta.email : ""),
      studentCode: u?.studentCode ?? (typeof meta.studentCode === "string" ? meta.studentCode : ""),
      className: (u && classOf.get(u.id)) ?? "",
      phase: s?.surveyPhase ?? null,
      sessionLabel: s ? (s.title ?? s.code ?? s.openCode ?? "") : "",
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      status: STATUS_LABEL[a.status] ?? a.status,
      cells: columns.map((c) => surveyAnswerCell(c.type, configOf.get(c.id), answerOf.get(c.id))),
    };
  });

  return { examTitle: exam.title, columns, rows };
}

/** Ghi lại một lần xuất (AC9). Payload không mang câu trả lời. */
export async function recordSurveyExport(
  actorUserId: string,
  examId: string,
  rowCount: number,
  filter: SurveyExportFilter,
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { courseId: true } });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamSurveyExported,
    { examId, rowCount, sessionId: filter.sessionId ?? null, phase: filter.phase ?? null },
    { courseId: exam?.courseId ?? undefined },
    db,
  );
}
