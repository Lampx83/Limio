import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanGradeExam } from "../courses/authz";
import {
  compareSectionResults,
  computeSectionResults,
  type SectionResult,
  type SectionTrend,
  type ScoreBand,
} from "./section-results";
import { ExamError } from "./types";

/**
 * LANG G5d — kết quả theo phần của đề thi thử, đọc từ đáp án đã chấm (dẫn xuất khi đọc, không
 * lưu thêm: đề đã có lượt thi không đổi cấu trúc nên kết quả luôn dựng lại được).
 */

export interface MockAttemptResult {
  attemptId: string;
  examId: string;
  sections: SectionResult[];
  /** Lượt trước (đã nộp) của cùng người cùng đề; null nếu đây là lượt đầu. */
  previous: { attemptId: string; submittedAt: Date | null } | null;
  /** Xu hướng từng phần so với lượt trước; null = không so được. */
  trends: Record<string, SectionTrend>;
  timeSpentSec: number;
  allowedSec: number;
}

async function loadSections(examId: string, db: PrismaClient) {
  const sections = await db.examSection.findMany({
    where: { examId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      languageSkill: true,
      scoreBands: true,
      items: { orderBy: { orderInSection: "asc" }, select: { question: { select: { id: true, points: true } } } },
    },
  });
  return sections.map((s) => ({
    id: s.id,
    title: s.title,
    languageSkill: s.languageSkill as string | null,
    scoreBands: (Array.isArray(s.scoreBands) ? (s.scoreBands as unknown as ScoreBand[]) : null) as ScoreBand[] | null,
    questions: s.items.map((i) => ({ id: i.question.id, points: i.question.points })),
  }));
}

async function resultsOf(attemptId: string, examId: string, db: PrismaClient): Promise<SectionResult[]> {
  const [sections, answers] = await Promise.all([
    loadSections(examId, db),
    db.examAnswer.findMany({
      where: { attemptId },
      select: { questionId: true, autoScore: true, manualScore: true, needsGrading: true },
    }),
  ]);
  return computeSectionResults({ sections, answers });
}

async function build(
  attempt: { id: string; examId: string; userId: string | null; startedAt: Date; submittedAt: Date | null; durationSec: number },
  db: PrismaClient,
): Promise<MockAttemptResult> {
  const sections = await resultsOf(attempt.id, attempt.examId, db);
  const prev = attempt.userId
    ? await db.examAttempt.findFirst({
        where: {
          examId: attempt.examId,
          userId: attempt.userId,
          status: { not: "in_progress" },
          startedAt: { lt: attempt.startedAt },
        },
        orderBy: { startedAt: "desc" },
        select: { id: true, submittedAt: true },
      })
    : null;
  const prevSections = prev ? await resultsOf(prev.id, attempt.examId, db) : null;
  const end = attempt.submittedAt ?? new Date();
  const spent = Math.max(0, Math.round((end.getTime() - attempt.startedAt.getTime()) / 1000));
  return {
    attemptId: attempt.id,
    examId: attempt.examId,
    sections,
    previous: prev ? { attemptId: prev.id, submittedAt: prev.submittedAt } : null,
    trends: compareSectionResults(sections, prevSections),
    timeSpentSec: Math.min(spent, attempt.durationSec),
    allowedSec: attempt.durationSec,
  };
}

const ATTEMPT_SELECT = {
  id: true,
  examId: true,
  userId: true,
  status: true,
  startedAt: true,
  submittedAt: true,
  durationSec: true,
  exam: { select: { mockMode: true, courseId: true, createdById: true } },
} as const;

