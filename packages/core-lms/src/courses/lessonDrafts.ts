import { prisma, Prisma, type PrismaClient } from "@feedbackme/db";
import type { LessonLook, LessonOutline, LessonWritingMode, SourcePara } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { canEditCourse } from "./authz";

/**
 * Bản nháp "tạo bài từ tài liệu" (bảng LessonDraft). Dịch vụ này chỉ lưu và
 * kiểm quyền; làm sạch dàn ý là việc của tầng gọi (apps/web/src/lib/lessonOutline.ts)
 * — không tin dàn ý từ trình duyệt hay từ AI mà không qua bước đó.
 *
 * Mỗi giảng viên có tối đa một bản nháp đang mở cho mỗi bài học: tạo bản mới
 * thì bản cũ chuyển sang "discarded" (vẫn giữ để tra lại, không xoá).
 */

export class LessonDraftError extends Error {
  constructor(public readonly code: "not_found" | "forbidden" | "invalid_state") {
    super(code);
  }
}

export type LessonDraftStatus = "outline" | "applied" | "discarded";

export interface LessonDraftView {
  id: string;
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  sourceName: string;
  sourceKind: string;
  sourceParas: SourcePara[];
  outline: LessonOutline;
  look: LessonLook | null;
  writing: LessonWritingMode;
  addObjectivesSummary: boolean;
  confirmedAt: Date | null;
  status: LessonDraftStatus;
  updatedAt: Date;
}

async function courseOfLesson(lessonId: string, db: DbClient) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { title: true, module: { select: { courseId: true } } },
  });
  if (!lesson) throw new LessonDraftError("not_found");
  return { courseId: lesson.module.courseId, lessonTitle: lesson.title };
}

/** Ném lỗi nếu người dùng không sửa được khoá chứa bài học. Trả về courseId. */
export async function assertCanEditLesson(userId: string, lessonId: string, db: DbClient = prisma) {
  const info = await courseOfLesson(lessonId, db);
  if (!(await canEditCourse(userId, info.courseId, db))) throw new LessonDraftError("forbidden");
  return info;
}

const SELECT = {
  id: true,
  lessonId: true,
  userId: true,
  sourceName: true,
  sourceKind: true,
  sourceParas: true,
  outline: true,
  look: true,
  writing: true,
  addObjectivesSummary: true,
  confirmedAt: true,
  status: true,
  updatedAt: true,
} as const;

type Row = Prisma.LessonDraftGetPayload<{ select: typeof SELECT }>;

function toView(row: Row, info: { courseId: string; lessonTitle: string }): LessonDraftView {
  return {
    id: row.id,
    lessonId: row.lessonId,
    courseId: info.courseId,
    lessonTitle: info.lessonTitle,
    sourceName: row.sourceName,
    sourceKind: row.sourceKind,
    sourceParas: row.sourceParas as unknown as SourcePara[],
    outline: row.outline as unknown as LessonOutline,
    look: (row.look as unknown as LessonLook | null) ?? null,
    writing: row.writing === "edit" ? "edit" : "keep",
    addObjectivesSummary: row.addObjectivesSummary,
    confirmedAt: row.confirmedAt,
    status: row.status as LessonDraftStatus,
    updatedAt: row.updatedAt,
  };
}

export interface CreateLessonDraftInput {
  sourceName: string;
  sourceKind: string;
  sourceParas: SourcePara[];
  outline: LessonOutline;
  look?: LessonLook | null;
}

