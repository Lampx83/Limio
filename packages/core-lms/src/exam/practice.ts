import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { isUserEnrolled } from "../learning/enroll";
import { emitEvent } from "../learning/events";
import { gradeExamAnswer } from "./grading";
import { toPublicQuestionConfig } from "./public-config";
import { ExamError } from "./types";

/**
 * LANG G5e — LUYỆN ĐỀ theo kỹ năng. Một bộ đề, hai cách chạy: thi thử (ép giờ, không quay lại) và
 * luyện đề (tự chọn phạm vi, không ép giờ, quay lại tự do, xem đáp án ngay).
 *
 * Dùng bảng RIÊNG (ExamPracticeSession/Answer), không phải ExamAttempt: lượt luyện không có giờ ép
 * buộc, không bị cron tự nộp, không vào bảng điểm/giám sát/thống kê của giảng viên, và — quan trọng
 * nhất — endpoint "Kiểm tra" (lộ đáp án đúng) không thể dùng cho lượt thi thử vì id lượt thi không
 * thuộc bảng này. Không cấp XP; phát event kèm thẻ kỹ năng để sau này nuôi BKT, nhưng CHƯA nuôi.
 */

const EPS = 1e-9;
const SKILLS = ["listening", "speaking", "reading", "writing"] as const;
type Skill = (typeof SKILLS)[number];

export type PracticeFilter = "all" | "unanswered" | "wrong";

const StartInput = z.object({
  sectionIds: z.array(z.string().uuid()).max(50).optional(),
  skills: z.array(z.enum(SKILLS)).max(4).optional(),
  all: z.boolean().optional(),
  filter: z.enum(["all", "unanswered", "wrong"]).optional(),
  timed: z.boolean().optional(),
  checkEnabled: z.boolean().optional(),
  retryOfSessionId: z.string().uuid().optional(),
});
export type StartPracticeInput = z.input<typeof StartInput>;

interface ScopeQuestion {
  id: string;
  type: string;
  prompt: string;
  points: number;
  passageId: string | null;
  config: unknown;
  sectionId: string;
  sectionTitle: string;
  languageSkill: Skill | null;
}

interface Scope {
  sectionIds: string[];
  questionIds: string[];
  filter: PracticeFilter;
  retryOfSessionId?: string | null;
}

const isManualType = (t: string) => t === "essay" || t === "short_answer";

async function loadPracticeExam(userId: string, examId: string, db: PrismaClient) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, title: true, status: true, kind: true, mockMode: true, allowPractice: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (!exam.courseId || !(await isUserEnrolled(userId, exam.courseId, db))) throw new ExamError("not_enrolled");
  if (exam.status !== "published" || exam.kind !== "written" || !exam.mockMode || !exam.allowPractice) {
    throw new ExamError("practice_disabled");
  }
  return exam;
}

/** Mọi câu của đề, theo thứ tự phần rồi thứ tự trong phần. */
async function loadExamQuestions(examId: string, db: PrismaClient): Promise<ScopeQuestion[]> {
  const sections = await db.examSection.findMany({
    where: { examId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      languageSkill: true,
      items: {
        orderBy: { orderInSection: "asc" },
        select: { question: { select: { id: true, type: true, prompt: true, points: true, passageId: true, config: true } } },
      },
    },
  });
  return sections.flatMap((s) =>
    s.items.map((i) => ({
      ...i.question,
      sectionId: s.id,
      sectionTitle: s.title,
      languageSkill: s.languageSkill as Skill | null,
    })),
  );
}

/** Đáp án mới nhất của học viên cho từng câu của đề, qua mọi buổi luyện. */
async function loadHistory(userId: string, examId: string, db: PrismaClient) {
  const rows = await db.examPracticeAnswer.findMany({
    where: { session: { userId, examId } },
    orderBy: { updatedAt: "desc" },
    select: { questionId: true, isCorrect: true },
  });
  const latest = new Map<string, boolean | null>();
  for (const r of rows) if (!latest.has(r.questionId)) latest.set(r.questionId, r.isCorrect);
  return latest;
}

