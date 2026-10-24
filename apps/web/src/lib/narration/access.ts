import { prisma } from "@feedbackme/db";
import { canEditCourse, isUserEnrolled } from "@feedbackme/core-lms";

/**
 * Người này có được nghe giọng đọc của bài không. Cùng luật với trang bài học (learn/[slug]/lessons/[lessonId]/page.tsx):
 * ghi danh, người sửa được khoá, khoá cho đọc công khai, hoặc bài xem thử. Chặt hơn trang một điểm: khoá chưa xuất bản
 * chỉ người sửa được khoá mới nghe được, vì giọng đọc là nội dung chưa công bố.
 */
export async function canListenToLesson(userId: string | null, lessonId: string): Promise<boolean> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      isHidden: true,
      isLocked: true,
      previewable: true,
      module: {
        select: { isHidden: true, isLocked: true, course: { select: { id: true, status: true, publicAccess: true } } },
      },
    },
  });
  if (!lesson || lesson.isHidden) return false;
  const course = lesson.module.course;

  const canEdit = userId ? await canEditCourse(userId, course.id) : false;
  if (canEdit) return true;
  if (course.status !== "published") return false;
  if (lesson.module.isHidden || lesson.module.isLocked || lesson.isLocked) return false;

  if (course.publicAccess) return true;
  if (!userId) return false;
  return lesson.previewable || (await isUserEnrolled(userId, course.id));
}
