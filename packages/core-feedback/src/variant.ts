import { prisma, type PrismaClient } from "@feedbackme/db";

/**
 * B10 — điều kiện feedback của người học, quyết định bởi lớp (CourseSection)
 * mà họ ghi danh vào.
 *
 * Vì sao ở cấp lớp chứ không phải cấp khoá: một giảng viên dạy hai lớp song
 * song của cùng một khoá muốn so sánh feedback cá nhân hoá với đối chứng.
 * `Course.personalizationEnabled` không làm được việc đó — hai lớp dùng chung
 * một khoá nên dùng chung một cờ.
 *
 * Mặc định là `personalized` ở mọi đường thoát (chưa ghi danh, lớp không đọc
 * được, khoá không có lớp). Nghĩa là quên gán điều kiện thì người học vẫn nhận
 * feedback đầy đủ — hỏng dữ liệu thực nghiệm còn hơn hụt phần dạy học.
 */
export type FeedbackVariant = "personalized" | "minimal";

export interface ResolvedVariant {
  variant: FeedbackVariant;
  /** Lớp đã quyết định điều kiện này; null khi người học chưa ghi danh. */
  sectionId: string | null;
}

export async function resolveFeedbackVariant(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<ResolvedVariant> {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: {
      sectionId: true,
      section: { select: { feedbackVariant: true } },
    },
  });
  if (!enrollment?.section) return { variant: "personalized", sectionId: null };
  return {
    variant: enrollment.section.feedbackVariant,
    sectionId: enrollment.sectionId,
  };
}
