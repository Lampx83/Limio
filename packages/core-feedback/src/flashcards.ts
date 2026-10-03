/**
 * LANG G4 — bộ thẻ, phiên ôn, ghi nhận lượt ôn và thống kê của flashcard.
 *
 * Thẻ = một dòng của khối `vocab_list` (G2), định danh bằng `items[].id`. Trạng thái
 * (`FlashcardState`) chỉ có sau lần ôn đầu tiên. Lịch ôn là `flashcardSrs.ts`.
 *
 * Cố ý KHÔNG chạm `LearnerSkillState` và không cấp XP: flashcard là tự đánh giá việc
 * ghi nhận, không phải bằng chứng khách quan về kỹ năng — trộn vào BKT sẽ làm hồ sơ
 * 4 kỹ năng sai. Event `flashcard.reviewed` vẫn phát để gamification đăng ký sau
 * (kèm trần theo ngày, §5 nguyên tắc 5).
 */

import { prisma, type PrismaClient } from "@feedbackme/db";
import {
  FLASHCARD_NEW_PER_DAY,
  FLASHCARD_SESSION_LIMIT,
  LearningEventType,
  isFlashcardMode,
  isFlashcardRating,
  type FlashcardMode,
  type FlashcardRating,
} from "@feedbackme/shared-types";
import {
  cardStage,
  normalizeTerm,
  previewIntervals,
  scheduleReview,
  vnDayStart,
  type SrsState,
} from "./flashcardSrs";

export { FLASHCARD_NEW_PER_DAY, FLASHCARD_SESSION_LIMIT };

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** "Hay quên" = đã quên từ 2 lần trở lên. */
export const FLASHCARD_STRUGGLING_LAPSES = 2;

export class FlashcardError extends Error {
  readonly name = "FlashcardError";
  constructor(public readonly code: "not_enrolled" | "card_not_in_deck" | "validation_failed") {
    super(code);
  }
}

export interface QueueCard {
  itemId: string;
  contentItemId: string;
  term: string;
  reading?: string;
  meaning: string;
  example?: string;
  exampleReading?: string;
  exampleMeaning?: string;
  note?: string;
  audioUrl?: string;
  isNew: boolean;
  /** Khoảng ôn tới (ngày) ứng với từng nút, để nút hiển thị đúng kết quả sẽ áp. */
  intervals: Record<FlashcardRating, number>;
}

export type FlashcardQueueReason = "not_enrolled" | "empty_deck" | "no_audio_cards" | "all_done";

export interface FlashcardQueue {
  cards: QueueCard[];
  /** Số thẻ đến hạn thật (có thể nhiều hơn số thẻ phiên lấy). */
  dueCount: number;
  /** Số thẻ mới còn được ôn hôm nay theo trần ngày. */
  newCount: number;
  reason?: FlashcardQueueReason;
}

export interface FlashcardStats {
  enrolled: boolean;
  /** Số thẻ trong bộ (đã gộp trùng). */
  total: number;
  /** Thẻ đã có trạng thái. */
  learned: number;
  dueToday: number;
  struggling: number;
  /** Thẻ mới còn ôn được hôm nay (theo trần ngày và số thẻ mới thật). */
  newAvailable: number;
  distribution: { new: number; learning: number; mature: number };
}

export interface FlashcardReviewInput {
  itemId: string;
  rating: FlashcardRating;
  mode: FlashcardMode;
  /** Id do máy khách sinh cho mỗi lượt; gửi lại cùng id thì không tính hai lần. */
  reviewId: string;
}

export interface FlashcardReviewResult {
  duplicate: boolean;
  state: SrsState & { dueAt: Date };
}

interface DeckItem {
  itemId: string;
  contentItemId: string;
  term: string;
  reading?: string;
  meaning: string;
  example?: string;
  exampleReading?: string;
  exampleMeaning?: string;
  note?: string;
  audioUrl?: string;
  order: number;
}

interface StateRow extends SrsState {
  id: string;
  itemId: string;
  dueAt: Date;
  lastReviewedAt: Date;
  lastReviewId: string | null;
}

interface Deck {
  enrolled: boolean;
  /** Mọi dòng học viên thấy được (kể cả dòng trùng từ): itemId → khối chứa nó. Dùng để kiểm lượt ôn. */
  visible: Map<string, string>;
  /** Thẻ đã gộp trùng, theo thứ tự chương → bài → khối → dòng. */
  cards: DeckItem[];
  states: Map<string, StateRow>;
  /** Số thẻ mới đã ôn lần đầu từ đầu ngày VN (mọi hàng, kể cả thẻ sau này bị ẩn). */
  introducedToday: number;
}

const asRec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);

