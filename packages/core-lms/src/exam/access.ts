import type { PrismaClient } from "@feedbackme/db";
import { isUserEnrolled } from "../learning/enroll";

/**
 * LANG L6.1 — quyền DÙNG NỘI DUNG một đề (làm bài, luyện đề) của người đã đăng nhập:
 *  - đã ghi danh khoá ⇒ được;
 *  - chưa ghi danh nhưng đề đánh dấu học thử miễn phí VÀ khoá là khoá luyện đề ⇒ được;
 *  - còn lại ⇒ không (`not_enrolled`).
 * Cờ `freePreview` ở khoá thường không có tác dụng gì.
 */
export async function canUseExamContent(
  userId: string,
  exam: { courseId: string | null; freePreview: boolean },
  db: PrismaClient,
): Promise<boolean> {
  if (!exam.courseId) return false;
  if (await isUserEnrolled(userId, exam.courseId, db)) return true;
  if (!exam.freePreview) return false;
  const course = await db.course.findUnique({ where: { id: exam.courseId }, select: { kind: true, status: true } });
  // Khoá còn nháp thì chưa mở cho người ngoài, kể cả đề học thử.
  return course?.kind === "practice_bank" && course.status === "published";
}
