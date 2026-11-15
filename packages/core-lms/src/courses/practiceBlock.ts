import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { emitEvent } from "../learning/events";
import { assertCanEditCourse, CourseAuthzError } from "./authz";

/**
 * Khối "Bài luyện" của bài học SỞ HỮU nội dung của chính nó (docs/tieu-chi/limio-language-bai-luyen-editor.md).
 *
 * Nội dung (đoạn văn, câu hỏi, giải thích đáp án) nằm trong MỘT bản đề ẩn: `Exam.ownerContentItemId` trỏ về khối. Đề này
 * KHÔNG phải đề thi — giảng viên không bao giờ thấy nó ở mục Đề thi và soạn nó ở editor riêng. Dùng lại đề để giữ
 * nguyên chấm câu, phiên luyện, lưu đáp án và cầu nối nhãn kỹ năng của phía học viên.
 *
 * Đề ẩn luôn: đã xuất bản nội bộ, thi thử + cho luyện (để bộ máy luyện đề nhận), MỘT phần duy nhất chứa mọi câu.
 */
export const PRACTICE_SECTION_TITLE = "Bài luyện";
const PRACTICE_DEFAULT_TITLE = "Bài luyện";
/** Khung giờ "mở mãi": đề ẩn không có lịch thi, hai cột này chỉ để thoả NOT NULL. */
const PRACTICE_CLOSE_AT = new Date("2100-01-01T00:00:00.000Z");

/** Điều kiện loại đề có chủ khỏi mọi danh sách đề thi (AC8). Dùng trong `where` của mọi truy vấn liệt kê `exam`. */
export const EXCLUDE_OWNED_PRACTICE = { ownerContentItemId: null } as const;

type Tx = Prisma.TransactionClient | PrismaClient;

/** Tạo bản đề ẩn + phần duy nhất cho một khối vừa tạo. Gọi TRONG giao dịch tạo khối. */
export async function createOwnedPracticeExam(
  tx: Tx,
  o: { contentItemId: string; courseId: string; actorUserId: string | null; title?: string | null },
): Promise<{ examId: string; sectionId: string }> {
  const exam = await tx.exam.create({
    data: {
      courseId: o.courseId,
      createdById: o.actorUserId,
      ownerContentItemId: o.contentItemId,
      title: o.title?.trim() || PRACTICE_DEFAULT_TITLE,
      durationMin: 60,
      openAt: new Date(),
      closeAt: PRACTICE_CLOSE_AT,
      kind: "written",
      mockMode: true,
      allowPractice: true,
      status: "published",
      publishedAt: new Date(),
      showResultsAfterSubmit: true,
    },
    select: { id: true },
  });
  const section = await tx.examSection.create({
    data: { examId: exam.id, title: PRACTICE_SECTION_TITLE, orderIndex: 0 },
    select: { id: true },
  });
  return { examId: exam.id, sectionId: section.id };
}

/** Id đề ẩn của một khối (null nếu khối không phải Bài luyện hoặc chưa có đề). */
export async function getOwnedPracticeExamId(contentItemId: string, db: DbClient = prisma): Promise<string | null> {
  const e = await db.exam.findUnique({ where: { ownerContentItemId: contentItemId }, select: { id: true } });
  return e?.id ?? null;
}

/** Đồng bộ tên đề ẩn với tiêu đề khối (để học viên thấy đúng tên). */
export async function syncOwnedPracticeTitle(contentItemId: string, title: string | null | undefined, db: DbClient = prisma): Promise<void> {
  await db.exam.updateMany({
    where: { ownerContentItemId: contentItemId },
    data: { title: title?.trim() || PRACTICE_DEFAULT_TITLE },
  });
}

/** Thay mọi id tệp cũ bằng id mới trong một cấu trúc JSON (đoạn văn/câu tham chiếu tệp đính kèm bằng id). */
function remapIds<T>(value: T, idMap: Map<string, string>): T {
  if (idMap.size === 0) return value;
  let json = JSON.stringify(value);
  for (const [from, to] of idMap) json = json.split(from).join(to);
  return JSON.parse(json) as T;
}

/**
 * Sao chép SÂU nội dung Bài luyện của một khối sang một khối mới (nhân bản bài hoặc khoá): đề ẩn mới, phần, tệp đính
 * kèm, đoạn và câu độc lập với bản gốc. Không chép lượt luyện của học viên. Khối nguồn không có đề ẩn thì tạo đề rỗng.
 */
