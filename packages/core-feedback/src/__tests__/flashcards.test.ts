import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  FLASHCARD_NEW_PER_DAY,
  FLASHCARD_SESSION_LIMIT,
  FlashcardError,
  getFlashcardQueue,
  getFlashcardStats,
  reviewFlashcard,
} from "../flashcards";
import { vnDayStart } from "../flashcardSrs";

/**
 * LANG G4 / G4.2–G4.4 — bộ thẻ, phiên ôn, ghi nhận lượt ôn và thống kê.
 * Thẻ = một dòng của khối vocab_list; trạng thái chỉ có sau lần ôn đầu tiên.
 */

const DAY = 24 * 60 * 60 * 1000;
// 15:00 giờ VN ngày 03/10/2026.
const NOW = new Date("2026-10-03T08:00:00Z");
const TODAY0 = vnDayStart(NOW); // 00:00 VN hôm nay
const END_OF_TODAY = new Date(TODAY0.getTime() + DAY); // 00:00 VN ngày mai

let seq = 0;

interface ItemSpec {
  term: string;
  meaning?: string;
  audioUrl?: string;
}
interface BlockSpec {
  items: ItemSpec[];
  hidden?: boolean;
  type?: string;
  payload?: unknown;
}
interface LessonSpec {
  blocks: BlockSpec[];
  hidden?: boolean;
  locked?: boolean;
}
interface ModSpec {
  lessons: LessonSpec[];
  hidden?: boolean;
  locked?: boolean;
}
interface Card {
  term: string;
  itemId: string;
  contentItemId: string;
}
interface Fx {
  userId: string;
  courseId: string;
  cards: Card[];
  byTerm: Map<string, Card>;
}

async function makeUser(tag: string) {
  const n = ++seq;
  return prisma.user.create({
    data: { email: `fc-${tag}-${Date.now()}-${n}@e.com`, passwordHash: "x", displayName: `HV ${n}` },
  });
}

async function fx(mods: ModSpec[], opts: { enroll?: boolean; userId?: string } = {}): Promise<Fx> {
  const n = ++seq;
  const course = await prisma.course.create({
    data: { slug: `fc-${Date.now()}-${n}`, title: "Tiếng Trung", description: "x" },
  });
  const user = opts.userId ? { id: opts.userId } : await makeUser("u");
  if (opts.enroll ?? true) {
    const section = await prisma.courseSection.create({ data: { courseId: course.id, name: "Lớp" } });
    await prisma.enrollment.create({
      data: { userId: user.id, courseId: course.id, sectionId: section.id, courseVersion: 1 },
    });
  }
  const cards: Card[] = [];
  for (let mi = 0; mi < mods.length; mi++) {
    const m = mods[mi]!;
    const mod = await prisma.module.create({
      data: { courseId: course.id, title: `Chương ${mi + 1}`, orderIndex: mi, isHidden: m.hidden ?? false, isLocked: m.locked ?? false },
    });
    for (let li = 0; li < m.lessons.length; li++) {
      const l = m.lessons[li]!;
      const lesson = await prisma.lesson.create({
        data: { moduleId: mod.id, title: `Bài ${mi + 1}.${li + 1}`, orderIndex: li, isHidden: l.hidden ?? false, isLocked: l.locked ?? false },
      });
      for (let bi = 0; bi < l.blocks.length; bi++) {
        const b = l.blocks[bi]!;
        const items = b.items.map((it) => ({
          id: randomUUID(),
          term: it.term,
          meaning: it.meaning ?? `nghĩa ${it.term}`,
          ...(it.audioUrl ? { audioUrl: it.audioUrl } : {}),
        }));
        const ci = await prisma.contentItem.create({
          data: {
            lessonId: lesson.id,
            type: (b.type ?? "vocab_list") as "vocab_list",
            orderIndex: bi,
            isHidden: b.hidden ?? false,
            payload: (b.payload ?? { items }) as object,
          },
        });
        if (!b.payload) for (const it of items) cards.push({ term: it.term, itemId: it.id, contentItemId: ci.id });
      }
    }
  }
  return { userId: user.id, courseId: course.id, cards, byTerm: new Map(cards.map((c) => [c.term, c])) };
}

