import { prisma, type PrismaClient } from "@feedbackme/db";
import { isUserEnrolled } from "../learning/enroll";
import { ExamError } from "./types";

/**
 * LANG G5c — khối "Thi thử" (trước là "Luyện thi") trên trang khoá: các đề thi thử đã xuất bản của khoá,
 * kèm cấu trúc các phần và trạng thái của chính học viên. Trước đây học viên không
 * có đường nào vào đề thi từ trang khoá (chỉ qua link giảng viên gửi).
 */

export interface MockExamCard {
  examId: string;
  title: string;
  totalMinutes: number;
  allowMock: boolean;
  allowPractice: boolean;
  sections: { title: string; languageSkill: string | null; durationMin: number }[];
  /** Lượt thi gần nhất của học viên; null = chưa làm. */
  attempt: { attemptId: string; status: string; submittedAt: Date | null; scorePct: number | null } | null;
  /** Số lượt đã làm (kể cả lượt đang dở). */
  attemptCount: number;
  /**
   * Trạng thái LUYỆN ĐỀ của chính học viên (bảng ExamPracticeSession, tách khỏi lượt thi thử). Không có điểm:
   * luyện đề không phải điểm số.
   */
  practice: {
    /** Buổi luyện đang dở (mỗi đề tối đa một); answered/total = số câu đã trả lời / số câu đã chốt của buổi. */
    inProgress: { sessionId: string; answered: number; total: number } | null;
    /** Số buổi đã hoàn thành. */
    completedCount: number;
  };
}

export async function listMockExamsForLearner(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<MockExamCard[]> {
  if (!(await isUserEnrolled(userId, courseId, db))) throw new ExamError("not_enrolled");
  const exams = await db.exam.findMany({
    where: { ownerContentItemId: null,
      courseId,
      mockMode: true,
      status: "published",
      kind: "written",
      // Còn hiện nếu thi thử HOẶC luyện đề đang bật (tắt cả hai thì học viên không có việc gì làm với đề).
      OR: [{ allowMock: true }, { allowPractice: true }],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      allowMock: true,
      allowPractice: true,
      sections: {
        orderBy: { orderIndex: "asc" },
        select: { title: true, languageSkill: true, durationMin: true },
      },
    },
  });
  if (exams.length === 0) return [];
  const attempts = await db.examAttempt.findMany({
    where: { userId, examId: { in: exams.map((e) => e.id) } },
    orderBy: { startedAt: "desc" },
    select: { id: true, examId: true, status: true, submittedAt: true, scorePct: true },
  });
  const latest = new Map<string, (typeof attempts)[number]>();
  const counts = new Map<string, number>();
  for (const a of attempts) {
    if (!latest.has(a.examId)) latest.set(a.examId, a);
    counts.set(a.examId, (counts.get(a.examId) ?? 0) + 1);
  }

  // Buổi luyện đề của học viên. Lỗi ở đây không được làm mất cả danh sách đề: coi như chưa luyện.
  const examIds = exams.map((e) => e.id);
  const [practiceOpen, practiceDone] = await Promise.all([
    db.examPracticeSession
      .findMany({
        where: { userId, examId: { in: examIds }, status: "in_progress" },
        select: { id: true, examId: true, scope: true, _count: { select: { answers: true } } },
      })
      .catch(() => []),
    db.examPracticeSession
      .groupBy({ by: ["examId"], where: { userId, examId: { in: examIds }, status: "completed" }, _count: { _all: true } })
      .catch(() => []),
  ]);
  const openByExam = new Map(practiceOpen.map((p) => [p.examId, p]));
  const doneByExam = new Map(practiceDone.map((p) => [p.examId, p._count._all]));

  return exams.map((e) => {
    const open = openByExam.get(e.id);
    const sections = e.sections.map((s) => ({
      title: s.title,
      languageSkill: s.languageSkill,
      durationMin: s.durationMin ?? 0,
    }));
    const a = latest.get(e.id);
    return {
      examId: e.id,
      title: e.title,
      totalMinutes: sections.reduce((n, s) => n + s.durationMin, 0),
      allowMock: e.allowMock,
      allowPractice: e.allowPractice,
      sections,
      attempt: a ? { attemptId: a.id, status: a.status, submittedAt: a.submittedAt, scorePct: a.scorePct } : null,
      attemptCount: counts.get(e.id) ?? 0,
      practice: {
        inProgress: open
          ? {
              sessionId: open.id,
              answered: open._count.answers,
              total: ((open.scope as { questionIds?: unknown[] } | null)?.questionIds ?? []).length,
            }
          : null,
        completedCount: doneByExam.get(e.id) ?? 0,
      },
    };
  });
}
