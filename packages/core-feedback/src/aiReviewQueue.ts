import { prisma, type PrismaClient } from "@feedbackme/db";

/**
 * LANG L3.1 — hàng đợi góp ý AI chờ giảng viên duyệt (bản nháp Viết G6 + Nói G7). Chỉ ĐỌC; việc duyệt đi qua
 * `reviewWritingFeedback` / `reviewSpeakingFeedback` (tầng gọi tự kiểm quyền chấm khoá — core-feedback không
 * import core-lms). `courseIds` do tầng gọi truyền vào đã là khoá người xem có quyền.
 */

export interface PendingAiCounts {
  writing: number;
  speaking: number;
  total: number;
}

export async function countPendingAiFeedback(courseIds: string[], db: PrismaClient = prisma): Promise<PendingAiCounts> {
  if (courseIds.length === 0) return { writing: 0, speaking: 0, total: 0 };
  const where = { courseId: { in: courseIds }, status: "draft" as const };
  const [writing, speaking] = await Promise.all([db.writingFeedback.count({ where }), db.speakingFeedback.count({ where })]);
  return { writing, speaking, total: writing + speaking };
}

export interface PendingAiItem {
  kind: "writing" | "speaking";
  feedbackId: string;
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  studentName: string;
  generatedAt: Date;
}

export async function listPendingAiFeedback(courseIds: string[], limit = 20, db: PrismaClient = prisma): Promise<PendingAiItem[]> {
  if (courseIds.length === 0) return [];
  const where = { courseId: { in: courseIds }, status: "draft" as const };
  const select = {
    id: true,
    courseId: true,
    generatedAt: true,
    submissionId: true,
    user: { select: { displayName: true } },
    submission: { select: { assignmentId: true, assignment: { select: { title: true } } } },
  };
  const [w, s] = await Promise.all([
    db.writingFeedback.findMany({ where, orderBy: { generatedAt: "asc" }, take: limit, select }),
    db.speakingFeedback.findMany({ where, orderBy: { generatedAt: "asc" }, take: limit, select }),
  ]);
  const toItem = (kind: PendingAiItem["kind"]) => (r: (typeof w)[number]): PendingAiItem => ({
    kind,
    feedbackId: r.id,
    submissionId: r.submissionId,
    assignmentId: r.submission.assignmentId,
    assignmentTitle: r.submission.assignment.title,
    courseId: r.courseId,
    studentName: r.user.displayName,
    generatedAt: r.generatedAt,
  });
  return [...w.map(toItem("writing")), ...s.map(toItem("speaking"))]
    .sort((a, b) => a.generatedAt.getTime() - b.generatedAt.getTime())
    .slice(0, limit);
}