const one = (terms: string[], extra: Partial<LessonSpec> = {}): ModSpec[] => [
  { lessons: [{ blocks: [{ items: terms.map((term) => ({ term })) }], ...extra }] },
];

async function putState(
  f: Fx,
  term: string,
  over: Partial<{
    dueAt: Date;
    intervalDays: number;
    repetitions: number;
    lapses: number;
    easeFactor: number;
    introducedAt: Date;
    lastReviewedAt: Date;
  }> = {},
) {
  const c = f.byTerm.get(term)!;
  return prisma.flashcardState.create({
    data: {
      userId: f.userId,
      courseId: f.courseId,
      contentItemId: c.contentItemId,
      itemId: c.itemId,
      easeFactor: over.easeFactor ?? 2.5,
      intervalDays: over.intervalDays ?? 6,
      repetitions: over.repetitions ?? 2,
      lapses: over.lapses ?? 0,
      dueAt: over.dueAt ?? new Date(TODAY0.getTime() - DAY),
      introducedAt: over.introducedAt ?? new Date(TODAY0.getTime() - 5 * DAY),
      lastReviewedAt: over.lastReviewedAt ?? new Date(TODAY0.getTime() - 2 * DAY),
      lastRating: "good",
    },
  });
}

const terms = (q: { cards: Array<{ term: string }> }) => q.cards.map((c) => c.term);

describe("hằng số", () => {
  it("10 thẻ mới/ngày, 20 thẻ/phiên", () => {
    expect(FLASHCARD_NEW_PER_DAY).toBe(10);
    expect(FLASHCARD_SESSION_LIMIT).toBe(20);
  });
});

describe("bộ thẻ — những gì học viên thấy được (G4.2.1)", () => {
  it("bỏ dòng thuộc module/bài/khối bị ẩn hoặc khoá; bỏ khối không phải vocab_list; payload hỏng không làm sập", async () => {
    const f = await fx([
      { lessons: [{ blocks: [{ items: [{ term: "ok1" }] }] }] },
      { hidden: true, lessons: [{ blocks: [{ items: [{ term: "mod-an" }] }] }] },
      { locked: true, lessons: [{ blocks: [{ items: [{ term: "mod-khoa" }] }] }] },
      {
        lessons: [
          { hidden: true, blocks: [{ items: [{ term: "bai-an" }] }] },
          { locked: true, blocks: [{ items: [{ term: "bai-khoa" }] }] },
          {
            blocks: [
              { items: [{ term: "khoi-an" }], hidden: true },
              { items: [], type: "markdown", payload: { body: "không phải từ vựng" } },
              { items: [], payload: { items: "sai" } },
              { items: [], payload: null },
              { items: [{ term: "ok2" }] },
            ],
          },
        ],
      },
    ]);
    const q = await getFlashcardQueue(f.userId, f.courseId, { mode: "term_to_meaning", now: NOW });
    expect(terms(q)).toEqual(["ok1", "ok2"]);
    expect((await getFlashcardStats(f.userId, f.courseId, NOW)).total).toBe(2);
  });

  it("G4.2.2: hai dòng cùng từ (khác hoa-thường/khoảng trắng/dạng Unicode) → chỉ MỘT thẻ; ưu tiên thẻ đã có trạng thái", async () => {
    const f = await fx([
      { lessons: [{ blocks: [{ items: [{ term: "Hello" }, { term: "café" }] }] }] },
      { lessons: [{ blocks: [{ items: [{ term: " hello " }, { term: "café" }, { term: "khác" }] }] }] },
    ]);
    const q1 = await getFlashcardQueue(f.userId, f.courseId, { mode: "term_to_meaning", now: NOW });
    // Chưa ai có trạng thái: lấy dòng đầu tiên theo thứ tự bộ thẻ.
    expect(terms(q1)).toEqual(["Hello", "café", "khác"]);

    // Học viên đã ôn bản thứ hai của "hello": thẻ đó thắng.
    const second = f.cards.find((c) => c.term === " hello ")!;
    await prisma.flashcardState.create({
      data: {
        userId: f.userId, courseId: f.courseId, contentItemId: second.contentItemId, itemId: second.itemId,
        easeFactor: 2.5, intervalDays: 3, repetitions: 1, lapses: 0,
        dueAt: new Date(TODAY0.getTime() - DAY), introducedAt: TODAY0, lastReviewedAt: TODAY0, lastRating: "good",
      },
    });
    const q2 = await getFlashcardQueue(f.userId, f.courseId, { mode: "term_to_meaning", now: NOW });
    expect(q2.cards.map((c) => c.itemId)).toContain(second.itemId);
    expect(q2.cards.filter((c) => c.term.trim().toLowerCase() === "hello")).toHaveLength(1);
    expect((await getFlashcardStats(f.userId, f.courseId, NOW)).total).toBe(3);
  });
});

