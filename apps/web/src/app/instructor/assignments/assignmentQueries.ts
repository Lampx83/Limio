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