export async function getPracticeOverview(userId: string, examId: string, db: PrismaClient = prisma) {
  const exam = await loadPracticeExam(userId, examId, db);
  const [questions, history, inProgress] = await Promise.all([
    loadExamQuestions(examId, db),
    loadHistory(userId, examId, db),
    db.examPracticeSession.findFirst({
      where: { userId, examId, status: "in_progress" },
      select: { id: true, startedAt: true, scope: true, _count: { select: { answers: true } } },
    }),
  ]);
  const sections = new Map<string, { id: string; title: string; languageSkill: Skill | null; questionCount: number; unansweredCount: number; wrongCount: number }>();
  for (const q of questions) {
    const s = sections.get(q.sectionId) ?? { id: q.sectionId, title: q.sectionTitle, languageSkill: q.languageSkill, questionCount: 0, unansweredCount: 0, wrongCount: 0 };
    s.questionCount++;
    if (!history.has(q.id)) s.unansweredCount++;
    else if (history.get(q.id) === false) s.wrongCount++;
    sections.set(q.sectionId, s);
  }
  return {
    examId,
    title: exam.title,
    sections: [...sections.values()],
    inProgress: inProgress
      ? {
          sessionId: inProgress.id,
          startedAt: inProgress.startedAt,
          answered: inProgress._count.answers,
          total: ((inProgress.scope as unknown as Scope).questionIds ?? []).length,
        }
      : null,
  };
}

export async function startPracticeSession(
  userId: string,
  examId: string,
  rawInput: StartPracticeInput,
  db: PrismaClient = prisma,
): Promise<{ sessionId: string; resumed: boolean; questionCount: number }> {
  const parsed = StartInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const input = parsed.data;
  await loadPracticeExam(userId, examId, db);

  // Một buổi dở mỗi đề: bắt đầu lại thì tiếp tục buổi đó (muốn buổi khác phải bỏ buổi này).
  const existing = await db.examPracticeSession.findFirst({ where: { userId, examId, status: "in_progress" } });
  if (existing) {
    return { sessionId: existing.id, resumed: true, questionCount: ((existing.scope as unknown as Scope).questionIds ?? []).length };
  }

  const questions = await loadExamQuestions(examId, db);
  let chosen: ScopeQuestion[];
  let filter: PracticeFilter = input.filter ?? "all";
  let retryOf: string | null = null;

  if (input.retryOfSessionId) {
    const prev = await db.examPracticeSession.findUnique({ where: { id: input.retryOfSessionId } });
    if (!prev || prev.userId !== userId || prev.examId !== examId) throw new ExamError("practice_session_not_found");
    const result = await computePracticeResult(prev.id, db);
    const wrongIds = new Set(result.wrong.map((w) => w.questionId));
    chosen = questions.filter((q) => wrongIds.has(q.id));
    filter = "wrong";
    retryOf = prev.id;
  } else {
    const sectionIds = new Set<string>();
    const skillSet = new Set<string>(input.skills ?? []);
    const examSectionIds = new Set(questions.map((q) => q.sectionId));
    for (const id of input.sectionIds ?? []) if (examSectionIds.has(id)) sectionIds.add(id);
    for (const q of questions) {
      if (input.all || (q.languageSkill && skillSet.has(q.languageSkill))) sectionIds.add(q.sectionId);
    }
    chosen = questions.filter((q) => sectionIds.has(q.sectionId));
    if (filter !== "all") {
      const history = await loadHistory(userId, examId, db);
      chosen = chosen.filter((q) => (filter === "unanswered" ? !history.has(q.id) : history.get(q.id) === false));
    }
  }
  if (chosen.length === 0) throw new ExamError("practice_scope_empty");

  const scope: Scope = {
    sectionIds: [...new Set(chosen.map((q) => q.sectionId))],
    questionIds: chosen.map((q) => q.id),
    filter,
    retryOfSessionId: retryOf,
  };
  try {
    const created = await db.examPracticeSession.create({
      data: {
        examId,
        userId,
        scope: scope as unknown as Prisma.InputJsonValue,
        checkEnabled: input.checkEnabled ?? true,
        timed: input.timed ?? false,
      },
      select: { id: true },
    });
    return { sessionId: created.id, resumed: false, questionCount: chosen.length };
  } catch (e) {
    // Hai yêu cầu song song: chỉ mục duy nhất giữ đúng một buổi dở — trả về buổi đã có.
    if ((e as { code?: string }).code === "P2002") {
      const again = await db.examPracticeSession.findFirst({ where: { userId, examId, status: "in_progress" } });
      if (again) return { sessionId: again.id, resumed: true, questionCount: ((again.scope as unknown as Scope).questionIds ?? []).length };
    }
    throw e;
  }
}

