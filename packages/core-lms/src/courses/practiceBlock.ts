import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { assertCanEditCourse, CourseAuthzError } from "./authz";
import { CourseError } from "./courses";

/**
 * LANG đợt 3b — khối "Bài luyện" của bài học trỏ tới một đề thi thử. Điều kiện để CHỌN đề: cùng khoá, đề thi viết
 * (`written`), là đề thi thử (`mockMode`), đã xuất bản. "Cho luyện đề" (`allowPractice`) KHÔNG bắt buộc ở bước chọn: tắt
 * thì khối vẫn lưu được và học viên thấy thông báo "Bài luyện đang tắt".
 */
const SELECTABLE = { kind: "written", mockMode: true, status: "published" } as const;

export interface SelectablePracticeExam {
  id: string;
  title: string;
  /** Công tắc "Cho luyện đề" — để giảng viên thấy đề nào học viên đang làm được. */
  allowPractice: boolean;
}

export async function assertPracticeBlockExam(courseId: string, examId: string, db: DbClient = prisma): Promise<void> {
  const exam = await db.exam.findFirst({ where: { id: examId, courseId, ...SELECTABLE }, select: { id: true } });
  if (!exam) {
    throw new CourseError("validation_failed", { examId: "Chỉ chọn được đề thi thử đã xuất bản của chính khoá này." });
  }
}

/** Các đề thi thử đã xuất bản của khoá chứa bài này, cho ô chọn đề của giảng viên. */
export async function listSelectablePracticeExams(actorUserId: string, lessonId: string, db: DbClient = prisma): Promise<SelectablePracticeExam[]> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  if (!lesson) throw new CourseAuthzError("not_found");
  const courseId = lesson.module.courseId;
  await assertCanEditCourse(actorUserId, courseId, db);
  const rows = await db.exam.findMany({
    where: { courseId, ...SELECTABLE },
    orderBy: { title: "asc" },
    select: { id: true, title: true, allowPractice: true },
  });
  return rows;
}