export async function createLessonDraft(
  userId: string,
  lessonId: string,
  input: CreateLessonDraftInput,
  // Cần transaction riêng (bỏ bản cũ + tạo bản mới) nên không nhận client trong transaction.
  db: PrismaClient = prisma,
): Promise<LessonDraftView> {
  const info = await assertCanEditLesson(userId, lessonId, db);
  const row = await db.$transaction(async (tx) => {
    await tx.lessonDraft.updateMany({
      where: { lessonId, userId, status: "outline" },
      data: { status: "discarded" },
    });
    return tx.lessonDraft.create({
      data: {
        lessonId,
        userId,
        sourceName: input.sourceName.slice(0, 200),
        sourceKind: input.sourceKind,
        sourceParas: input.sourceParas as unknown as Prisma.InputJsonValue,
        outline: input.outline as unknown as Prisma.InputJsonValue,
        look: (input.look ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      },
      select: SELECT,
    });
  });
  return toView(row, info);
}

/** Bản nháp đang mở của chính người dùng cho bài học này (để quay lại làm tiếp). */
export async function getActiveLessonDraftId(
  userId: string,
  lessonId: string,
  db: DbClient = prisma,
): Promise<string | null> {
  await assertCanEditLesson(userId, lessonId, db);
  const row = await db.lessonDraft.findFirst({
    where: { lessonId, userId, status: "outline" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function loadOwned(userId: string, draftId: string, db: DbClient) {
  const row = await db.lessonDraft.findUnique({ where: { id: draftId }, select: SELECT });
  // Bản nháp của người khác coi như không tồn tại — không lộ là có.
  if (!row || row.userId !== userId) throw new LessonDraftError("not_found");
  // Mất quyền sửa khoá (bị gỡ khỏi khoá) thì cũng mất quyền với bản nháp.
  const info = await assertCanEditLesson(userId, row.lessonId, db);
  return { row, info };
}

export async function getLessonDraft(userId: string, draftId: string, db: DbClient = prisma): Promise<LessonDraftView> {
  const { row, info } = await loadOwned(userId, draftId, db);
  return toView(row, info);
}

export interface UpdateLessonDraftInput {
  outline?: LessonOutline;
  look?: LessonLook | null;
  writing?: LessonWritingMode;
  addObjectivesSummary?: boolean;
  /**
   * true = chốt dàn ý. Tầng gọi phải kiểm dàn ý không còn lỗi chặn TRƯỚC khi
   * truyền cờ này. Mọi thay đổi nội dung dàn ý mà không kèm cờ này đều bỏ chốt.
   */
  confirm?: boolean;
}

export async function updateLessonDraft(
  userId: string,
  draftId: string,
  input: UpdateLessonDraftInput,
  db: DbClient = prisma,
): Promise<LessonDraftView> {
  const { row, info } = await loadOwned(userId, draftId, db);
  if (row.status !== "outline") throw new LessonDraftError("invalid_state");

  const data: Prisma.LessonDraftUpdateInput = {};
  // Đổi thứ ảnh hưởng tới bài AI sẽ viết ⇒ phải chốt lại. Bảng màu chỉ là hình
  // thức (đổi lúc nào cũng được, kể cả sau khi tạo bài) nên không bỏ chốt.
  let contentChanged = false;
  if (input.outline !== undefined) {
    data.outline = input.outline as unknown as Prisma.InputJsonValue;
    contentChanged = true;
  }
  if (input.writing !== undefined && input.writing !== row.writing) {
    data.writing = input.writing;
    contentChanged = true;
  }
  if (input.addObjectivesSummary !== undefined && input.addObjectivesSummary !== row.addObjectivesSummary) {
    data.addObjectivesSummary = input.addObjectivesSummary;
    contentChanged = true;
  }
  if (input.look !== undefined) {
    data.look = input.look === null ? Prisma.DbNull : (input.look as unknown as Prisma.InputJsonValue);
  }
  if (input.confirm) data.confirmedAt = new Date();
  else if (contentChanged) data.confirmedAt = null;

  const updated = await db.lessonDraft.update({ where: { id: draftId }, data, select: SELECT });
  return toView(updated, info);
}

export async function discardLessonDraft(userId: string, draftId: string, db: DbClient = prisma): Promise<void> {
  const { row } = await loadOwned(userId, draftId, db);
  if (row.status !== "outline") return;
  await db.lessonDraft.update({ where: { id: draftId }, data: { status: "discarded" } });
}
