import { prisma } from "@feedbackme/db";
import { createExamRound, createExamSessionInRound } from "../exam/exam-rounds";
import { openOralExamSession } from "../exam/oral-attempts";

/**
 * Mở đề cho học viên đã ghi danh vào thi — đúng đường giáo viên đi thật.
 *
 * Publish không còn tự dựng ca, nên test nào cần học viên vào làm đề thường
 * phải tổ chức thi rõ ràng:
 *   - thi viết → một đợt chính thức (Đợt › Ca), ca vào bằng tài khoản;
 *   - vấn đáp  → "Mở buổi vấn đáp" như nút trên trang quản lý đề.
 * Khung giờ mặc định đang mở (1 phút trước → 7 ngày sau), lấy giờ của đề nếu có.
 *
 * Trả sessionId để test chỉnh tiếp (đóng ca, đổi giờ…).
 */
export async function openForEnrolled(
  ownerId: string,
  examId: string,
  window: { opensAt?: Date; closesAt?: Date } = {},
): Promise<string> {
  const exam = await prisma.exam.findUniqueOrThrow({
    where: { id: examId },
    select: { kind: true, courseId: true, openAt: true, closeAt: true, title: true },
  });

  if (exam.kind === "oral") {
    const { sessionId } = await openOralExamSession(ownerId, examId);
    return sessionId;
  }

  if (!exam.courseId) throw new Error("openForEnrolled: đề không gắn khoá học");
  const now = Date.now();
  const opensAt = window.opensAt ?? exam.openAt ?? new Date(now - 60_000);
  const closesAt = window.closesAt ?? exam.closeAt ?? new Date(now + 7 * 86_400_000);
  const round = await createExamRound(ownerId, {
    code: `T-${examId.slice(0, 8).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    title: `Đợt — ${exam.title}`,
    courseId: exam.courseId,
  });
  const { id } = await createExamSessionInRound(ownerId, round.id, { examId, opensAt, closesAt });
  return id;
}
