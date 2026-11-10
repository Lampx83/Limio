import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { assertCanEditCourse, CourseAuthzError } from "./authz";
import { CourseError } from "./courses";

/**
 * Khối "Đề thi" (`exam_ref`) — docs/tieu-chi/bai-hoc-gan-de-thi.md: gắn một đề thi thử đã có của CHÍNH khoá vào bài học. Khối chỉ lưu
 * `examId` (và tiêu đề tuỳ chọn); thẻ Thi thử / Luyện đề hiện ở bài dùng lại dữ liệu của trang khoá (`listMockExamsForLearner`).
 */

/** Đề có thể gắn vào bài: đề thi thử viết của khoá này, chưa lưu trữ, không phải đề ẩn của một khối Bài luyện. */
const ATTACHABLE_WHERE = {
  mockMode: true,
  kind: "written" as const,
  ownerContentItemId: null,
  status: { in: ["draft" as const, "published" as const] },
};

/** Ném `validation_failed` (`exam_ref_invalid`) nếu `examId` không gắn được vào bài của khoá `courseId`. */
export async function assertExamRefTarget(courseId: string, examId: string, db: DbClient = prisma): Promise<void> {
  const exam = await db.exam.findFirst({ where: { id: examId, courseId, ...ATTACHABLE_WHERE }, select: { id: true } });
  if (!exam) throw new CourseError("validation_failed", "exam_ref_invalid");
}

export interface ExamRefChoice {
  id: string;
  title: string;
  status: "draft" | "published";
  sectionCount: number;
  totalMinutes: number;
}

/** Danh sách đề để chọn trong ô "Đề thi" của trình soạn (chỉ người sửa được khoá). */
export async function listExamRefChoices(actorUserId: string, courseId: string, db: DbClient = prisma): Promise<ExamRefChoice[]> {
  await assertCanEditCourse(actorUserId, courseId, db);
  // owned-practice-ok: ATTACHABLE_WHERE đã có ownerContentItemId: null (loại đề ẩn của Bài luyện).
  const exams = await db.exam.findMany({
    where: { courseId, ...ATTACHABLE_WHERE },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, status: true, sections: { select: { durationMin: true } } },
  });
  return exams.map((e) => ({
    id: e.id,
    title: e.title,
    status: e.status === "published" ? "published" : "draft",
    sectionCount: e.sections.length,
    totalMinutes: e.sections.reduce((n, s) => n + (s.durationMin ?? 0), 0),
  }));
}

export type ExamRefIssue = "ok" | "not_selected" | "missing" | "draft" | "archived" | "other_course" | "modes_off";

export interface ExamRefState {
  examId: string | null;
  title: string | null;
  issue: ExamRefIssue;
  allowMock: boolean;
  allowPractice: boolean;
}

/**
 * Trạng thái của đề mà các khối `exam_ref` trỏ tới, cho giảng viên (trình soạn, "Xem như học viên"). Học viên không dùng hàm này:
 * họ chỉ thấy đề qua `listMockExamsForLearner` (đã lọc đúng điều kiện).
 */
export async function getExamRefStates(courseId: string, examIds: Array<string | null>, db: DbClient = prisma): Promise<Map<string | null, ExamRefState>> {
  const ids = [...new Set(examIds.filter((x): x is string => !!x))];
  // owned-practice-ok: tra theo đúng id mà khối trỏ tới (để báo lý do vì sao đề không dùng được), không phải danh sách đề thi.
  const exams = ids.length
    ? await db.exam.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, status: true, courseId: true, allowMock: true, allowPractice: true } })
    : [];
  const byId = new Map(exams.map((e) => [e.id, e]));
  const out = new Map<string | null, ExamRefState>();
  for (const id of new Set(examIds)) {
    if (!id) {
      out.set(null, { examId: null, title: null, issue: "not_selected", allowMock: false, allowPractice: false });
      continue;
    }
    const e = byId.get(id);
    let issue: ExamRefIssue = "ok";
    if (!e) issue = "missing";
    else if (e.courseId !== courseId) issue = "other_course";
    else if (e.status === "archived") issue = "archived";
    else if (e.status !== "published") issue = "draft";
    else if (!e.allowMock && !e.allowPractice) issue = "modes_off";
    out.set(id, { examId: id, title: e?.title ?? null, issue, allowMock: e?.allowMock ?? false, allowPractice: e?.allowPractice ?? false });
  }
  return out;
}

/**
 * Dữ liệu thẻ đề cho giảng viên "Xem như học viên": cùng hình dạng với `listMockExamsForLearner` nhưng không có lượt thi/buổi luyện
 * (giảng viên thường không ghi danh khoá của mình nên không gọi được hàm của học viên). Null nếu đề không phải đề thi thử của khoá.
 */
export async function getExamRefPreviewCard(courseId: string, examId: string, db: DbClient = prisma) {
  // owned-practice-ok: ATTACHABLE_WHERE đã có ownerContentItemId: null (loại đề ẩn của Bài luyện).
  const e = await db.exam.findFirst({
    where: { id: examId, courseId, ...ATTACHABLE_WHERE },
    select: {
      id: true,
      title: true,
      allowMock: true,
      allowPractice: true,
      sections: { orderBy: { orderIndex: "asc" }, select: { title: true, languageSkill: true, durationMin: true } },
    },
  });
  if (!e) return null;
  const sections = e.sections.map((s) => ({ title: s.title, languageSkill: s.languageSkill as string | null, durationMin: s.durationMin ?? 0 }));
  return {
    examId: e.id,
    title: e.title,
    totalMinutes: sections.reduce((n, s) => n + s.durationMin, 0),
    allowMock: e.allowMock,
    allowPractice: e.allowPractice,
    sections,
    attempt: null,
    attemptCount: 0,
    practice: { inProgress: null, completedCount: 0 },
  };
}

async function courseIdOfLesson(lessonId: string, db: DbClient): Promise<string> {
  const row = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  if (!row) throw new CourseAuthzError("not_found");
  return row.module.courseId;
}

/** Danh sách đề để chọn, theo bài đang thêm khối (chỉ người sửa được khoá). */
export async function listExamRefChoicesForLesson(actorUserId: string, lessonId: string, db: DbClient = prisma): Promise<{ courseId: string; choices: ExamRefChoice[] }> {
  const courseId = await courseIdOfLesson(lessonId, db);
  return { courseId, choices: await listExamRefChoices(actorUserId, courseId, db) };
}

export interface ExamRefBlockInfo extends ExamRefState {
  courseId: string;
}

/** Tóm tắt khối Đề thi cho hàng khối trong trang soạn bài (tên đề, trạng thái, hai công tắc); chỉ người sửa được khoá. */
export async function getExamRefBlockInfo(actorUserId: string, contentId: string, db: DbClient = prisma): Promise<ExamRefBlockInfo> {
  const item = await db.contentItem.findUnique({
    where: { id: contentId },
    select: { type: true, payload: true, lesson: { select: { module: { select: { courseId: true } } } } },
  });
  if (!item || item.type !== "exam_ref") throw new CourseAuthzError("not_found");
  const courseId = item.lesson.module.courseId;
  await assertCanEditCourse(actorUserId, courseId, db);
  const examId = ((item.payload ?? {}) as { examId?: string | null }).examId ?? null;
  const st = (await getExamRefStates(courseId, [examId], db)).get(examId)!;
  return { ...st, courseId };
}
