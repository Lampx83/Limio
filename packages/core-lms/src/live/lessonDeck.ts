import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { canEditCourse } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { deckAccessWhere, hasDeckAccess } from "./deckAccess";

/**
 * Bài giảng slide của bài học (docs/tieu-chi/nghe-giang-slide.md, AC1). Một bài học một bài giảng và ngược lại. Chủ khoá và đồng
 * giảng viên đều gắn, gỡ, tạo được (quyết định 25/10/2026); bài giảng thuộc người TẠO ra nó, và mỗi người chỉ gắn được bài giảng mình
 * có quyền soạn (của chính mình hoặc mình là đồng giảng viên: dong-giang-vien-bai-giang.md), vì các trang Limio-Live chỉ mở cho họ.
 */

export type LessonDeckErrorCode = "not_found" | "forbidden" | "deck_not_yours" | "deck_in_use" | "lesson_has_deck";

export class LessonDeckError extends Error {
  constructor(
    public readonly code: LessonDeckErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export interface LessonDeckSummary {
  id: string;
  title: string;
  slideCount: number;
  updatedAt: Date;
  /** Người hỏi mở được trình soạn và trình chiếu (là chủ hoặc đồng giảng viên của bài giảng). */
  canOpen: boolean;
  ownerName: string | null;
}

export interface LessonDeckForEditor {
  attached: LessonDeckSummary | null;
  /** Bài giảng người hỏi có quyền soạn (của mình hoặc mình là đồng giảng viên) còn chọn được (chưa gắn với bài học nào), mới sửa nhất trước. */
  candidates: LessonDeckSummary[];
}

/**
 * Nhóm bài giảng của khoá trong Limio-Live (kind "course"): dùng nhóm chủ khoá đã liên kết với khoá nếu có, không thì tạo
 * nhóm mới mang tên khoá. Bài giảng gắn vào bài học vì thế nằm cùng nhóm với khoá, không rơi vào "Chưa phân nhóm".
 */
export async function ensureCourseDeckGroup(ownerId: string, courseId: string, db: PrismaClient = prisma): Promise<string> {
  const existing = await db.liveDeckGroup.findFirst({ where: { userId: ownerId, courseId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (existing) return existing.id;
  const course = await db.course.findUnique({ where: { id: courseId }, select: { title: true } });
  const group = await db.liveDeckGroup.create({
    data: { userId: ownerId, courseId, kind: "course", name: (course?.title ?? "Khoá học").trim().slice(0, 100) || "Khoá học" },
    select: { id: true },
  });
  return group.id;
}

async function loadLesson(lessonId: string, db: PrismaClient) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, liveDeckId: true, module: { select: { courseId: true } } },
  });
  if (!lesson) throw new LessonDeckError("not_found");
  return { id: lesson.id, liveDeckId: lesson.liveDeckId, courseId: lesson.module.courseId };
}

/** Người sửa được khoá (chủ khoá, đồng giảng viên, admin) mới dùng phần bài giảng slide của bài học. */
async function requireEditor(actorId: string, courseId: string, db: PrismaClient) {
  if (!(await canEditCourse(actorId, courseId, db))) throw new LessonDeckError("forbidden");
}

const summarySelect = {
  id: true,
  title: true,
  updatedAt: true,
  userId: true,
  user: { select: { displayName: true } },
  collaborators: { select: { userId: true } },
  _count: { select: { slides: true } },
} as const;
const toSummary = (
  d: {
    id: string;
    title: string;
    updatedAt: Date;
    userId: string;
    user: { displayName: string };
    collaborators: { userId: string }[];
    _count: { slides: number };
  },
  actorId: string,
): LessonDeckSummary => ({
  id: d.id,
  title: d.title,
  slideCount: d._count.slides,
  updatedAt: d.updatedAt,
  canOpen: d.userId === actorId || d.collaborators.some((c) => c.userId === actorId),
  ownerName: d.user.displayName,
});

export async function getLessonDeckForEditor(actorId: string, lessonId: string, db: PrismaClient = prisma): Promise<LessonDeckForEditor> {
  const lesson = await loadLesson(lessonId, db);
  await requireEditor(actorId, lesson.courseId, db);
  const [attached, candidates] = await Promise.all([
    lesson.liveDeckId ? db.liveDeck.findUnique({ where: { id: lesson.liveDeckId }, select: summarySelect }) : null,
    db.liveDeck.findMany({ where: { AND: [deckAccessWhere(actorId), { lesson: { is: null } }] }, orderBy: { updatedAt: "desc" }, take: 200, select: summarySelect }),
  ]);
  return { attached: attached ? toSummary(attached, actorId) : null, candidates: candidates.map((d) => toSummary(d, actorId)) };
}

/**
 * Gắn bài giảng vào bài học. Bài học đã có bài giảng khác thì phải truyền `replace: true` (giao diện hỏi lại trước);
 * bài giảng đang gắn với bài học khác thì từ chối — gỡ ở bài kia trước.
 */
export async function attachLessonDeck(
  actorId: string,
  lessonId: string,
  deckId: string,
  opts: { replace?: boolean } = {},
  db: PrismaClient = prisma,
): Promise<{ replacedDeckId: string | null }> {
  const lesson = await loadLesson(lessonId, db);
  await requireEditor(actorId, lesson.courseId, db);
  const deck = await db.liveDeck.findUnique({ where: { id: deckId }, select: { id: true, userId: true, groupId: true, lesson: { select: { id: true } } } });
  if (!deck) throw new LessonDeckError("not_found");
  if (!(await hasDeckAccess(deck, actorId, db))) throw new LessonDeckError("deck_not_yours");
  if (lesson.liveDeckId === deck.id) return { replacedDeckId: null }; // gắn lại đúng bài giảng đang gắn: không làm gì
  if (deck.lesson && deck.lesson.id !== lesson.id) throw new LessonDeckError("deck_in_use");
  if (lesson.liveDeckId && !opts.replace) throw new LessonDeckError("lesson_has_deck");

  const replacedDeckId = lesson.liveDeckId;
  // Bài giảng chưa thuộc nhóm nào thì đưa vào nhóm của khoá; bài giảng giảng viên đã tự xếp nhóm thì giữ nguyên.
  const groupId = deck.groupId ?? (await ensureCourseDeckGroup(deck.userId, lesson.courseId, db));
  await db.$transaction(async (tx) => {
    await tx.lesson.update({ where: { id: lesson.id }, data: { liveDeckId: deck.id } });
    if (!deck.groupId) await tx.liveDeck.update({ where: { id: deck.id }, data: { groupId } });
    await emitEvent(actorId, LearningEventType.LessonDeckAttached, { lessonId: lesson.id, deckId: deck.id, replacedDeckId }, { courseId: lesson.courseId }, tx);
  });
  return { replacedDeckId };
}

export async function detachLessonDeck(actorId: string, lessonId: string, db: PrismaClient = prisma): Promise<void> {
  const lesson = await loadLesson(lessonId, db);
  await requireEditor(actorId, lesson.courseId, db);
  const deckId = lesson.liveDeckId;
  if (!deckId) return;
  await db.$transaction(async (tx) => {
    await tx.lesson.update({ where: { id: lesson.id }, data: { liveDeckId: null } });
    await emitEvent(actorId, LearningEventType.LessonDeckDetached, { lessonId: lesson.id, deckId }, { courseId: lesson.courseId }, tx);
  });
}

/** Bài học có bài giảng slide không (dùng ở trang học: chỉ hỏi một cột, không kéo slide). */
export async function lessonHasDeck(lessonId: string, db: PrismaClient = prisma): Promise<boolean> {
  const l = await db.lesson.findUnique({ where: { id: lessonId }, select: { liveDeckId: true } });
  return !!l?.liveDeckId;
}
