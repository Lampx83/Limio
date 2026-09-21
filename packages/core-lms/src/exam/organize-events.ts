/**
 * Audit sự kiện cho nhóm "tổ chức thi" (đợt / ca / phòng / thí sinh).
 *
 * Nguyên tắc 1 của dự án: mọi hành động có ý nghĩa nghiệp vụ phải phát
 * `LearningEvent`. Nhóm này từng gần như không có sự kiện nào — không ai truy lại
 * được ai đã mở/đóng ca, đổi quyền trưởng đợt, chuyển thí sinh sang phòng khác.
 *
 * Mỗi hành động là một dòng riêng (eventKey duy nhất), KHÔNG dedupe: hai lần đóng
 * ca liên tiếp là hai sự kiện thật.
 *
 * Quy ước payload: chỉ id, số lượng và tên trường đã đổi. KHÔNG bao giờ đưa mã truy
 * cập (mã mở, mã dự thi, mã phòng, mã giám thị), email hay đường dẫn đặt mật khẩu.
 */

import { randomUUID } from "node:crypto";
import { prisma, type PrismaClient } from "@feedbackme/db";
import type { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";

export type OrganizeScope =
  | { roundId: string }
  | { sessionId: string }
  | { roomId: string }
  | { examId: string }
  | { candidateId: string };

/**
 * Khoá học của đối tượng — cần lấy TRƯỚC khi xoá (sau đó dòng đã mất). null nếu
 * không tìm thấy (đề độc lập không gắn khoá cũng trả null).
 */
export async function courseIdOf(
  scope: OrganizeScope,
  db: PrismaClient = prisma,
): Promise<string | null> {
  if ("roundId" in scope)
    return (
      (await db.examRound.findUnique({ where: { id: scope.roundId }, select: { courseId: true } }))
        ?.courseId ?? null
    );
  if ("sessionId" in scope)
    return (
      (
        await db.examSession.findUnique({
          where: { id: scope.sessionId },
          select: { exam: { select: { courseId: true } } },
        })
      )?.exam.courseId ?? null
    );
  if ("roomId" in scope)
    return (
      (
        await db.examRoom.findUnique({
          where: { id: scope.roomId },
          select: { exam: { select: { courseId: true } } },
        })
      )?.exam.courseId ?? null
    );
  if ("candidateId" in scope)
    return (
      (
        await db.examCandidate.findUnique({
          where: { id: scope.candidateId },
          select: { exam: { select: { courseId: true } } },
        })
      )?.exam.courseId ?? null
    );
  return (
    (await db.exam.findUnique({ where: { id: scope.examId }, select: { courseId: true } }))
      ?.courseId ?? null
  );
}

export async function emitOrganizeEvent(
  actorUserId: string,
  type: LearningEventType,
  payload: Record<string, unknown>,
  courseId: string | null,
  db: PrismaClient = prisma,
): Promise<void> {
  await emitEvent(
    actorUserId,
    type,
    payload,
    { courseId: courseId ?? undefined, eventKey: `${type}:${randomUUID()}` },
    db,
  );
}

/** Tên các trường được gửi lên (đã thành công), để biết đổi cái gì mà không lưu giá trị. */
export function changedFields(raw: unknown): string[] {
  return raw && typeof raw === "object" ? Object.keys(raw as object) : [];
}
