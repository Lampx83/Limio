import { PrismaClient, LiveDeckGroup, LiveDeckGroupKind } from "@feedbackme/db";

export interface LiveDeckGroupInput {
  name: string;
  kind: LiveDeckGroupKind;
  /** Khoá LMS liên kết (tuỳ chọn). Có courseId thì kind luôn là "course". */
  courseId?: string | null;
}

export type LiveDeckGroupWithMeta = LiveDeckGroup & {
  _count: { decks: number };
  course: { id: string; title: string } | null;
};

function normalize(input: LiveDeckGroupInput): { name: string; kind: LiveDeckGroupKind; courseId: string | null } {
  const name = input.name.trim();
  if (!name) throw new Error("Group name is required");
  if (name.length > 100) throw new Error("Group name is too long");
  const courseId = input.courseId || null;
  return { name, kind: courseId ? "course" : input.kind, courseId };
}

/** Chỉ được liên kết khoá mà chính mình là giảng viên. */
async function assertCanLinkCourse(userId: string, courseId: string | null, db: PrismaClient): Promise<void> {
  if (!courseId) return;
  const row = await db.courseInstructor.findFirst({ where: { userId, courseId }, select: { userId: true } });
  if (!row) throw new Error("Not authorized to link this course");
}

/** Các khoá LMS mà giảng viên có thể liên kết với một nhóm. */
export async function listLinkableCourses(
  userId: string,
  db: PrismaClient
): Promise<Array<{ id: string; title: string }>> {
  return db.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}

export async function listLiveDeckGroups(
  userId: string,
  db: PrismaClient
): Promise<LiveDeckGroupWithMeta[]> {
  return db.liveDeckGroup.findMany({
    where: { userId },
    include: {
      _count: { select: { decks: true } },
      course: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createLiveDeckGroup(
  userId: string,
  input: LiveDeckGroupInput,
  db: PrismaClient
): Promise<LiveDeckGroup> {
  const data = normalize(input);
  await assertCanLinkCourse(userId, data.courseId, db);
  return db.liveDeckGroup.create({ data: { userId, ...data } });
}

export async function updateLiveDeckGroup(
  groupId: string,
  userId: string,
  input: LiveDeckGroupInput,
  db: PrismaClient
): Promise<LiveDeckGroup> {
  const existing = await db.liveDeckGroup.findUnique({ where: { id: groupId } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Not authorized to update this group");
  }
  const data = normalize(input);
  await assertCanLinkCourse(userId, data.courseId, db);
  return db.liveDeckGroup.update({ where: { id: groupId }, data });
}

/** Xoá nhóm: các bài giảng trong nhóm chỉ mất nhóm (FK SetNull), không bị xoá. */
export async function deleteLiveDeckGroup(
  groupId: string,
  userId: string,
  db: PrismaClient
): Promise<void> {
  const existing = await db.liveDeckGroup.findUnique({ where: { id: groupId } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Not authorized to delete this group");
  }
  await db.liveDeckGroup.delete({ where: { id: groupId } });
}

/** Chuyển bài giảng vào nhóm (groupId=null: bỏ khỏi nhóm). */
export async function setLiveDeckGroup(
  deckId: string,
  userId: string,
  groupId: string | null,
  db: PrismaClient
) {
  const deck = await db.liveDeck.findUnique({ where: { id: deckId } });
  if (!deck || deck.userId !== userId) {
    throw new Error("Not authorized to edit this deck");
  }
  if (groupId) {
    const group = await db.liveDeckGroup.findUnique({ where: { id: groupId } });
    if (!group || group.userId !== userId) {
      throw new Error("Not authorized to use this group");
    }
  }
  return db.liveDeck.update({ where: { id: deckId }, data: { groupId } });
}
