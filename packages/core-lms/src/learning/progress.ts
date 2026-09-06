import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";

export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  courseCompletionPct: number;
  modules: Array<{
    id: string;
    title: string;
    completionPct: number;
    lessons: Array<{
      id: string;
      title: string;
      completed: boolean;
    }>;
  }>;
}

/**
 * Compute progress for (user, course) by joining course structure with the
 * set of `lesson.completed` events the user has emitted for this course.
 */
export async function getCourseProgress(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<CourseProgress> {
  const [modulesWithLessons, completedRows] = await Promise.all([
    // Chỉ nội dung học viên thực sự thấy. Không lọc ở đây thì mục lục bài học
    // liệt kê đủ tên module và tên bài mà giảng viên vừa ẩn đi — kể cả khi
    // đang chiếu lên máy chiếu — và mẫu số tiến độ tính cả những bài chưa mở,
    // nên không ai đạt nổi 100% để nhận chứng chỉ.
    db.module.findMany({
      where: { courseId, isHidden: false },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        title: true,
        lessons: {
          where: { isHidden: false },
          orderBy: { orderIndex: "asc" },
          select: { id: true, title: true },
        },
      },
    }),
    db.learningEvent.findMany({
      where: {
        userId,
        courseId,
        eventType: LearningEventType.LessonCompleted,
      },
      select: { payload: true },
    }),
  ]);

  const completedSet = new Set<string>(
    completedRows.flatMap((r) => {
      const p = r.payload as { lessonId?: string } | null;
      return p?.lessonId ? [p.lessonId] : [];
    }),
  );

  let totalLessons = 0;
  let completedLessons = 0;
  const modules = modulesWithLessons.map((m) => {
    const lessons = m.lessons.map((l) => {
      const completed = completedSet.has(l.id);
      totalLessons++;
      if (completed) completedLessons++;
      return { id: l.id, title: l.title, completed };
    });
    const moduleTotal = lessons.length;
    const moduleDone = lessons.filter((l) => l.completed).length;
    return {
      id: m.id,
      title: m.title,
      completionPct: moduleTotal === 0 ? 0 : Math.round((moduleDone / moduleTotal) * 100),
      lessons,
    };
  });

  return {
    courseId,
    totalLessons,
    completedLessons,
    courseCompletionPct:
      totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    modules,
  };
}