export async function copyOwnedPracticeExam(
  tx: Prisma.TransactionClient,
  o: { sourceContentItemId: string; targetContentItemId: string; targetCourseId: string; actorUserId?: string | null },
): Promise<{ examId: string }> {
  const src = await tx.exam.findUnique({
    where: { ownerContentItemId: o.sourceContentItemId },
    include: {
      assets: true,
      passages: { orderBy: { orderIndex: "asc" } },
      questions: { include: { sectionItem: true }, orderBy: { orderInExam: "asc" } },
      sections: { orderBy: { orderIndex: "asc" } },
    },
  });
  if (!src) {
    const created = await createOwnedPracticeExam(tx, {
      contentItemId: o.targetContentItemId,
      courseId: o.targetCourseId,
      actorUserId: o.actorUserId ?? null,
    });
    return { examId: created.examId };
  }
  const exam = await tx.exam.create({
    data: {
      courseId: o.targetCourseId,
      // Nhân bản khoá không biết người thao tác (cloneModuleTree không kiểm quyền): giữ người tạo của bản gốc.
      createdById: o.actorUserId ?? src.createdById,
      ownerContentItemId: o.targetContentItemId,
      title: src.title,
      durationMin: src.durationMin,
      openAt: new Date(),
      closeAt: PRACTICE_CLOSE_AT,
      kind: "written",
      mockMode: true,
      allowPractice: true,
      status: "published",
      publishedAt: new Date(),
      showResultsAfterSubmit: true,
    },
    select: { id: true },
  });

  // Tệp đính kèm: hàng mới, cùng khoá lưu trữ; đoạn/câu tham chiếu bằng id nên phải đổi sang id mới.
  const assetMap = new Map<string, string>();
  for (const a of src.assets) {
    const n = await tx.examAsset.create({
      data: {
        examId: exam.id,
        type: a.type,
        s3Key: a.s3Key,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        metadata: a.metadata === null ? Prisma.JsonNull : (a.metadata as Prisma.InputJsonValue),
        altText: a.altText,
        transcript: a.transcript,
        uploadedById: a.uploadedById,
      },
      select: { id: true },
    });
    assetMap.set(a.id, n.id);
  }

  const passageMap = new Map<string, string>();
  for (const p of src.passages) {
    const n = await tx.examPassage.create({
      data: {
        examId: exam.id,
        title: p.title,
        contentJson: remapIds(p.contentJson, assetMap) as Prisma.InputJsonValue,
        orderIndex: p.orderIndex,
        audioPolicy: p.audioPolicy,
        maxAudioPlays: p.maxAudioPlays,
        revealMode: p.revealMode,
      },
      select: { id: true },
    });
    passageMap.set(p.id, n.id);
  }

  const sectionMap = new Map<string, string>();
  for (const s of src.sections) {
    const n = await tx.examSection.create({
      data: { examId: exam.id, title: s.title, orderIndex: s.orderIndex },
      select: { id: true },
    });
    sectionMap.set(s.id, n.id);
  }

  for (const q of src.questions) {
    const nq = await tx.examQuestion.create({
      data: {
        examId: exam.id,
        passageId: q.passageId ? (passageMap.get(q.passageId) ?? null) : null,
        type: q.type,
        prompt: remapIds(q.prompt, assetMap),
        config: remapIds(q.config, assetMap) as Prisma.InputJsonValue,
        points: q.points,
        orderInExam: q.orderInExam,
        orderInPassage: q.orderInPassage,
      },
      select: { id: true },
    });
    const newSectionId = q.sectionItem ? sectionMap.get(q.sectionItem.sectionId) : undefined;
    if (q.sectionItem && newSectionId) {
      await tx.examSectionItem.create({
        data: { sectionId: newSectionId, examQuestionId: nq.id, orderInSection: q.sectionItem.orderInSection, points: q.sectionItem.points },
      });
    }
  }
  return { examId: exam.id };
}

export interface PracticeBlockSummary {
  /** Id đề ẩn của khối (null nếu khối chưa có đề — không nên xảy ra). */
  examId: string | null;
  passages: number;
  questions: number;
}

