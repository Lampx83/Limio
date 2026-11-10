import { prisma, type PrismaClient, type VanDapExam } from "@feedbackme/db";
import { assertCanEditExam, CourseAuthzError } from "../courses/authz";
import { VanDapError } from "./types";

/**
 * Đọc/sửa đề Limio Vấn đáp: dùng CHUNG kiểm quyền sửa đề hiện có (assertCanEditExam) — chủ đề, hoặc người sửa được
 * khoá chứa đề. Không tự viết lại luật quyền (AC1.12). Người không có quyền và đề không tồn tại cho cùng một
 * kết quả với người ngoài là không cần thiết: đề không tồn tại → not_found, có nhưng không được sửa → forbidden.
 */
export async function loadEditableVanDapExam(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<VanDapExam> {
  const exam = await db.vanDapExam.findUnique({ where: { id: examId } });
  if (!exam) throw new VanDapError("not_found");
  try {
    await assertCanEditExam(actorUserId, { courseId: exam.courseId, createdById: exam.createdById }, db);
  } catch (e) {
    if (e instanceof CourseAuthzError) throw new VanDapError("forbidden");
    throw e;
  }
  return exam;
}

/** Tài liệu, dàn và kịch bản chỉ sửa được khi đề còn nháp; rubric và ghi chú giọng điệu thì không bị khoá. */
export async function loadDraftVanDapExam(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<VanDapExam> {
  const exam = await loadEditableVanDapExam(actorUserId, examId, db);
  if (exam.status !== "draft") throw new VanDapError("exam_locked");
  return exam;
}
