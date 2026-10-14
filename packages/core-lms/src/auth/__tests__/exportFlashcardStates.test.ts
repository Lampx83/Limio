import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../register";
import { exportProfile } from "../profile";

/**
 * LANG G4 / G4.6.1 — lịch ôn flashcard là dữ liệu học tập cá nhân: phải nằm trong
 * bản xuất dữ liệu của chính người dùng và không lẫn dữ liệu người khác.
 */

async function setup(tag: string) {
  const u = await registerUser(
    { email: `fcx-${tag}-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: tag },
    "http://localhost:3000",
  );
  const course = await prisma.course.create({
    data: { slug: `fcx-${tag}-${Date.now()}-${Math.random()}`, title: "C", description: "x" },
  });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: "M", orderIndex: 0 } });
  const lesson = await prisma.lesson.create({ data: { moduleId: mod.id, title: "L", orderIndex: 0 } });
  const ci = await prisma.contentItem.create({
    data: { lessonId: lesson.id, type: "vocab_list", orderIndex: 0, payload: { items: [] } },
  });
  return { userId: u.userId, courseId: course.id, slug: course.slug, contentItemId: ci.id };
}

const state = (s: { userId: string; courseId: string; contentItemId: string }, itemId = randomUUID()) =>
  prisma.flashcardState.create({
    data: {
      userId: s.userId, courseId: s.courseId, contentItemId: s.contentItemId, itemId,
      easeFactor: 2.35, intervalDays: 12, repetitions: 3, lapses: 1,
      dueAt: new Date("2026-10-15T17:00:00Z"), introducedAt: new Date("2026-10-01T03:00:00Z"),
      lastReviewedAt: new Date("2026-10-03T08:00:00Z"), lastRating: "hard",
    },
  });

describe("exportProfile — lịch ôn flashcard", () => {
  it("có itemId, khoá học, lịch ôn và lần ôn cuối của chính người dùng", async () => {
    const a = await setup("a");
    const row = await state(a);
    const out = (await exportProfile(a.userId)) as unknown as { flashcardStates: Array<Record<string, unknown>> };
    expect(out.flashcardStates).toHaveLength(1);
    expect(out.flashcardStates[0]).toMatchObject({
      itemId: row.itemId,
      easeFactor: 2.35,
      intervalDays: 12,
      repetitions: 3,
      lapses: 1,
      lastRating: "hard",
      course: { slug: a.slug },
    });
    expect(out.flashcardStates[0]!.dueAt).toBeInstanceOf(Date);
    expect(out.flashcardStates[0]!.lastReviewedAt).toBeInstanceOf(Date);
  });

  it("không lẫn dữ liệu của người khác; người chưa ôn thẻ nào thì mảng rỗng", async () => {
    const a = await setup("a");
    const b = await setup("b");
    await state(b);
    const out = (await exportProfile(a.userId)) as unknown as { flashcardStates: unknown[] };
    expect(out.flashcardStates).toEqual([]);
  });

  it("không lộ khoá nội bộ không cần thiết (userId nằm ngoài, passwordHash không bao giờ có)", async () => {
    const a = await setup("a");
    await state(a);
    const out = (await exportProfile(a.userId)) as unknown as Record<string, unknown>;
    expect("passwordHash" in out).toBe(false);
  });
});
