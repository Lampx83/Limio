import { PrismaClient, LiveDeck, LiveSlide, LiveSlideType } from "@feedbackme/db";

export interface CreateDeckInput {
  userId: string;
  title: string;
}

export interface CreateSlideInput {
  type: LiveSlideType;
  config: unknown;
  timerSeconds?: number | null;
}

export interface UpdateSlideInput {
  config?: unknown;
  timerSeconds?: number | null;
}

export type DeckWithSlides = LiveDeck & { slides: LiveSlide[] };

/**
 * Create a new (empty) live deck for an instructor
 */
export async function createLiveDeck(
  input: CreateDeckInput,
  db: PrismaClient
): Promise<LiveDeck> {
  if (!input.title.trim()) {
    throw new Error("Title is required");
  }

  return db.liveDeck.create({
    data: { userId: input.userId, title: input.title.trim() },
  });
}

/**
 * List all decks owned by a user
 */
export async function getUserLiveDecks(
  userId: string,
  db: PrismaClient
): Promise<Array<LiveDeck & { _count: { slides: number } }>> {
  return db.liveDeck.findMany({
    where: { userId },
    include: { _count: { select: { slides: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Get a single deck with its ordered slides (ownership check required)
 */
export async function getLiveDeck(
  deckId: string,
  userId: string,
  db: PrismaClient
): Promise<DeckWithSlides | null> {
  const deck = await db.liveDeck.findUnique({
    where: { id: deckId },
    include: { slides: { orderBy: { orderIndex: "asc" } } },
  });

  if (deck && deck.userId !== userId) {
    return null;
  }

  return deck;
}

export async function updateLiveDeck(
  deckId: string,
  userId: string,
  updates: { title?: string; theme?: string },
  db: PrismaClient
): Promise<LiveDeck> {
  const existing = await db.liveDeck.findUnique({ where: { id: deckId } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Not authorized to update this deck");
  }
  if (updates.title !== undefined && !updates.title.trim()) {
    throw new Error("Title is required");
  }

  return db.liveDeck.update({
    where: { id: deckId },
    data: {
      ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
      ...(updates.theme !== undefined ? { theme: updates.theme } : {}),
    },
  });
}

/**
 * Sao chép một bài giảng của chính người dùng: tạo deck mới (cùng giao diện, cùng
 * nhóm) và chép toàn bộ slide theo đúng thứ tự trình chiếu. Không chép phiên trình chiếu
 * (LiveSession) — mỗi buổi dạy là dữ liệu riêng của bài gốc.
 */
export async function duplicateLiveDeck(
  deckId: string,
  userId: string,
  db: PrismaClient
): Promise<LiveDeck> {
  const source = await db.liveDeck.findUnique({
    where: { id: deckId },
    include: { slides: { orderBy: { orderIndex: "asc" } } },
  });
  if (!source || source.userId !== userId) {
    throw new Error("Not authorized to duplicate this deck");
  }

  const suffix = " (bản sao)";
  const title = `${source.title.slice(0, 100 - suffix.length)}${suffix}`;

  return db.$transaction(async (tx) => {
    const copy = await tx.liveDeck.create({
      data: { userId, title, theme: source.theme, groupId: source.groupId },
    });
    if (source.slides.length > 0) {
      await tx.liveSlide.createMany({
        data: source.slides.map((sl) => ({
          deckId: copy.id,
          type: sl.type,
          config: sl.config as object,
          timerSeconds: sl.timerSeconds,
          orderIndex: sl.orderIndex,
        })),
      });
    }
    return copy;
  });
}

export async function deleteLiveDeck(
  deckId: string,
  userId: string,
  db: PrismaClient
): Promise<void> {
  const existing = await db.liveDeck.findUnique({ where: { id: deckId } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Not authorized to delete this deck");
  }

  await db.liveDeck.delete({ where: { id: deckId } });
}

/**
 * Add a slide to a deck. orderIndex is appended at the end — this IS the
 * real presentation order (unlike TeachingActivityPlanItem, Limio-Live runs
 * sequentially, not "chạy tuỳ ý").
 */
export async function addLiveSlide(
  deckId: string,
  userId: string,
  input: CreateSlideInput,
  db: PrismaClient
): Promise<LiveSlide> {
  const deck = await db.liveDeck.findUnique({ where: { id: deckId } });
  if (!deck || deck.userId !== userId) {
    throw new Error("Not authorized to edit this deck");
  }

  const last = await db.liveSlide.findFirst({
    where: { deckId },
    orderBy: { orderIndex: "desc" },
  });

  return db.liveSlide.create({
    data: {
      deckId,
      type: input.type,
      config: input.config as any,
      timerSeconds: input.timerSeconds ?? null,
      orderIndex: (last?.orderIndex ?? -1) + 1,
    },
  });
}

/**
 * Append many slides at once (vd. import PDF — mỗi trang thành 1 slide
 * content) — 1 transaction thay vì N request riêng.
 */
export async function addLiveSlidesBulk(
  deckId: string,
  userId: string,
  inputs: CreateSlideInput[],
  db: PrismaClient
): Promise<LiveSlide[]> {
  const deck = await db.liveDeck.findUnique({ where: { id: deckId } });
  if (!deck || deck.userId !== userId) {
    throw new Error("Not authorized to edit this deck");
  }
  if (inputs.length === 0) return [];

  const last = await db.liveSlide.findFirst({
    where: { deckId },
    orderBy: { orderIndex: "desc" },
  });
  const startIndex = (last?.orderIndex ?? -1) + 1;

  return db.$transaction(
    inputs.map((input, i) =>
      db.liveSlide.create({
        data: {
          deckId,
          type: input.type,
          config: input.config as any,
          timerSeconds: input.timerSeconds ?? null,
          orderIndex: startIndex + i,
        },
      })
    )
  );
}

async function getSlideWithOwnerCheck(
  slideId: string,
  userId: string,
  db: PrismaClient
): Promise<LiveSlide> {
  const slide = await db.liveSlide.findUnique({
    where: { id: slideId },
    include: { deck: true },
  });
  if (!slide || slide.deck.userId !== userId) {
    throw new Error("Not authorized to edit this slide");
  }
  return slide;
}

export async function updateLiveSlide(
  slideId: string,
  userId: string,
  updates: UpdateSlideInput,
  db: PrismaClient
): Promise<LiveSlide> {
  await getSlideWithOwnerCheck(slideId, userId, db);

  return db.liveSlide.update({
    where: { id: slideId },
    data: {
      ...(updates.config !== undefined ? { config: updates.config as any } : {}),
      ...(updates.timerSeconds !== undefined ? { timerSeconds: updates.timerSeconds } : {}),
    },
  });
}

export async function deleteLiveSlide(
  slideId: string,
  userId: string,
  db: PrismaClient
): Promise<void> {
  await getSlideWithOwnerCheck(slideId, userId, db);
  await db.liveSlide.delete({ where: { id: slideId } });
}

/**
 * Reorder slides — this IS the presentation order (required full ordered id
 * set, matching reorderContentItems/reorderLessonActivities convention).
 */
export async function reorderLiveSlides(
  deckId: string,
  userId: string,
  orderedSlideIds: string[],
  db: PrismaClient
): Promise<void> {
  const deck = await db.liveDeck.findUnique({ where: { id: deckId } });
  if (!deck || deck.userId !== userId) {
    throw new Error("Not authorized to edit this deck");
  }

  const slides = await db.liveSlide.findMany({ where: { deckId } });
  const existingIds = new Set(slides.map((s) => s.id));
  if (
    orderedSlideIds.length !== existingIds.size ||
    !orderedSlideIds.every((id) => existingIds.has(id))
  ) {
    throw new Error("orderedSlideIds must match the deck's full slide set");
  }

  await db.$transaction(
    orderedSlideIds.map((id, index) =>
      db.liveSlide.update({
        where: { id },
        data: { orderIndex: index },
      })
    )
  );
}
