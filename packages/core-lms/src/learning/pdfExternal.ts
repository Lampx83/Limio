import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "./events";
import { isUserEnrolled } from "./enroll";
import { LearningError } from "./lessons";

/**
 * Học viên bấm "Mở PDF trong tab mới" (docs/tieu-chi/doc-pdf-theo-trang.md, AC6).
 *
 * Mở tab mới làm tab bài học bị ẩn nên `recordLessonEngagement` chốt lượt đọc, và
 * trình xem PDF của trình duyệt nằm ngoài trang nên không đo được gì trong đó. Cú
 * bấm là dấu vết duy nhất: nó tách "đọc hết PDF ở tab khác" khỏi "mở rồi bỏ đi",
 * hai trường hợp giống hệt nhau trong số giây và số trang.
 *
 * - Mỗi lần bấm một event, KHÔNG chống trùng: mở đi mở lại là tín hiệu thật.
 * - Endpoint do người học tự gọi nên kiểm `contentItemId` thuộc đúng bài này và là
 *   PDF, nếu không ai cũng bơm được event cho khối tuỳ ý làm sai số liệu.
 * - Payload chỉ mang id: tiêu đề và địa chỉ PDF đã nằm ở ContentItem.
 */
export const PdfOpenedExternalInput = z.object({
  contentItemId: z.string().min(1).max(64),
});

export async function recordPdfOpenedExternal(
  userId: string,
  lessonId: string,
  rawContentItemId: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const parsed = PdfOpenedExternalInput.safeParse({ contentItemId: rawContentItemId });
  if (!parsed.success) {
    throw new LearningError("validation_failed", parsed.error.flatten());
  }
  const { contentItemId } = parsed.data;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      module: { select: { courseId: true } },
      contentItems: { where: { id: contentItemId, type: "pdf" }, select: { id: true } },
    },
  });
  if (!lesson) throw new LearningError("lesson_not_found");
  const courseId = lesson.module.courseId;

  // Ghi danh là điều kiện: giảng viên xem thử bài của mình không trộn vào số liệu người học.
  if (!(await isUserEnrolled(userId, courseId, db))) throw new LearningError("not_enrolled");
  if (lesson.contentItems.length === 0) throw new LearningError("content_not_found");

  await emitEvent(
    userId,
    LearningEventType.LessonPdfOpenedExternal,
    { lessonId, contentItemId },
    { courseId },
    db,
  );
}
