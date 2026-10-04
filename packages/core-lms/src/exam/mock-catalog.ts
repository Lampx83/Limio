import { prisma, type PrismaClient } from "@feedbackme/db";
import { isUserEnrolled } from "../learning/enroll";
import { ExamError } from "./types";

/**
 * LANG G5c — mục "Luyện thi" trên trang khoá: các đề thi thử đã xuất bản của khoá,
 * kèm cấu trúc các phần và trạng thái của chính học viên. Trước đây học viên không
 * có đường nào vào đề thi từ trang khoá (chỉ qua link giảng viên gửi).
 */

export interface MockExamCard {
  examId: string;
  title: string;
  totalMinutes: number;
  sections: { title: string; languageSkill: string | null; durationMin: number }[];
  /** Lượt thi gần nhất của học viên; null = chưa làm. */
  attempt: { attemptId: string; status: string; submittedAt: Date | null; scorePct: number | null } | null;
  /** Số lượt đã làm (kể cả lượt đang dở). */
  attemptCount: number;
}

export async function listMockExamsForLearner(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<MockExamCard[]> {
  if (!(await isUserEnrolled(userId, courseId, db))) throw new ExamError("not_enrolled");
  const exams = await db.exam.findMany({
    where: { courseId, mockMode: true, allowMock: true, status: "published", kind: "written" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
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

  return exams.map((e) => {
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
      sections,
      attempt: a ? { attemptId: a.id, status: a.status, submittedAt: a.submittedAt, scorePct: a.scorePct } : null,
      attemptCount: counts.get(e.id) ?? 0,
    };
  });
}