/** Id đề ẩn, số đoạn và số câu của từng khối Bài luyện (cho hàng khối trong bài và cho trang học viên). */
export async function getPracticeBlockSummaries(contentItemIds: string[], db: DbClient = prisma): Promise<Record<string, PracticeBlockSummary>> {
  if (contentItemIds.length === 0) return {};
  const exams = await db.exam.findMany({
    where: { ownerContentItemId: { in: contentItemIds } },
    select: { id: true, ownerContentItemId: true, _count: { select: { passages: true, questions: true } } },
  });
  const out: Record<string, PracticeBlockSummary> = {};
  for (const id of contentItemIds) out[id] = { examId: null, passages: 0, questions: 0 };
  for (const e of exams) {
    if (e.ownerContentItemId) out[e.ownerContentItemId] = { examId: e.id, passages: e._count.passages, questions: e._count.questions };
  }
  return out;
}

export interface PracticeCheckProgress {
  /** Tổng số câu của các khối luyện (chỉ khối có ≥ 1 câu). */
  total: number;
  /** Số câu học viên đã bấm Kiểm tra (ở bất kỳ buổi luyện nào của đề đó). */
  checked: number;
}

/**
 * Hoàn thành bài theo Bài luyện (docs/tieu-chi/hoan-thanh-bai-theo-bai-luyen.md): với các khối luyện đưa vào, đếm tổng số câu và số câu học viên
 * ĐÃ KIỂM TRA (`ExamPracticeAnswer.checkedAt` khác rỗng, buổi nào cũng được — làm lại, bỏ buổi hay kết thúc buổi không làm mất trạng thái).
 * Khối chưa có câu nào không tính. Chỉ đọc dữ liệu của chính học viên.
 */
export async function getPracticeCheckProgress(userId: string, contentItemIds: string[], db: DbClient = prisma): Promise<PracticeCheckProgress> {
  if (contentItemIds.length === 0) return { total: 0, checked: 0 };
  const exams = await db.exam.findMany({
    where: { ownerContentItemId: { in: contentItemIds } },
    select: { id: true, questions: { select: { id: true } } },
  });
  const withQuestions = exams.filter((e) => e.questions.length > 0);
  if (withQuestions.length === 0) return { total: 0, checked: 0 };
  const rows = await db.examPracticeAnswer.findMany({
    where: { checkedAt: { not: null }, session: { userId, examId: { in: withQuestions.map((e) => e.id) } } },
    select: { questionId: true },
  });
  const checkedIds = new Set(rows.map((r) => r.questionId));
  let total = 0;
  let checked = 0;
  for (const e of withQuestions) {
    total += e.questions.length;
    checked += e.questions.filter((q) => checkedIds.has(q.id)).length;
  }
  return { total, checked };
}

/** Tóm tắt một khối cho giảng viên sửa được khoá (hàng khối trong bài). Khối không phải Bài luyện → `not_found`. */
export async function getPracticeBlockSummaryForEditor(actorUserId: string, contentItemId: string, db: DbClient = prisma): Promise<PracticeBlockSummary> {
  const item = await db.contentItem.findUnique({
    where: { id: contentItemId },
    select: { type: true, lesson: { select: { module: { select: { courseId: true } } } } },
  });
  if (!item || item.type !== "exam_practice") throw new CourseAuthzError("not_found");
  await assertCanEditCourse(actorUserId, item.lesson.module.courseId, db);
  return (await getPracticeBlockSummaries([contentItemId], db))[contentItemId]!;
}

export interface PracticeEditorData {
  contentItemId: string;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  blockTitle: string;
  examId: string;
  sectionId: string;
  passages: Array<{
    id: string;
    title: string;
    contentJson: unknown;
    audioPolicy: "free_replay" | "limited_replay" | "once_only";
    maxAudioPlays: number | null;
    revealMode: "all_at_once" | "sequential";
    orderIndex: number;
  }>;
  questions: Array<{
    id: string;
    type: string;
    prompt: string;
    points: number;
    passageId: string | null;
    config: Record<string, unknown>;
    orderInExam: number;
    orderInPassage: number | null;
  }>;
}

/**
 * Dữ liệu cho editor Bài luyện. Quyền: ai sửa được khoá chứa bài (cùng `assertCanEditCourse` của soạn bài học).
 * Khối không phải Bài luyện hoặc không tồn tại → `not_found` (không lộ khối của khoá khác).
 */