async function loadDeck(userId: string, courseId: string, now: Date, db: PrismaClient): Promise<Deck> {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  const empty: Deck = { enrolled: false, visible: new Map(), cards: [], states: new Map(), introducedToday: 0 };
  if (!enrollment) return empty;

  // Chỉ thứ học viên thấy được: module/bài không ẩn, không khoá; khối không ẩn.
  const modules = await db.module.findMany({
    where: { courseId, isHidden: false, isLocked: false },
    orderBy: { orderIndex: "asc" },
    select: {
      lessons: {
        where: { isHidden: false, isLocked: false },
        orderBy: { orderIndex: "asc" },
        select: {
          contentItems: {
            where: { type: "vocab_list", isHidden: false },
            orderBy: { orderIndex: "asc" },
            select: { id: true, payload: true },
          },
        },
      },
    },
  });

  const items: DeckItem[] = [];
  let order = 0;
  for (const mod of modules)
    for (const lesson of mod.lessons)
      for (const block of lesson.contentItems) {
        const raw = asRec(block.payload).items;
        if (!Array.isArray(raw)) continue;
        for (const r of raw) {
          const it = asRec(r);
          const id = str(it.id);
          const term = str(it.term);
          const meaning = str(it.meaning);
          if (!id || !term || !meaning) continue;
          items.push({
            itemId: id,
            contentItemId: block.id,
            term,
            reading: str(it.reading),
            meaning,
            example: str(it.example),
            exampleReading: str(it.exampleReading),
            exampleMeaning: str(it.exampleMeaning),
            note: str(it.note),
            audioUrl: str(it.audioUrl),
            order: order++,
          });
        }
      }

  const rows = await db.flashcardState.findMany({
    where: { userId, courseId },
    select: {
      id: true, itemId: true, easeFactor: true, intervalDays: true, repetitions: true, lapses: true,
      dueAt: true, lastReviewedAt: true, lastReviewId: true, introducedAt: true,
    },
  });
  const states = new Map<string, StateRow>(rows.map((r) => [r.itemId, r]));
  const todayStart = vnDayStart(now).getTime();
  const introducedToday = rows.filter((r) => r.introducedAt.getTime() >= todayStart).length;

  // Gộp trùng theo từ chuẩn hoá: ưu tiên dòng đã có trạng thái (mới ôn gần nhất),
  // không có thì dòng đầu tiên theo thứ tự bộ thẻ.
  const groups = new Map<string, DeckItem[]>();
  for (const it of items) {
    const key = normalizeTerm(it.term);
    const g = groups.get(key);
    if (g) g.push(it);
    else groups.set(key, [it]);
  }
  const cards: DeckItem[] = [];
  for (const g of groups.values()) {
    const withState = g
      .filter((it) => states.has(it.itemId))
      .sort((a, b) => states.get(b.itemId)!.lastReviewedAt.getTime() - states.get(a.itemId)!.lastReviewedAt.getTime());
    cards.push(withState[0] ?? g[0]!);
  }
  cards.sort((a, b) => a.order - b.order);

  return { enrolled: true, visible: new Map(items.map((i) => [i.itemId, i.contentItemId])), cards, states, introducedToday };
}

const isDue = (s: StateRow, endOfToday: number) => s.dueAt.getTime() < endOfToday;

function toQueueCard(c: DeckItem, s: StateRow | undefined, now: Date): QueueCard {
  return {
    itemId: c.itemId,
    contentItemId: c.contentItemId,
    term: c.term,
    ...(c.reading ? { reading: c.reading } : {}),
    meaning: c.meaning,
    ...(c.example ? { example: c.example } : {}),
    ...(c.exampleReading ? { exampleReading: c.exampleReading } : {}),
    ...(c.exampleMeaning ? { exampleMeaning: c.exampleMeaning } : {}),
    ...(c.note ? { note: c.note } : {}),
    ...(c.audioUrl ? { audioUrl: c.audioUrl } : {}),
    isNew: !s,
    intervals: previewIntervals(s ?? null, now),
  };
}

export async function getFlashcardQueue(
  userId: string,
  courseId: string,
  opts: { mode: FlashcardMode; now?: Date },
  db: PrismaClient = prisma,
): Promise<FlashcardQueue> {
  const now = opts.now ?? new Date();
  const deck = await loadDeck(userId, courseId, now, db);
  if (!deck.enrolled) return { cards: [], dueCount: 0, newCount: 0, reason: "not_enrolled" };
  if (deck.cards.length === 0) return { cards: [], dueCount: 0, newCount: 0, reason: "empty_deck" };

  const audioOnly = opts.mode === "audio_to_term";
  const pool = audioOnly ? deck.cards.filter((c) => !!c.audioUrl) : deck.cards;
  if (pool.length === 0) return { cards: [], dueCount: 0, newCount: 0, reason: "no_audio_cards" };

  const endOfToday = vnDayStart(now).getTime() + DAY_MS;
  const due = pool
    .filter((c) => deck.states.has(c.itemId) && isDue(deck.states.get(c.itemId)!, endOfToday))
    .sort((a, b) => deck.states.get(a.itemId)!.dueAt.getTime() - deck.states.get(b.itemId)!.dueAt.getTime() || a.order - b.order);
  const quota = Math.max(0, FLASHCARD_NEW_PER_DAY - deck.introducedToday);
  const fresh = pool.filter((c) => !deck.states.has(c.itemId)).slice(0, quota);

  const cards = [...due, ...fresh]
    .slice(0, FLASHCARD_SESSION_LIMIT)
    .map((c) => toQueueCard(c, deck.states.get(c.itemId), now));

  return {
    cards,
    dueCount: due.length,
    newCount: fresh.length,
    ...(cards.length === 0 ? { reason: "all_done" as const } : {}),
  };
}

