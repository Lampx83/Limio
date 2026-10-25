import type { PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { isFeatureEnabled } from "../auth/permissions";
import { emitEvent } from "../learning/events";

/** Thêm / gỡ / liệt kê đồng giảng viên của bài giảng (docs/tieu-chi/dong-giang-vien-bai-giang.md, AC1–AC3). */

export type DeckCollaboratorErrorCode =
  | "not_found"
  | "forbidden"
  | "invalid_email"
  | "user_not_found"
  | "no_limio_live_access"
  | "already_owner";

export class DeckCollaboratorError extends Error {
  constructor(public readonly code: DeckCollaboratorErrorCode) {
    super(code);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DeckPerson {
  userId: string;
  displayName: string;
  email: string | null;
}

export interface DeckPeople {
  owner: DeckPerson;
  collaborators: Array<DeckPerson & { addedAt: Date }>;
  /** Vai của người hỏi trong bài giảng này, và id của chính họ (để giao diện biết dòng nào là mình). */
  role: "owner" | "collaborator";
  selfId: string;
}

async function loadDeck(deckId: string, db: PrismaClient) {
  const deck = await db.liveDeck.findUnique({
    where: { id: deckId },
    select: { id: true, userId: true, user: { select: { id: true, displayName: true, email: true } } },
  });
  if (!deck) throw new DeckCollaboratorError("not_found");
  return deck;
}

/** Chủ và đồng giảng viên của bài giảng; chỉ chủ và đồng giảng viên xem được. */
export async function listDeckPeople(deckId: string, actorId: string, db: PrismaClient): Promise<DeckPeople> {
  const deck = await loadDeck(deckId, db);
  const rows = await db.liveDeckCollaborator.findMany({
    where: { deckId },
    orderBy: { createdAt: "asc" },
    select: { userId: true, createdAt: true, user: { select: { displayName: true, email: true } } },
  });
  const isOwner = deck.userId === actorId;
  if (!isOwner && !rows.some((r) => r.userId === actorId)) throw new DeckCollaboratorError("forbidden");
  return {
    owner: { userId: deck.user.id, displayName: deck.user.displayName, email: deck.user.email ?? null },
    collaborators: rows.map((r) => ({ userId: r.userId, displayName: r.user.displayName, email: r.user.email ?? null, addedAt: r.createdAt })),
    role: isOwner ? "owner" : "collaborator",
    selfId: actorId,
  };
}

/**
 * Chủ bài thêm đồng giảng viên bằng email. Chỉ nhận tài khoản ĐÃ CÓ và có quyền dùng Limio-Live; không gửi thư mời. Thêm lại người đã
 * có thì không đổi gì (`added: false`).
 */
export async function addDeckCollaborator(
  actorId: string,
  deckId: string,
  rawEmail: string,
  db: PrismaClient,
): Promise<{ added: boolean; person: DeckPerson }> {
  const deck = await loadDeck(deckId, db);
  if (deck.userId !== actorId) throw new DeckCollaboratorError("forbidden");
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new DeckCollaboratorError("invalid_email");
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, displayName: true, email: true } });
  if (!user) throw new DeckCollaboratorError("user_not_found");
  if (user.id === deck.userId) throw new DeckCollaboratorError("already_owner");
  if (!(await isFeatureEnabled(user.id, "limio_live.access", db))) throw new DeckCollaboratorError("no_limio_live_access");

  const person: DeckPerson = { userId: user.id, displayName: user.displayName, email: user.email ?? null };
  const existing = await db.liveDeckCollaborator.findUnique({ where: { deckId_userId: { deckId, userId: user.id } }, select: { userId: true } });
  if (existing) return { added: false, person };
  await db.$transaction(async (tx) => {
    await tx.liveDeckCollaborator.create({ data: { deckId, userId: user.id, addedById: actorId } });
    await emitEvent(actorId, LearningEventType.LiveDeckCollaboratorAdded, { deckId, collaboratorId: user.id }, {}, tx);
  });
  return { added: true, person };
}

/** Chủ bài gỡ bất kỳ ai; đồng giảng viên chỉ tự rời (userId = chính mình). Gỡ người không có trong danh sách thì không làm gì. */
export async function removeDeckCollaborator(actorId: string, deckId: string, userId: string, db: PrismaClient): Promise<void> {
  const deck = await loadDeck(deckId, db);
  const left = actorId === userId;
  if (deck.userId !== actorId && !left) throw new DeckCollaboratorError("forbidden");
  const row = await db.liveDeckCollaborator.findUnique({ where: { deckId_userId: { deckId, userId } }, select: { userId: true } });
  if (!row) return;
  await db.$transaction(async (tx) => {
    await tx.liveDeckCollaborator.delete({ where: { deckId_userId: { deckId, userId } } });
    await emitEvent(actorId, LearningEventType.LiveDeckCollaboratorRemoved, { deckId, collaboratorId: userId, left }, {}, tx);
  });
}

export interface SharedDeckRow {
  id: string;
  title: string;
  slideCount: number;
  updatedAt: Date;
  ownerName: string;
}

/** Bài giảng người khác thêm mình vào làm đồng giảng viên ("Được chia sẻ với tôi"), mới sửa nhất trước. */
export async function listDecksSharedWithMe(userId: string, db: PrismaClient): Promise<SharedDeckRow[]> {
  const decks = await db.liveDeck.findMany({
    where: { collaborators: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, user: { select: { displayName: true } }, _count: { select: { slides: true } } },
  });
  return decks.map((d) => ({ id: d.id, title: d.title, slideCount: d._count.slides, updatedAt: d.updatedAt, ownerName: d.user.displayName }));
}