async function loadOwnedSession(userId: string, sessionId: string, db: PrismaClient) {
  const s = await db.examPracticeSession.findUnique({ where: { id: sessionId } });
  if (!s || s.userId !== userId) throw new ExamError("practice_session_not_found");
  return s;
}

function stableHash(v: unknown): string {
  const stable = JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.keys(x as Record<string, unknown>).sort().reduce<Record<string, unknown>>((a, k) => ((a[k] = (x as Record<string, unknown>)[k]), a), {})
      : x,
  );
  return createHash("sha256").update(stable ?? "null").digest("hex");
}

export async function getPracticeSession(userId: string, sessionId: string, db: PrismaClient = prisma) {
  const s = await loadOwnedSession(userId, sessionId, db);
  const scope = s.scope as unknown as Scope;
  const all = await loadExamQuestions(s.examId, db);
  const byId = new Map(all.map((q) => [q.id, q]));
  const questions = scope.questionIds.map((id) => byId.get(id)).filter((q): q is ScopeQuestion => !!q);
  const passageIds = [...new Set(questions.map((q) => q.passageId).filter((x): x is string => !!x))];
  const [passages, answers] = await Promise.all([
    passageIds.length
      ? db.examPassage.findMany({
          where: { id: { in: passageIds } },
          orderBy: { orderIndex: "asc" },
          select: { id: true, title: true, contentJson: true },
        })
      : Promise.resolve([]),
    db.examPracticeAnswer.findMany({
      where: { sessionId },
      select: { questionId: true, answerJson: true, isCorrect: true, checkedAt: true },
    }),
  ]);
  return {
    sessionId: s.id,
    examId: s.examId,
    status: s.status,
    timed: s.timed,
    checkEnabled: s.checkEnabled,
    startedAt: s.startedAt,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      passageId: q.passageId,
      sectionId: q.sectionId,
      sectionTitle: q.sectionTitle,
      languageSkill: q.languageSkill,
      // Cấu hình CÔNG KHAI: đáp án đúng chỉ trả về sau khi kiểm tra (checkPracticeAnswer).
      config: toPublicQuestionConfig(q.type, q.config),
    })),
    passages,
    answers: answers.map((a) => ({
      questionId: a.questionId,
      answerJson: a.answerJson,
      checked: a.checkedAt !== null,
      isCorrect: a.isCorrect,
    })),
  };
}

export async function savePracticeAnswer(
  userId: string,
  sessionId: string,
  questionId: string,
  answerJson: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const s = await loadOwnedSession(userId, sessionId, db);
  if (s.status !== "in_progress") throw new ExamError("practice_session_closed");
  if (answerJson === undefined) throw new ExamError("validation_failed");
  const scope = s.scope as unknown as Scope;
  if (!scope.questionIds.includes(questionId)) throw new ExamError("validation_failed", { reason: "question_not_in_scope" });
  const existing = await db.examPracticeAnswer.findUnique({ where: { sessionId_questionId: { sessionId, questionId } } });
  if (existing && stableHash(existing.answerJson) === stableHash(answerJson)) return; // không đổi
  await db.examPracticeAnswer.upsert({
    where: { sessionId_questionId: { sessionId, questionId } },
    create: { sessionId, questionId, answerJson: answerJson as Prisma.InputJsonValue },
    // Đổi đáp án → phải kiểm tra lại.
    update: { answerJson: answerJson as Prisma.InputJsonValue, isCorrect: null, score: null, checkedAt: null },
  });
}

export interface PracticeCheck {
  isCorrect: boolean | null;
  score: number | null;
  maxScore: number;
  /** true = câu chấm tay (tự luận): không có đúng/sai tự động. */
  manual: boolean;
  /** Cấu hình ĐẦY ĐỦ (gồm đáp án đúng) — chỉ trả về sau khi học viên đã trả lời. */
  config: unknown;
}

