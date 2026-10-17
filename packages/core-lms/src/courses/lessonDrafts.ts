import { prisma, Prisma, type PrismaClient } from "@feedbackme/db";
import type { LessonDraftResult, LessonLook, LessonOutline, LessonWritingMode, SourcePara } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { canEditCourse } from "./authz";
import { ensureLessonTag } from "./autoTags";
import { validateContentPayload } from "./contentSchemas";
import { attachLessonActivity } from "./lessonActivity";

/**
 * Bản nháp "tạo bài từ tài liệu" (bảng LessonDraft). Dịch vụ này chỉ lưu và
 * kiểm quyền; làm sạch dàn ý là việc của tầng gọi (apps/web/src/lib/lessonOutline.ts)
 * — không tin dàn ý từ trình duyệt hay từ AI mà không qua bước đó.
 *
 * Mỗi giảng viên có tối đa một bản nháp đang mở cho mỗi bài học: tạo bản mới
 * thì bản cũ chuyển sang "discarded" (vẫn giữ để tra lại, không xoá).
 */

export class LessonDraftError extends Error {
  constructor(public readonly code: "not_found" | "forbidden" | "invalid_state" | "not_confirmed" | "no_result") {
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
  /** Bài AI đã viết từ dàn ý đã chốt, chờ Áp dụng; null khi chưa tạo hoặc dàn ý đã sửa sau đó. */
  result: LessonDraftResult | null;
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
  result: true,
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
    result: (row.result as unknown as LessonDraftResult | null) ?? null,
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
  // Bài đã viết không còn khớp dàn ý/cách viết mới — bỏ, giảng viên tạo lại sau khi chốt.
  if (contentChanged) data.result = Prisma.DbNull;

  const updated = await db.lessonDraft.update({ where: { id: draftId }, data, select: SELECT });
  return toView(updated, info);
}

export async function discardLessonDraft(userId: string, draftId: string, db: DbClient = prisma): Promise<void> {
  const { row } = await loadOwned(userId, draftId, db);
  if (row.status !== "outline") return;
  await db.lessonDraft.update({ where: { id: draftId }, data: { status: "discarded" } });
}

/** Lưu bài AI vừa viết. Chỉ nhận khi dàn ý vẫn đang ở trạng thái đã chốt (T3). */
export async function saveLessonDraftResult(
  userId: string,
  draftId: string,
  result: LessonDraftResult,
  db: DbClient = prisma,
): Promise<void> {
  const { row } = await loadOwned(userId, draftId, db);
  if (row.status !== "outline") throw new LessonDraftError("invalid_state");
  if (!row.confirmedAt) throw new LessonDraftError("not_confirmed");
  await db.lessonDraft.update({
    where: { id: draftId },
    data: { result: result as unknown as Prisma.InputJsonValue },
  });
}

export interface ApplyLessonDraftResult {
  /** Bài học nhận nội dung, theo thứ tự dàn ý: bài đầu là bài đang mở, các bài sau là bài mới. */
  lessonIds: string[];
  contentItemIds: string[];
}

/**
 * "Áp dụng" (T7): bài thứ nhất thành một khối Văn bản mới ở cuối bài học đang
 * mở; các bài tiếp theo thành bài học MỚI ngay sau, cùng chương, ẩn với học viên
 * cho tới khi giảng viên bật hiện. Tất cả trong một transaction — hoặc đủ, hoặc
 * không có gì. Bài mới đi qua ensureLessonTag như mọi bài tạo tay, nên khoá bật
 * cá nhân hoá vẫn tự có chủ đề (T8).
 */
export async function applyLessonDraft(
  userId: string,
  draftId: string,
  db: PrismaClient = prisma,
): Promise<ApplyLessonDraftResult> {
  const { row } = await loadOwned(userId, draftId, db);
  if (row.status !== "outline") throw new LessonDraftError("invalid_state");
  if (!row.confirmedAt) throw new LessonDraftError("not_confirmed");
  const result = row.result as unknown as LessonDraftResult | null;
  if (!result || result.lessons.length === 0) throw new LessonDraftError("no_result");
  const look = (row.look as unknown as LessonLook | null) ?? undefined;

  const payloadOf = (html: string) => validateContentPayload("richtext", look ? { html, look } : { html });
  // Kiểm hết TRƯỚC khi ghi gì (payload sai thì ném ngay, không để nửa vời).
  const payloads = result.lessons.map((l) => payloadOf(l.html));

  return db.$transaction(async (tx) => {
    const current = await tx.lesson.findUnique({
      where: { id: row.lessonId },
      select: { moduleId: true, orderIndex: true },
    });
    if (!current) throw new LessonDraftError("not_found");

    const addContent = async (lessonId: string, payload: Record<string, unknown>) => {
      const max = await tx.contentItem.aggregate({ where: { lessonId }, _max: { orderIndex: true } });
      const item = await tx.contentItem.create({
        data: {
          lessonId,
          type: "richtext",
          payload: payload as Prisma.InputJsonValue,
          orderIndex: (max._max.orderIndex ?? -1) + 1,
        },
      });
      await attachLessonActivity(tx, lessonId, "content", item.id);
      return item.id;
    };

    const lessonIds = [row.lessonId];
    const contentItemIds = [await addContent(row.lessonId, payloads[0]!)];

    const extra = result.lessons.length - 1;
    if (extra > 0) {
      // Chừa chỗ ngay sau bài đang mở: dời các bài phía sau xuống `extra` bậc.
      // Hai lượt (qua số âm) để không đụng ràng buộc (moduleId, orderIndex) duy nhất.
      const after = await tx.lesson.findMany({
        where: { moduleId: current.moduleId, orderIndex: { gt: current.orderIndex } },
        select: { id: true, orderIndex: true },
        orderBy: { orderIndex: "desc" },
      });
      for (const l of after) await tx.lesson.update({ where: { id: l.id }, data: { orderIndex: -1 - l.orderIndex } });
      for (const l of after) await tx.lesson.update({ where: { id: l.id }, data: { orderIndex: l.orderIndex + extra } });

      for (let i = 1; i < result.lessons.length; i++) {
        const created = await tx.lesson.create({
          data: {
            moduleId: current.moduleId,
            title: (result.lessons[i]!.title || `Bài ${i + 1}`).slice(0, 200),
            orderIndex: current.orderIndex + i,
            isHidden: true,
          },
        });
        await ensureLessonTag(created.id, tx);
        lessonIds.push(created.id);
        contentItemIds.push(await addContent(created.id, payloads[i]!));
      }
    }

    await tx.lessonDraft.update({ where: { id: draftId }, data: { status: "applied" } });
    return { lessonIds, contentItemIds };
  });
}