export async function getFlashcardStats(
  userId: string,
  courseId: string,
  now: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<FlashcardStats> {
  const deck = await loadDeck(userId, courseId, now, db);
  const zero: FlashcardStats = {
    enrolled: deck.enrolled,
    total: 0, learned: 0, dueToday: 0, struggling: 0, newAvailable: 0,
    distribution: { new: 0, learning: 0, mature: 0 },
  };
  if (!deck.enrolled) return zero;

  const endOfToday = vnDayStart(now).getTime() + DAY_MS;
  const out: FlashcardStats = { ...zero, distribution: { new: 0, learning: 0, mature: 0 }, total: deck.cards.length };
  for (const c of deck.cards) {
    const s = deck.states.get(c.itemId);
    out.distribution[cardStage(s ?? null)] += 1;
    if (!s) continue;
    out.learned += 1;
    if (isDue(s, endOfToday)) out.dueToday += 1;
    if (s.lapses >= FLASHCARD_STRUGGLING_LAPSES) out.struggling += 1;
  }
  out.newAvailable = Math.min(out.distribution.new, Math.max(0, FLASHCARD_NEW_PER_DAY - deck.introducedToday));
  return out;
}

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "P2002";
class RetryReview extends Error {}

/**
 * Ghi một lượt ôn. Cập nhật trạng thái và phát `flashcard.reviewed` trong CÙNG giao
 * dịch (§5 nguyên tắc 1). Gửi lại cùng `reviewId` thì không áp lần hai.
 */
export async function reviewFlashcard(
  userId: string,
  courseId: string,
  input: FlashcardReviewInput,
  now: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<FlashcardReviewResult> {
  if (
    !isFlashcardRating(input?.rating) ||
    !isFlashcardMode(input?.mode) ||
    typeof input?.reviewId !== "string" || !UUID.test(input.reviewId) ||
    typeof input?.itemId !== "string" || !UUID.test(input.itemId)
  ) {
    throw new FlashcardError("validation_failed");
  }

  const deck = await loadDeck(userId, courseId, now, db);
  if (!deck.enrolled) throw new FlashcardError("not_enrolled");
  const contentItemId = deck.visible.get(input.itemId);
  if (!contentItemId) throw new FlashcardError("card_not_in_deck");

  const eventKey = `${LearningEventType.FlashcardReviewed}:${userId}:${input.reviewId}`;
  const view = (r: SrsState & { dueAt: Date }) => ({
    easeFactor: r.easeFactor, intervalDays: r.intervalDays, repetitions: r.repetitions, lapses: r.lapses, dueAt: r.dueAt,
  });

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        if (await tx.learningEvent.findUnique({ where: { eventKey }, select: { id: true } })) {
          const cur = await tx.flashcardState.findUnique({ where: { userId_itemId: { userId, itemId: input.itemId } } });
          if (!cur) throw new FlashcardError("card_not_in_deck");
          return { duplicate: true, state: view(cur) };
        }

        const cur = await tx.flashcardState.findUnique({ where: { userId_itemId: { userId, itemId: input.itemId } } });
        const next = scheduleReview(cur, input.rating, now);
        const data = {
          easeFactor: next.easeFactor, intervalDays: next.intervalDays, repetitions: next.repetitions,
          lapses: next.lapses, dueAt: next.dueAt, lastReviewedAt: now, lastRating: input.rating,
          lastReviewId: input.reviewId,
        };
        if (cur) {
          // Khoá lạc quan: hai thiết bị ôn cùng một thẻ cùng lúc thì lượt sau tính lại trên kết quả lượt trước.
          const res = await tx.flashcardState.updateMany({
            where: { id: cur.id, lastReviewId: cur.lastReviewId },
            data,
          });
          if (res.count === 0) throw new RetryReview();
        } else {
          await tx.flashcardState.create({
            data: { userId, courseId, contentItemId, itemId: input.itemId, introducedAt: now, ...data },
          });
        }
        await tx.learningEvent.create({
          data: {
            userId,
            courseId,
            eventType: LearningEventType.FlashcardReviewed,
            eventKey,
            payload: {
              itemId: input.itemId,
              contentItemId,
              rating: input.rating,
              mode: input.mode,
              intervalDays: next.intervalDays,
              reviewId: input.reviewId,
            },
          },
        });
        return { duplicate: false, state: view(next) };
      });
    } catch (e) {
      if (e instanceof RetryReview) continue;
      // Hai lượt đồng thời tạo trạng thái cho cùng một thẻ, hoặc cùng reviewId: thử lại, lần sau sẽ thấy hàng/sự kiện đã có.
      if (isUniqueViolation(e)) continue;
      throw e;
    }
  }
  throw new Error("flashcard review: too much contention");
}