async function gradeAndStore(
  sessionId: string,
  examId: string,
  userId: string,
  q: ScopeQuestion,
  answer: { answerJson: unknown },
  db: PrismaClient,
): Promise<PracticeCheck> {
  const g = gradeExamAnswer(q.type as Parameters<typeof gradeExamAnswer>[0], q.config, answer.answerJson, q.points);
  if (g.needsGrading || g.autoScore === null) {
    await db.examPracticeAnswer.update({
      where: { sessionId_questionId: { sessionId, questionId: q.id } },
      data: { isCorrect: null, score: null, checkedAt: new Date() },
    });
    return { isCorrect: null, score: null, maxScore: q.points, manual: true, config: q.config };
  }
  const isCorrect = q.points > 0 && g.autoScore >= q.points - EPS;
  await db.examPracticeAnswer.update({
    where: { sessionId_questionId: { sessionId, questionId: q.id } },
    data: { isCorrect, score: g.autoScore, checkedAt: new Date() },
  });
  const tags = await db.examQuestionSkillTag.findMany({ where: { questionId: q.id }, select: { skillId: true } });
  await emitEvent(
    userId,
    LearningEventType.ExamPracticeAnswered,
    {
      examId,
      sessionId,
      questionId: q.id,
      correct: isCorrect,
      score: g.autoScore,
      maxScore: q.points,
      languageSkill: q.languageSkill,
      skillIds: tags.map((t) => t.skillId),
    },
    { eventKey: `exam.practice.answered:${sessionId}:${q.id}:${stableHash(answer.answerJson)}` },
    db,
  );
  return { isCorrect, score: g.autoScore, maxScore: q.points, manual: false, config: q.config };
}

export async function checkPracticeAnswer(
  userId: string,
  sessionId: string,
  questionId: string,
  db: PrismaClient = prisma,
): Promise<PracticeCheck> {
  const s = await loadOwnedSession(userId, sessionId, db);
  if (s.status !== "in_progress") throw new ExamError("practice_session_closed");
  if (!s.checkEnabled) throw new ExamError("practice_check_disabled");
  const scope = s.scope as unknown as Scope;
  if (!scope.questionIds.includes(questionId)) throw new ExamError("validation_failed", { reason: "question_not_in_scope" });
  const answer = await db.examPracticeAnswer.findUnique({ where: { sessionId_questionId: { sessionId, questionId } } });
  if (!answer) throw new ExamError("practice_not_answered");
  const q = (await loadExamQuestions(s.examId, db)).find((x) => x.id === questionId);
  if (!q) throw new ExamError("validation_failed");
  return gradeAndStore(sessionId, s.examId, userId, q, answer, db);
}

export interface PracticeResult {
  sessionId: string;
  examId: string;
  bySkill: { skill: string; correct: number; total: number; answered: number; manual: number }[];
  wrong: {
    questionId: string;
    prompt: string;
    answered: boolean;
    languageSkill: string | null;
    yourAnswer: unknown;
    config: unknown;
  }[];
}

async function computePracticeResult(sessionId: string, db: PrismaClient): Promise<PracticeResult> {
  const s = await db.examPracticeSession.findUniqueOrThrow({ where: { id: sessionId } });
  const scope = s.scope as unknown as Scope;
  const all = await loadExamQuestions(s.examId, db);
  const byId = new Map(all.map((q) => [q.id, q]));
  const answers = new Map((await db.examPracticeAnswer.findMany({ where: { sessionId } })).map((a) => [a.questionId, a]));
  const skills = new Map<string, { skill: string; correct: number; total: number; answered: number; manual: number }>();
  const wrong: PracticeResult["wrong"] = [];
  for (const id of scope.questionIds) {
    const q = byId.get(id);
    if (!q) continue;
    const key = q.languageSkill ?? "other";
    const agg = skills.get(key) ?? { skill: key, correct: 0, total: 0, answered: 0, manual: 0 };
    skills.set(key, agg);
    const a = answers.get(id);
    const manual = a ? a.checkedAt !== null && a.isCorrect === null && a.score === null : isManualType(q.type);
    if (manual) {
      if (a) agg.manual++;
      continue; // tự luận: không tính đúng/sai
    }
    agg.total++;
    if (a) agg.answered++;
    if (a?.isCorrect === true) agg.correct++;
    else {
      wrong.push({
        questionId: id,
        prompt: q.prompt,
        answered: !!a,
        languageSkill: q.languageSkill,
        yourAnswer: a?.answerJson ?? null,
        config: q.config,
      });
    }
  }
  return { sessionId, examId: s.examId, bySkill: [...skills.values()], wrong };
}