describe("phiên ôn — thứ tự và hạn mức (G4.2.3, G4.2.4)", () => {
  it("thẻ đến hạn trước thẻ mới; trong thẻ đến hạn, hạn cũ nhất trước; thẻ mới theo chương → bài → khối → dòng", async () => {
    const f = await fx([
      { lessons: [{ blocks: [{ items: [{ term: "a1" }, { term: "a2" }] }, { items: [{ term: "a3" }] }] }, { blocks: [{ items: [{ term: "a4" }] }] }] },
      { lessons: [{ blocks: [{ items: [{ term: "b1" }] }] }] },
    ]);
    await putState(f, "b1", { dueAt: new Date(TODAY0.getTime() - 3 * DAY) }); // quá hạn lâu nhất
    await putState(f, "a2", { dueAt: new Date(TODAY0.getTime() - 1 * DAY) });
    const q = await getFlashcardQueue(f.userId, f.courseId, { mode: "term_to_meaning", now: NOW });
    expect(terms(q)).toEqual(["b1", "a2", "a1", "a3", "a4"]);
    expect(q.cards.map((c) => c.isNew)).toEqual([false, false, true, true, true]);
    expect(q).toMatchObject({ dueCount: 2, newCount: 3 });
  });

  it("đến hạn nghĩa là hạn ≤ cuối ngày VN: 23:59 hôm nay là đến hạn, 00:00 ngày mai thì chưa", async () => {
    const f = await fx(one(["hom-nay", "ngay-mai"]));
    await putState(f, "hom-nay", { dueAt: new Date(END_OF_TODAY.getTime() - 60_000) });
    await putState(f, "ngay-mai", { dueAt: END_OF_TODAY });
    const q = await getFlashcardQueue(f.userId, f.courseId, { mode: "term_to_meaning", now: NOW });
    expect(terms(q)).toEqual(["hom-nay"]);
  });

  it("trần 10 thẻ mới mỗi ngày", async () => {
    const f = await fx(one(Array.from({ length: 15 }, (_, i) => `t${i}`)));
    const q = await getFlashcardQueue(f.userId, f.courseId, { mode: "term_to_meaning", now: NOW });
    expect(q.cards).toHaveLength(10);
    expect(q.cards.every((c) => c.isNew)).toBe(true);
  });

  it("thẻ mới đã ôn trong ngày (ở phiên trước) tính vào trần; hôm qua thì không", async () => {
    const f = await fx(one(Array.from({ length: 15 }, (_, i) => `t${i}`)));
    for (let i = 0; i < 6; i++) await putState(f, `t${i}`, { introducedAt: new Date(TODAY0.getTime() + 3600_000), dueAt: new Date(TODAY0.getTime() + 2 * DAY) });
    for (let i = 6; i < 9; i++) await putState(f, `t${i}`, { introducedAt: new Date(TODAY0.getTime() - 1000), dueAt: new Date(TODAY0.getTime() + 2 * DAY) });
    const q = await getFlashcardQueue(f.userId, f.courseId, { mode: "term_to_meaning", now: NOW });
    // 6 thẻ mới đã dùng hôm nay → còn 4 chỗ; t9..t14 là thẻ chưa ôn.
    expect(q.cards.filter((c) => c.isNew)).toHaveLength(4);
    expect(terms(q)).toEqual(["t9", "t10", "t11", "t12"]);
  });

  it("trần 20 thẻ mỗi phiên (thẻ đến hạn chiếm chỗ trước)", async () => {
    const f = await fx(one(Array.from({ length: 30 }, (_, i) => `t${i}`)));
    for (let i = 0; i < 25; i++) await putState(f, `t${i}`, { dueAt: new Date(TODAY0.getTime() - (i + 1) * 60_000) });
    const q = await getFlashcardQueue(f.userId, f.courseId, { mode: "term_to_meaning", now: NOW });
    expect(q.cards).toHaveLength(20);
    expect(q.cards.every((c) => !c.isNew)).toBe(true);
    expect(q.dueCount).toBe(25); // số đến hạn thật, dù phiên chỉ lấy 20
  });
});