export async function getPracticeEditorData(actorUserId: string, contentItemId: string, db: DbClient = prisma): Promise<PracticeEditorData> {
  const item = await db.contentItem.findUnique({
    where: { id: contentItemId },
    select: {
      id: true,
      type: true,
      payload: true,
      lesson: { select: { id: true, title: true, module: { select: { courseId: true, course: { select: { title: true } } } } } },
    },
  });
  if (!item || item.type !== "exam_practice") throw new CourseAuthzError("not_found");
  const courseId = item.lesson.module.courseId;
  await assertCanEditCourse(actorUserId, courseId, db);

  const exam = await db.exam.findUnique({
    where: { ownerContentItemId: contentItemId },
    select: {
      id: true,
      sections: { orderBy: { orderIndex: "asc" }, take: 1, select: { id: true } },
      passages: { orderBy: { orderIndex: "asc" } },
      questions: { orderBy: { orderInExam: "asc" } },
    },
  });
  if (!exam || !exam.sections[0]) throw new CourseAuthzError("not_found");
  const title = (item.payload as { title?: string } | null)?.title?.trim() ?? "";
  return {
    contentItemId,
    courseId,
    courseTitle: item.lesson.module.course.title,
    lessonId: item.lesson.id,
    lessonTitle: item.lesson.title,
    blockTitle: title,
    examId: exam.id,
    sectionId: exam.sections[0].id,
    passages: exam.passages.map((p) => ({
      id: p.id,
      title: p.title,
      contentJson: p.contentJson,
      audioPolicy: p.audioPolicy,
      maxAudioPlays: p.maxAudioPlays,
      revealMode: p.revealMode,
      orderIndex: p.orderIndex,
    })),
    questions: exam.questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      passageId: q.passageId,
      config: q.config as Record<string, unknown>,
      orderInExam: q.orderInExam,
      orderInPassage: q.orderInPassage,
    })),
  };
}

/**
 * Học viên làm bài theo thứ tự `ExamSectionItem.orderInSection` (đề thi thử), còn editor sắp theo đoạn rồi câu. Hàm này đưa thứ
 * tự của phần về đúng thứ tự editor: các đoạn theo `orderIndex`, trong đoạn theo `orderInPassage`, rồi tới câu không thuộc
 * đoạn nào (theo `orderInExam`). Idempotent.
 */
export async function resyncOwnedPracticeOrder(examId: string, db: DbClient = prisma): Promise<void> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      ownerContentItemId: true,
      passages: { select: { id: true, orderIndex: true } },
      questions: { select: { id: true, passageId: true, orderInPassage: true, orderInExam: true, sectionItem: { select: { sectionId: true } } } },
    },
  });
  if (!exam?.ownerContentItemId) return;
  const passageOrder = new Map(exam.passages.map((p) => [p.id, p.orderIndex]));
  const sorted = [...exam.questions]
    .filter((q) => q.sectionItem)
    .sort((a, b) => {
      const pa = a.passageId ? (passageOrder.get(a.passageId) ?? Number.MAX_SAFE_INTEGER - 1) : Number.MAX_SAFE_INTEGER;
      const pb = b.passageId ? (passageOrder.get(b.passageId) ?? Number.MAX_SAFE_INTEGER - 1) : Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      const oa = a.passageId ? (a.orderInPassage ?? 0) : a.orderInExam;
      const ob = b.passageId ? (b.orderInPassage ?? 0) : b.orderInExam;
      return oa - ob;
    });
  for (let i = 0; i < sorted.length; i++) {
    await db.examSectionItem.update({ where: { examQuestionId: sorted[i]!.id }, data: { orderInSection: i } });
  }
}

/**
 * Hook SAU mỗi thao tác sửa đoạn/câu của một đề: đề có chủ thì (1) đồng bộ thứ tự làm bài của học viên với editor và
 * (2) báo "nội dung Bài luyện vừa đổi" (AC7, payload chỉ id và số liệu — KHÔNG mang chữ của câu hỏi hay đáp án). Đề không có
 * chủ thì không làm gì.
 */
export async function afterOwnedPracticeChanged(actorUserId: string, examId: string, db: DbClient = prisma): Promise<void> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      courseId: true,
      ownerContentItemId: true,
      ownerContentItem: { select: { lessonId: true } },
    },
  });
  if (!exam?.ownerContentItemId || !exam.ownerContentItem) return;
  await resyncOwnedPracticeOrder(examId, db);
  const counts = await db.exam.findUnique({ where: { id: examId }, select: { _count: { select: { passages: true, questions: true } } } });
  await emitEvent(
    actorUserId,
    LearningEventType.LessonPracticeUpdated,
    {
      lessonId: exam.ownerContentItem.lessonId,
      contentItemId: exam.ownerContentItemId,
      passages: counts?._count.passages ?? 0,
      questions: counts?._count.questions ?? 0,
    },
    { courseId: exam.courseId ?? undefined },
    db,
  );
}