export async function getPracticeResult(userId: string, sessionId: string, db: PrismaClient = prisma): Promise<PracticeResult> {
  await loadOwnedSession(userId, sessionId, db);
  return computePracticeResult(sessionId, db);
}

/** Kết thúc buổi: chấm mọi đáp án chưa kiểm tra, ghi kết quả. Gọi lại không phát event thêm. */
export async function completePracticeSession(userId: string, sessionId: string, db: PrismaClient = prisma): Promise<PracticeResult> {
  const s = await loadOwnedSession(userId, sessionId, db);
  if (s.status === "abandoned") throw new ExamError("practice_session_closed");
  if (s.status === "in_progress") {
    const questions = new Map((await loadExamQuestions(s.examId, db)).map((q) => [q.id, q]));
    const answers = await db.examPracticeAnswer.findMany({ where: { sessionId, checkedAt: null } });
    for (const a of answers) {
      const q = questions.get(a.questionId);
      if (q) await gradeAndStore(sessionId, s.examId, userId, q, a, db);
    }
    await db.examPracticeSession.update({ where: { id: sessionId }, data: { status: "completed", completedAt: new Date() } });
    const r = await computePracticeResult(sessionId, db);
    await emitEvent(
      userId,
      LearningEventType.ExamPracticeCompleted,
      {
        examId: s.examId,
        sessionId,
        questionCount: ((s.scope as unknown as Scope).questionIds ?? []).length,
        correct: r.bySkill.reduce((n, x) => n + x.correct, 0),
        total: r.bySkill.reduce((n, x) => n + x.total, 0),
      },
      { eventKey: `exam.practice.completed:${sessionId}` },
      db,
    );
    return r;
  }
  return computePracticeResult(sessionId, db);
}

export async function abandonPracticeSession(userId: string, sessionId: string, db: PrismaClient = prisma): Promise<void> {
  const s = await loadOwnedSession(userId, sessionId, db);
  if (s.status !== "in_progress") return;
  await db.examPracticeSession.update({ where: { id: sessionId }, data: { status: "abandoned", completedAt: new Date() } });
}

export interface PracticeSkillSummary {
  sessionCount: number;
  lastAt: Date | null;
  skills: { skill: string; correct: number; total: number; pct: number }[];
}

/** Khối "Luyện đề" trên hồ sơ: độ chính xác theo kỹ năng, trên đáp án MỚI NHẤT của từng câu (đã chấm đúng/sai). */
export async function getPracticeSkillSummary(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<PracticeSkillSummary | null> {
  const completed = await db.examPracticeSession.findMany({
    where: { userId, status: "completed", exam: { courseId } },
    select: { id: true, examId: true, completedAt: true },
    orderBy: { completedAt: "desc" },
  });
  if (completed.length === 0) return null;
  const examIds = [...new Set(completed.map((c) => c.examId))];
  const skillOf = new Map<string, string>();
  for (const examId of examIds) for (const q of await loadExamQuestions(examId, db)) skillOf.set(q.id, q.languageSkill ?? "other");
  const rows = await db.examPracticeAnswer.findMany({
    where: { session: { userId, status: "completed", examId: { in: examIds } }, isCorrect: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { questionId: true, isCorrect: true },
  });
  const seen = new Set<string>();
  const agg = new Map<string, { correct: number; total: number }>();
  for (const r of rows) {
    if (seen.has(r.questionId)) continue;
    seen.add(r.questionId);
    const k = skillOf.get(r.questionId) ?? "other";
    const a = agg.get(k) ?? { correct: 0, total: 0 };
    a.total++;
    if (r.isCorrect) a.correct++;
    agg.set(k, a);
  }
  return {
    sessionCount: completed.length,
    lastAt: completed[0]!.completedAt,
    skills: [...agg.entries()].map(([skill, a]) => ({ skill, correct: a.correct, total: a.total, pct: Math.round((a.correct / a.total) * 100) })),
  };
}