/** Học viên xem kết quả theo phần của lượt thi CỦA MÌNH. null nếu không phải đề thi thử. */
export async function getMockAttemptResult(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<MockAttemptResult | null> {
  const attempt = await db.examAttempt.findUnique({ where: { id: attemptId }, select: ATTEMPT_SELECT });
  if (!attempt) throw new ExamError("attempt_not_found");
  if (attempt.userId !== userId) throw new ExamError("attempt_belongs_to_other");
  if (attempt.status === "in_progress") throw new ExamError("validation_failed", "attempt_in_progress");
  if (!attempt.exam.mockMode) return null;
  return build(attempt, db);
}

/** Giảng viên/trợ giảng có quyền chấm đề xem kết quả theo phần của một lượt thi. */
export async function getMockAttemptResultForStaff(
  actorUserId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<MockAttemptResult | null> {
  const attempt = await db.examAttempt.findUnique({ where: { id: attemptId }, select: ATTEMPT_SELECT });
  if (!attempt) throw new ExamError("attempt_not_found");
  await assertCanGradeExam(actorUserId, attempt.exam, db);
  if (attempt.status === "in_progress") throw new ExamError("validation_failed", "attempt_in_progress");
  if (!attempt.exam.mockMode) return null;
  return build(attempt, db);
}

export interface MockSkillSummary {
  attemptId: string;
  examId: string;
  examTitle: string;
  submittedAt: Date | null;
  attemptCount: number;
  skills: {
    skill: string;
    /** Phần trăm điểm của kỹ năng ở lượt mới nhất; null nếu có phần còn chờ chấm. */
    pct: number | null;
    previousPct: number | null;
    pending: boolean;
    trend: SectionTrend;
  }[];
}

type SkillAgg = { score: number; max: number; pending: boolean };
function bySkill(sections: SectionResult[]): Map<string, SkillAgg> {
  const m = new Map<string, SkillAgg>();
  for (const s of sections) {
    if (!s.languageSkill) continue;
    const a = m.get(s.languageSkill) ?? { score: 0, max: 0, pending: false };
    a.max += s.maxScore;
    if (s.score === null) a.pending = true;
    else a.score += s.score;
    m.set(s.languageSkill, a);
  }
  return m;
}
const pctOf = (a: SkillAgg | undefined): number | null =>
  !a || a.pending || a.max <= 0 ? null : Math.round((a.score / a.max) * 100);

/**
 * Khối "Thi thử" trên hồ sơ 4 kỹ năng: lượt thi thử mới nhất của học viên trong khoá, nhóm theo
 * kỹ năng của phần, so với lượt trước của CÙNG đề. Tách hẳn khỏi nhãn Cần ôn/Nên luyện/Vững
 * (chưa có đường từ bài thi sang BKT).
 */
export async function getMockSkillSummary(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<MockSkillSummary | null> {
  const latest = await db.examAttempt.findFirst({
    where: { userId, status: { not: "in_progress" }, exam: { courseId, mockMode: true, kind: "written" } },
    orderBy: { startedAt: "desc" },
    select: { ...ATTEMPT_SELECT, exam: { select: { title: true, mockMode: true, courseId: true, createdById: true } } },
  });
  if (!latest) return null;
  const [cur, count] = await Promise.all([
    build(latest, db),
    db.examAttempt.count({ where: { examId: latest.examId, userId, status: { not: "in_progress" } } }),
  ]);
  const prevSections = cur.previous ? await resultsOf(cur.previous.attemptId, latest.examId, db) : null;
  const curBy = bySkill(cur.sections);
  const prevBy = prevSections ? bySkill(prevSections) : new Map<string, SkillAgg>();
  const skills = [...curBy.entries()].map(([skill, a]) => {
    const pct = pctOf(a);
    const previousPct = pctOf(prevBy.get(skill));
    const trend: SectionTrend = pct === null || previousPct === null ? null : pct === previousPct ? "same" : pct > previousPct ? "up" : "down";
    return { skill, pct, previousPct, pending: a.pending, trend };
  });
  return {
    attemptId: latest.id,
    examId: latest.examId,
    examTitle: latest.exam.title,
    submittedAt: latest.submittedAt,
    attemptCount: count,
    skills,
  };
}