describe("chế độ ôn và trạng thái rỗng (G4.2.5, G4.2.6)", () => {
  it("Nghe→Hán chỉ lấy thẻ có audio; không thẻ nào có audio thì báo rõ", async () => {
    const f = await fx([{ lessons: [{ blocks: [{ items: [{ term: "co", audioUrl: "/api/lesson-media/audio/a-1790000000000-ab.mp3" }, { term: "khong" }] }] }] }]);
    const q = await getFlashcardQueue(f.userId, f.courseId, { mode: "audio_to_term", now: NOW });
    expect(terms(q)).toEqual(["co"]);
    const none = await fx(one(["khong1", "khong2"]));
    expect(await getFlashcardQueue(none.userId, none.courseId, { mode: "audio_to_term", now: NOW })).toMatchObject({
      cards: [], reason: "no_audio_cards",
    });
  });

  it("chưa ghi danh → not_enrolled; khoá không có từ vựng → empty_deck; hết việc hôm nay → all_done", async () => {
    const notEnrolled = await fx(one(["a"]), { enroll: false });
    expect(await getFlashcardQueue(notEnrolled.userId, notEnrolled.courseId, { mode: "term_to_meaning", now: NOW })).toMatchObject({
      cards: [], reason: "not_enrolled",
    });
    const empty = await fx([{ lessons: [{ blocks: [{ items: [], type: "markdown", payload: { body: "x" } }] }] }]);
    expect(await getFlashcardQueue(empty.userId, empty.courseId, { mode: "term_to_meaning", now: NOW })).toMatchObject({
      cards: [], reason: "empty_deck",
    });
    const done = await fx(one(["a"]));
    await putState(done, "a", { dueAt: new Date(TODAY0.getTime() + 5 * DAY) });
    expect(await getFlashcardQueue(done.userId, done.courseId, { mode: "term_to_meaning", now: NOW })).toMatchObject({
      cards: [], reason: "all_done",
    });
  });

  it("mỗi thẻ kèm bốn khoảng ôn để nút hiển thị", async () => {
    const f = await fx(one(["a"]));
    const [c] = (await getFlashcardQueue(f.userId, f.courseId, { mode: "term_to_meaning", now: NOW })).cards;
    expect(c!.intervals).toEqual({ again: 1, hard: 1, good: 2, easy: 4 });
  });
});

