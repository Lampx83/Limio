import { prisma } from "@feedbackme/db";

/**
 * Một ĐỢT thật cho đề — dành cho test cần phạm vi đợt (kỳ thi chính thức).
 * Đợt không còn được tự dựng ngầm; test muốn kiểm tra theo đợt thì tạo rõ ràng.
 */
export async function roundFor(examId: string): Promise<string> {
  const exam = await prisma.exam.findUniqueOrThrow({
    where: { id: examId },
    select: { courseId: true, title: true },
  });
  const round = await prisma.examRound.create({
    data: {
      code: `T-${examId.slice(0, 8).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      title: `Đợt — ${exam.title}`,
      opensAt: new Date(),
      closesAt: new Date(Date.now() + 86_400_000),
      status: "draft",
      courseId: exam.courseId!,
    },
    select: { id: true },
  });
  return round.id;
}
