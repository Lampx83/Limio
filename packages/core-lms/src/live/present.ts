import { PrismaClient, LiveSession, LiveIdentityMode, Prisma } from "@feedbackme/db";
import { hasDeckAccess } from "./deckAccess";

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
  if (!deck || !(await hasDeckAccess(deck, userId, db))) {
    throw new Error("Not authorized to present this deck");
  }

  const active = await db.liveSession.findFirst({
    where: { deckId, userId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (active) {
    // Mở lại màn chiếu: phiên đang tạm dừng chạy tiếp, giữ nguyên kết quả và mã.
    const resumed = active.pausedAt ? await db.liveSession.update({ where: { id: active.id }, data: { pausedAt: null } }) : active;
    return ensureJoinCode(resumed, db);
  }

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

/** Loại slide có tương tác với học viên, và vì thế có mã/QR riêng. Slide nội dung thì không. */
export const INTERACTIVE_SLIDE_TYPES = ["quiz", "poll", "word_cloud", "collaborate_board", "whiteboard"] as const;

/**
 * Mã tham gia theo từng slide tương tác của phiên (slideId -> mã). Tạo thêm mã còn thiếu, mã đã có giữ nguyên
 * nên gọi lại bao nhiêu lần cũng được; slide nội dung không có mã. Mã cố định suốt phiên tương tác.
 */
export async function ensureSlideJoinCodes(
  sessionId: string,
  userId: string,
  db: PrismaClient
): Promise<Record<string, string>> {
  const session = await getOwnedSession(sessionId, userId, db);
  const slides = await db.liveSlide.findMany({
    where: { deckId: session.deckId, type: { in: [...INTERACTIVE_SLIDE_TYPES] } },
    select: { id: true },
  });
  const existing = await db.liveSlideCode.findMany({ where: { sessionId }, select: { slideId: true } });
  const have = new Set(existing.map((c) => c.slideId));

  for (const slide of slides) {
    if (have.has(slide.id)) continue;
    // Va chạm mã (31^6) hoặc hai cửa sổ chiếu cùng tạo một lúc: thử lại, rồi đọc lại bản ghi thắng cuộc.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateJoinCode();
      if (await db.liveSession.findUnique({ where: { joinCode: code }, select: { id: true } })) continue;
      try {
        await db.liveSlideCode.create({ data: { code, sessionId, slideId: slide.id } });
        break;
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
        if (await db.liveSlideCode.findFirst({ where: { sessionId, slideId: slide.id }, select: { code: true } })) break;
      }
    }
  }

  const rows = await db.liveSlideCode.findMany({
    where: { sessionId, slideId: { in: slides.map((s) => s.id) } },
    select: { slideId: true, code: true },
  });
  return Object.fromEntries(rows.map((r) => [r.slideId, r.code]));
}

/** Giảng viên thoát màn chiếu: phiên tương tác (kết quả + mã) được giữ, học viên tạm không trả lời được. */
export async function pauseLiveSession(sessionId: string, userId: string, db: PrismaClient): Promise<void> {
  const session = await getOwnedSession(sessionId, userId, db);
  if (session.endedAt) return;
  await db.liveSession.update({ where: { id: sessionId }, data: { pausedAt: new Date() } });
}

/**
 * Kết thúc phiên tương tác hiện tại và mở phiên mới (kết quả trống, mã mới cho mọi slide tương tác).
 * - "save": phiên cũ được lưu vào lịch sử cùng kết quả.
 * - "discard": xoá hẳn kết quả và phiên cũ (không khôi phục được).
 */
export async function resetLiveSession(
  sessionId: string,
  userId: string,
  mode: "save" | "discard",
  db: PrismaClient
): Promise<LiveSession> {
  const session = await getOwnedSession(sessionId, userId, db);

  if (mode === "save") {
    const now = new Date();
    if (!session.endedAt) await db.liveSession.update({ where: { id: sessionId }, data: { endedAt: now } });
    if (session.classroomSessionId) {
      await db.classroomSession.update({ where: { id: session.classroomSessionId }, data: { endedAt: now } });
    }
  } else {
    const refIds = Object.values((session.slideRuntimeRefs ?? {}) as Record<string, string>);
    await db.$transaction([
      db.classroomPoll.deleteMany({ where: { id: { in: refIds } } }),
      db.wordCloud.deleteMany({ where: { id: { in: refIds } } }),
      db.interactiveBoard.deleteMany({ where: { id: { in: refIds } } }),
      db.whiteboard.deleteMany({ where: { id: { in: refIds } } }),
      db.liveSession.delete({ where: { id: sessionId } }),
      ...(session.classroomSessionId
        ? [db.classroomSession.deleteMany({ where: { id: session.classroomSessionId } })]
        : []),
    ]);
  }

  const firstSlide = await db.liveSlide.findFirst({ where: { deckId: session.deckId }, orderBy: { orderIndex: "asc" } });
  const created = await db.liveSession.create({
    data: { deckId: session.deckId, userId, currentSlideId: firstSlide?.id ?? null, identityMode: session.identityMode },
  });
  return ensureJoinCode(created, db);
}

export type SlideJoinTarget =
  | { status: "not_found" }
  | { status: "closed"; title: string; identityMode: LiveIdentityMode; reason: "ended" | "paused" | "moved" }
  | { status: "waiting"; title: string; identityMode: LiveIdentityMode }
  | { status: "open"; title: string; identityMode: LiveIdentityMode; slide: { id: string; type: string }; refId: string };

/**
 * Học viên quét mã của MỘT slide: chỉ vào được khi phiên đang chạy, không tạm dừng và giảng viên đang chiếu đúng
 * slide đó. Giảng viên chuyển đi thì "đã đóng" — không tự theo sang slide khác (muốn trả lời slide kia phải quét mã của nó).
 */
export async function resolveSlideJoinCode(code: string, db: PrismaClient): Promise<SlideJoinTarget> {
  const row = await db.liveSlideCode.findUnique({
    where: { code },
    select: {
      slide: { select: { id: true, type: true } },
      session: {
        select: {
          endedAt: true,
          pausedAt: true,
          identityMode: true,
          currentSlideId: true,
          slideRuntimeRefs: true,
          deck: { select: { title: true } },
        },
      },
    },
  });
  if (!row) return { status: "not_found" };
  const { slide, session } = row;
  const title = session.deck.title;
  if (session.endedAt) return { status: "closed", title, identityMode: session.identityMode, reason: "ended" };
  if (session.pausedAt) return { status: "closed", title, identityMode: session.identityMode, reason: "paused" };
  if (session.currentSlideId !== slide.id || !(INTERACTIVE_SLIDE_TYPES as readonly string[]).includes(slide.type)) {
    return { status: "closed", title, identityMode: session.identityMode, reason: "moved" };
  }
  const refId = (session.slideRuntimeRefs as Record<string, string>)[slide.id];
  if (!refId) return { status: "waiting", title, identityMode: session.identityMode };
  return { status: "open", title, identityMode: session.identityMode, slide, refId };
}
