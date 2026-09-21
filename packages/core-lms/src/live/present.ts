import { PrismaClient, LiveSession, LiveIdentityMode, Prisma } from "@feedbackme/db";

// Bỏ ký tự dễ nhầm (0/O, 1/I/L) vì học viên gõ tay mã trên màn chiếu.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

/** Chuẩn hoá mã học viên gõ/dán (hoa, bỏ khoảng trắng); null nếu không đúng định dạng. */
export function normalizeJoinCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return code.length === JOIN_CODE_LENGTH && [...code].every((c) => JOIN_CODE_ALPHABET.includes(c)) ? code : null;
}

async function ensureJoinCode(session: LiveSession, db: PrismaClient): Promise<LiveSession> {
  if (session.joinCode) return session;
  // Va chạm mã cực hiếm (31^6) nhưng vẫn thử lại thay vì để phiên không có mã.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.liveSession.update({ where: { id: session.id }, data: { joinCode: generateJoinCode() } });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  throw new Error("Không tạo được mã tham gia — thử lại");
}

/**
 * Get the caller's active (endedAt=null) present run for a deck, or start a
 * new one seeded at the deck's first slide. Resuming (instead of always
 * creating fresh) means an accidental page refresh mid-class doesn't lose
 * the poll/word-cloud results already collected.
 */
export async function startOrResumeLiveSession(
  deckId: string,
  userId: string,
  db: PrismaClient
): Promise<LiveSession> {
  const deck = await db.liveDeck.findUnique({ where: { id: deckId } });
  if (!deck || deck.userId !== userId) {
    throw new Error("Not authorized to present this deck");
  }

  const active = await db.liveSession.findFirst({
    where: { deckId, userId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (active) return ensureJoinCode(active, db);

  const firstSlide = await db.liveSlide.findFirst({
    where: { deckId },
    orderBy: { orderIndex: "asc" },
  });

  const created = await db.liveSession.create({
    data: { deckId, userId, currentSlideId: firstSlide?.id ?? null },
  });
  return ensureJoinCode(created, db);
}

/** Giảng viên chọn học viên vào phiên ẩn danh hay bắt buộc đăng nhập. */
export async function setLiveIdentityMode(
  sessionId: string,
  userId: string,
  identityMode: LiveIdentityMode,
  db: PrismaClient
): Promise<LiveSession> {
  await getOwnedSession(sessionId, userId, db);
  return db.liveSession.update({ where: { id: sessionId }, data: { identityMode } });
}

export async function getOwnedSession(
  sessionId: string,
  userId: string,
  db: PrismaClient
): Promise<LiveSession> {
  const session = await db.liveSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new Error("Not authorized for this present session");
  }
  return session;
}

export async function goToSlide(
  sessionId: string,
  userId: string,
  slideId: string,
  db: PrismaClient
): Promise<LiveSession> {
  const session = await getOwnedSession(sessionId, userId, db);
  const slide = await db.liveSlide.findUnique({ where: { id: slideId } });
  if (!slide || slide.deckId !== session.deckId) {
    throw new Error("Slide does not belong to this deck");
  }
  return db.liveSession.update({
    where: { id: sessionId },
    data: { currentSlideId: slideId },
  });
}

/**
 * Get-or-create the ClassroomSession backing this run's poll/quiz/word_cloud
 * slides. Lazy — a deck made entirely of content/collaborate_board slides
 * never needs one.
 */
export async function ensureClassroomSession(
  sessionId: string,
  userId: string,
  db: PrismaClient
): Promise<string> {
  const session = await getOwnedSession(sessionId, userId, db);
  if (session.classroomSessionId) return session.classroomSessionId;

  const classroomSession = await db.classroomSession.create({ data: {} });
  await db.liveSession.update({
    where: { id: sessionId },
    data: { classroomSessionId: classroomSession.id },
  });
  return classroomSession.id;
}

export async function recordSlideRuntimeRef(
  sessionId: string,
  userId: string,
  slideId: string,
  refId: string,
  db: PrismaClient
): Promise<LiveSession> {
  const session = await getOwnedSession(sessionId, userId, db);
  const refs = { ...(session.slideRuntimeRefs as Record<string, string>), [slideId]: refId };
  return db.liveSession.update({
    where: { id: sessionId },
    data: { slideRuntimeRefs: refs as Prisma.InputJsonValue },
  });
}

/**
 * Merge a partial patch into the session's uiState JSON (timer start times,
 * quiz reveal flags — see schema.prisma comment on LiveSession.uiState).
 * Shallow-merged at the top level only, same as recordSlideRuntimeRef, since
 * callers always pass a full replacement for the key they're touching (e.g.
 * `{ timerStartedAt: { ...prev, [slideId]: Date.now() } }` computed by the
 * caller from the current session it already has).
 */
export async function patchSessionUiState(
  sessionId: string,
  userId: string,
  patch: Record<string, unknown>,
  db: PrismaClient
): Promise<LiveSession> {
  const session = await getOwnedSession(sessionId, userId, db);
  const uiState = { ...(session.uiState as Record<string, unknown>), ...patch };
  return db.liveSession.update({
    where: { id: sessionId },
    data: { uiState: uiState as Prisma.InputJsonValue },
  });
}

export async function endLiveSession(
  sessionId: string,
  userId: string,
  db: PrismaClient
): Promise<void> {
  const session = await getOwnedSession(sessionId, userId, db);
  await db.liveSession.update({
    where: { id: sessionId },
    data: { endedAt: new Date() },
  });
  if (session.classroomSessionId) {
    await db.classroomSession.update({
      where: { id: session.classroomSessionId },
      data: { endedAt: new Date() },
    });
  }
}
