import { prisma } from "@feedbackme/db";

export type AssignmentCounts = { pending: number; graded: number; total: number };

export async function loadAssignmentsWithCounts(moduleIds: string[]) {
  const assignments = await prisma.assignment.findMany({
    where: { lessonId: { not: null }, lesson: { moduleId: { in: moduleIds } } },
    select: {
      id: true,
      title: true,
      dueAt: true,
      maxScore: true,
      isHidden: true,
      createdAt: true,
      lessonId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const submissionCounts = await prisma.assignmentSubmission.groupBy({
    by: ["assignmentId", "status"],
    where: { assignmentId: { in: assignments.map((a) => a.id) } },
    _count: { _all: true },
  });
  const countsByAssignment = new Map<string, AssignmentCounts>();
  for (const row of submissionCounts) {
    const existing = countsByAssignment.get(row.assignmentId) ?? {
      pending: 0,
      graded: 0,
      total: 0,
    };
    if (row.status === "submitted") existing.pending = row._count._all;
    if (row.status === "graded") existing.graded = row._count._all;
    existing.total = existing.pending + existing.graded;
    countsByAssignment.set(row.assignmentId, existing);
  }

  return assignments.map((a) => ({
    ...a,
    counts: countsByAssignment.get(a.id) ?? { pending: 0, graded: 0, total: 0 },
  }));
}

export type QuizStats = {
  attempts: number;
  students: number;
  avgScorePct: number | null;
};

/**
 * Quiz gắn với bài học trong các module đã cho, kèm thống kê lượt nộp.
 * Bỏ quiz cuepoint (1 câu trong video) và quiz thuộc nhiệm vụ tournament —
 * cả hai không hiện trong danh sách quiz của khoá.
 */
export async function loadQuizzesWithStats(moduleIds: string[]) {
  const quizzes = await prisma.quiz.findMany({
    where: {
      lessonId: { not: null },
      lesson: { moduleId: { in: moduleIds } },
      cuepointOnly: false,
      tournamentMissionId: null,
    },
    select: {
      id: true,
      courseId: true,
      title: true,
      isHidden: true,
      lessonId: true,
      createdAt: true,
      _count: { select: { questions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: { in: quizzes.map((q) => q.id) }, status: "submitted" },
    select: { quizId: true, userId: true, scorePct: true },
  });
  const byQuiz = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const list = byQuiz.get(a.quizId);
    if (list) list.push(a);
    else byQuiz.set(a.quizId, [a]);
  }

  return quizzes.map((q) => {
    const list = byQuiz.get(q.id) ?? [];
    const scored = list.filter((a) => a.scorePct != null);
    const stats: QuizStats = {
      attempts: list.length,
      students: new Set(list.map((a) => a.userId)).size,
      avgScorePct: scored.length
        ? scored.reduce((sum, a) => sum + (a.scorePct ?? 0), 0) / scored.length
        : null,
    };
    return { ...q, stats };
  });
}
