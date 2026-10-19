import { prisma } from "@feedbackme/db";
import type { AssistantContext } from "./teacherAssistant";

const FORUM_STALE_HOURS = 48;

/**
 * Tình hình giảng viên cho trợ lý AI. Chỉ vài phép đếm rẻ (không quét sự kiện học tập như trang chủ): đủ để Limio
 * biết nên nhắc việc gì. `staleLearners` để 0 vì đếm chính xác cần quét LearningEvent theo từng học viên.
 */
export async function loadAssistantContext(userId: string): Promise<AssistantContext> {
  const courses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  });
  const courseIds = courses.map((c) => c.id);
  const none = { pendingEssays: 0, pendingAssignments: 0, staleForumThreads: 0, staleLearners: 0 };
  if (courseIds.length === 0) return { courseTitles: [], courses: [], ...none };

  const forumCutoff = new Date(Date.now() - FORUM_STALE_HOURS * 3600 * 1000);
  const [pendingEssays, pendingAssignments, staleForumThreads] = await Promise.all([
    prisma.answerResponse.count({
      where: { needsGrading: true, manualScore: null, attempt: { quiz: { courseId: { in: courseIds } } } },
    }),
    prisma.assignmentSubmission.count({
      where: { status: "submitted", assignment: { lesson: { module: { courseId: { in: courseIds } } } } },
    }),
    prisma.forumThread.count({
      where: { resolvedPostId: null, createdAt: { lt: forumCutoff }, lesson: { module: { courseId: { in: courseIds } } } },
    }),
  ]);
  return { courseTitles: courses.map((c) => c.title), courses, pendingEssays, pendingAssignments, staleForumThreads, staleLearners: 0 };
}