describe("ghi nhận lượt ôn (G4.3)", () => {
  const review = (f: Fx, term: string, rating: "again" | "hard" | "good" | "easy", over: Record<string, unknown> = {}, now = NOW) =>
    reviewFlashcard(f.userId, f.courseId, { itemId: f.byTerm.get(term)!.itemId, rating, mode: "term_to_meaning", reviewId: randomUUID(), ...over }, now);

  it("G4.3.1 + G4.3.4: lượt đầu tạo trạng thái đúng lịch, ghi introducedAt, phát flashcard.reviewed", async () => {
    const f = await fx(one(["a"]));
    const reviewId = randomUUID();
    const r = await review(f, "a", "good", { reviewId });
    expect(r.duplicate).toBe(false);
    expect(r.state).toMatchObject({ intervalDays: 2, repetitions: 1, lapses: 0 });

    const row = await prisma.flashcardState.findUniqueOrThrow({
      where: { userId_itemId: { userId: f.userId, itemId: f.byTerm.get("a")!.itemId } },
    });
    expect(row).toMatchObject({ intervalDays: 2, repetitions: 1, lastRating: "good", lastReviewId: reviewId, courseId: f.courseId });
    expect(row.introducedAt.getTime()).toBe(NOW.getTime());
    expect(row.dueAt.toISOString()).toBe(new Date(TODAY0.getTime() + 2 * DAY).toISOString());

    const events = await prisma.learningEvent.findMany({ where: { userId: f.userId, eventType: LearningEventType.FlashcardReviewed } });
    expect(events).toHaveLength(1);
    expect(events[0]!.courseId).toBe(f.courseId);
    expect(events[0]!.payload).toMatchObject({
      itemId: f.byTerm.get("a")!.itemId,
      contentItemId: f.byTerm.get("a")!.contentItemId,
      rating: "good",
      mode: "term_to_meaning",
      intervalDays: 2,
      reviewId,
    });
  });

  it("lượt thứ hai dùng công thức của thẻ đã ôn; Quên tăng lapse và đưa về 1 ngày", async () => {
    const f = await fx(one(["a"]));
    await review(f, "a", "good", {}, NOW); // 2 ngày
    const later = new Date(NOW.getTime() + 2 * DAY);
    const r2 = await review(f, "a", "good", {}, later);
    expect(r2.state.intervalDays).toBe(5); // round(2 × 2.5)
    const r3 = await review(f, "a", "again", {}, new Date(later.getTime() + 5 * DAY));
    expect(r3.state).toMatchObject({ intervalDays: 1, repetitions: 0, lapses: 1 });
  });

  it("G4.3.2: gửi lại cùng reviewId → không tính lần hai; trạng thái và số event không đổi", async () => {
    const f = await fx(one(["a"]));
    const reviewId = randomUUID();
    const first = await review(f, "a", "good", { reviewId });
    const again = await review(f, "a", "easy", { reviewId }); // cùng id, rating khác: vẫn là lượt cũ
    expect(again.duplicate).toBe(true);
    expect(again.state.intervalDays).toBe(first.state.intervalDays);
    expect(await prisma.learningEvent.count({ where: { userId: f.userId, eventType: LearningEventType.FlashcardReviewed } })).toBe(1);
    expect((await prisma.flashcardState.findFirstOrThrow({ where: { userId: f.userId } })).repetitions).toBe(1);
  });

  it("G4.3.3: thẻ không thuộc bộ thẻ (khoá khác, bài ẩn, id lạ) bị từ chối, không tạo gì", async () => {
    const f = await fx([{ lessons: [{ blocks: [{ items: [{ term: "ok" }] }] }, { hidden: true, blocks: [{ items: [{ term: "an" }] }] }] }]);
    const other = await fx(one(["khoa-khac"]));
    for (const itemId of [f.byTerm.get("an")!.itemId, other.byTerm.get("khoa-khac")!.itemId, randomUUID()]) {
      await expect(
        reviewFlashcard(f.userId, f.courseId, { itemId, rating: "good", mode: "term_to_meaning", reviewId: randomUUID() }, NOW),
      ).rejects.toMatchObject({ code: "card_not_in_deck" });
    }
    expect(await prisma.flashcardState.count({ where: { userId: f.userId } })).toBe(0);
    expect(await prisma.learningEvent.count({ where: { userId: f.userId, eventType: LearningEventType.FlashcardReviewed } })).toBe(0);
  });

  it("G4.3.3: rating/mode/reviewId sai → validation_failed; chưa ghi danh → not_enrolled", async () => {
    const f = await fx(one(["a"]));
    const base = { itemId: f.byTerm.get("a")!.itemId, rating: "good", mode: "term_to_meaning", reviewId: randomUUID() };
    // Đối chứng: đầu vào hợp lệ qua được.
    await expect(reviewFlashcard(f.userId, f.courseId, base as never, NOW)).resolves.toBeDefined();
    for (const bad of [{ rating: "perfect" }, { mode: "hanzi" }, { reviewId: "không-phải-uuid" }, { itemId: "x" }]) {
      await expect(reviewFlashcard(f.userId, f.courseId, { ...base, reviewId: randomUUID(), ...bad } as never, NOW)).rejects.toMatchObject({ code: "validation_failed" });
    }
    const ne = await fx(one(["a"]), { enroll: false });
    await expect(
      reviewFlashcard(ne.userId, ne.courseId, { itemId: ne.byTerm.get("a")!.itemId, rating: "good", mode: "term_to_meaning", reviewId: randomUUID() }, NOW),
    ).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("G4.3.4: hai lượt ôn cùng lúc cho một thẻ không tạo hai dòng trạng thái và không ném lỗi", async () => {
    const f = await fx(one(["a"]));
    await Promise.all([review(f, "a", "good"), review(f, "a", "easy")]);
    expect(await prisma.flashcardState.count({ where: { userId: f.userId } })).toBe(1);
    expect(await prisma.learningEvent.count({ where: { userId: f.userId, eventType: LearningEventType.FlashcardReviewed } })).toBe(2);
  });

  it("G4.3.5: không cập nhật LearnerSkillState và không cấp XP", async () => {
    const f = await fx(one(["a", "b"]));
    await review(f, "a", "easy");
    await review(f, "b", "again");
    expect(await prisma.learnerSkillState.count({ where: { userId: f.userId } })).toBe(0);
    expect(await prisma.xpTransaction.count({ where: { userId: f.userId } })).toBe(0);
  });

  it("FlashcardError là lỗi có mã", () => {
    expect(new FlashcardError("not_enrolled").code).toBe("not_enrolled");
  });
});

describe("thống kê (G4.4)", () => {
  it("G4.4.1 + G4.4.2: Đã học · Đến hạn hôm nay · Hay quên · phân bố Mới/Đang học/Nhớ lâu cộng lại bằng tổng", async () => {
    const f = await fx(one(["m1", "m2", "h1", "h2", "n1", "q1"]));
    await putState(f, "h1", { intervalDays: 5, dueAt: new Date(TODAY0.getTime() - DAY) }); // đang học, đến hạn
    await putState(f, "h2", { intervalDays: 20, dueAt: new Date(TODAY0.getTime() + 3 * DAY) }); // đang học, chưa tới hạn
    await putState(f, "n1", { intervalDays: 21, dueAt: new Date(TODAY0.getTime() + 20 * DAY) }); // nhớ lâu
    await putState(f, "q1", { intervalDays: 1, lapses: 2, dueAt: new Date(END_OF_TODAY.getTime() - 1000) }); // hay quên, đến hạn cuối ngày
    const s = await getFlashcardStats(f.userId, f.courseId, NOW);
    expect(s).toMatchObject({
      total: 6,
      learned: 4,
      dueToday: 2,
      struggling: 1,
      distribution: { new: 2, learning: 3, mature: 1 },
    });
    expect(s.distribution.new + s.distribution.learning + s.distribution.mature).toBe(s.total);
  });

  it("newAvailable = số thẻ mới còn có thể ôn hôm nay (theo trần ngày và số thẻ mới thật)", async () => {
    const f = await fx(one(Array.from({ length: 12 }, (_, i) => `t${i}`)));
    expect((await getFlashcardStats(f.userId, f.courseId, NOW)).newAvailable).toBe(10);
    for (let i = 0; i < 4; i++) await putState(f, `t${i}`, { introducedAt: new Date(TODAY0.getTime() + 3600_000), dueAt: new Date(TODAY0.getTime() + 2 * DAY) });
    // 8 thẻ còn mới, trần còn 6 → 6.
    expect((await getFlashcardStats(f.userId, f.courseId, NOW)).newAvailable).toBe(6);
  });

  it("G4.4.3 + G4.6.4: trạng thái mồ côi (dòng đã xoá khỏi khối, bài sau này bị ẩn) không được đếm và không làm hỏng", async () => {
    const f = await fx([
      { lessons: [{ blocks: [{ items: [{ term: "con" }, { term: "xoa" }] }] }, { blocks: [{ items: [{ term: "an" }] }] }] },
    ]);
    const future = new Date(TODAY0.getTime() + 5 * DAY);
    await putState(f, "con", { dueAt: future });
    await putState(f, "xoa", { dueAt: new Date(TODAY0.getTime() - DAY) }); // đến hạn nếu còn trong bộ thẻ
    await putState(f, "an", { dueAt: new Date(TODAY0.getTime() - DAY) }); // đến hạn nếu còn trong bộ thẻ

    // Xoá dòng "xoa" khỏi payload của khối (khối còn, dòng mất) và ẩn bài chứa "an".
    const block = await prisma.contentItem.findUniqueOrThrow({ where: { id: f.byTerm.get("xoa")!.contentItemId } });
    const kept = (block.payload as { items: Array<{ term: string }> }).items.filter((i) => i.term !== "xoa");
    await prisma.contentItem.update({ where: { id: block.id }, data: { payload: { items: kept } } });
    const anBlock = await prisma.contentItem.findUniqueOrThrow({ where: { id: f.byTerm.get("an")!.contentItemId } });
    await prisma.lesson.update({ where: { id: anBlock.lessonId }, data: { isHidden: true } });

    const s = await getFlashcardStats(f.userId, f.courseId, NOW);
    expect(s).toMatchObject({ total: 1, learned: 1, dueToday: 0 });
    const q = await getFlashcardQueue(f.userId, f.courseId, { mode: "term_to_meaning", now: NOW });
    expect(terms(q)).toEqual([]);
    expect(q.reason).toBe("all_done");
  });

  it("thống kê chỉ gồm số đếm: không có mastery, điểm hay phần trăm", async () => {
    const f = await fx(one(["a"]));
    await putState(f, "a");
    const json = JSON.stringify(await getFlashcardStats(f.userId, f.courseId, NOW));
    expect(json).not.toMatch(/mastery|probab|percent|pct|%/i);
  });

  it("G4.6.2: không kèm email hay tên hiển thị", async () => {
    const f = await fx(one(["a"]));
    await putState(f, "a");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: f.userId } });
    const json = JSON.stringify([
      await getFlashcardStats(f.userId, f.courseId, NOW),
      await getFlashcardQueue(f.userId, f.courseId, { mode: "term_to_meaning", now: NOW }),
    ]);
    expect(json).not.toContain(user.email);
    expect(json).not.toContain(user.displayName);
  });

  it("chưa ghi danh → thống kê rỗng (không lộ gì)", async () => {
    const f = await fx(one(["a"]), { enroll: false });
    expect(await getFlashcardStats(f.userId, f.courseId, NOW)).toMatchObject({ total: 0, learned: 0, dueToday: 0, enrolled: false });
  });
});
