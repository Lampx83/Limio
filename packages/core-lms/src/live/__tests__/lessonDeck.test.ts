import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { addCoInstructorByEmail } from "../../courses/instructors";
import { createLiveDeck } from "../decks";
import { attachLessonDeck, detachLessonDeck, getLessonDeckForEditor, LessonDeckError } from "../lessonDeck";
import { getLiveDeckByLesson } from "../share";
import { learnerActivityWhere } from "../../learning/activity";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser({ email: `o-${slug}@e.com`, password: "password1234", displayName: "Chủ khoá" }, BASE);
  const other = await registerUser({ email: `x-${slug}@e.com`, password: "password1234", displayName: "Người ngoài" }, BASE);
  const c = await createCourse(owner.userId, { title: slug, description: "x", slug });
  const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l1 = await createLesson(owner.userId, m.moduleId, { title: "L1", orderIndex: 0 });
  const l2 = await createLesson(owner.userId, m.moduleId, { title: "L2", orderIndex: 1 });
  const d1 = await createLiveDeck({ userId: owner.userId, title: "Bài giảng 1" }, prisma);
  const d2 = await createLiveDeck({ userId: owner.userId, title: "Bài giảng 2" }, prisma);
  return { ownerId: owner.userId, otherId: other.userId, courseId: c.courseId, l1: l1.lessonId, l2: l2.lessonId, d1: d1.id, d2: d2.id };
}

const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof LessonDeckError ? e.code : String(e)));

describe("bài giảng slide của bài học", () => {
  it("gắn, đọc lại và gỡ; ghi sự kiện nhưng không tính là hoạt động học", async () => {
    const t = await setup("ld-basic");
    const before = await getLessonDeckForEditor(t.ownerId, t.l1);
    expect(before.attached).toBeNull();
    expect(before.isOwner).toBe(true);
    expect(before.candidates.map((c) => c.id).sort()).toEqual([t.d1, t.d2].sort());

    await attachLessonDeck(t.ownerId, t.l1, t.d1);
    const after = await getLessonDeckForEditor(t.ownerId, t.l1);
    expect(after.attached?.id).toBe(t.d1);
    expect(after.candidates.map((c) => c.id)).toEqual([t.d2]); // bài giảng đã gắn không còn là ứng viên
    expect((await getLiveDeckByLesson(t.l1, prisma))?.id).toBe(t.d1);

    const events = await prisma.learningEvent.findMany({ where: { userId: t.ownerId, eventType: LearningEventType.LessonDeckAttached } });
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({ lessonId: t.l1, deckId: t.d1, replacedDeckId: null });
    expect(await prisma.learningEvent.count({ where: { userId: t.ownerId, ...learnerActivityWhere(), eventType: { startsWith: "lesson.deck." } } })).toBe(0);

    await detachLessonDeck(t.ownerId, t.l1);
    expect(await getLiveDeckByLesson(t.l1, prisma)).toBeNull();
    await detachLessonDeck(t.ownerId, t.l1); // gỡ lần nữa không lỗi
  });

  it("một bài học một bài giảng, một bài giảng một bài học", async () => {
    const t = await setup("ld-one");
    await attachLessonDeck(t.ownerId, t.l1, t.d1);
    expect(await code(attachLessonDeck(t.ownerId, t.l1, t.d1))).toBe("ok"); // gắn lại đúng cái đang gắn
    expect(await code(attachLessonDeck(t.ownerId, t.l1, t.d2))).toBe("lesson_has_deck");
    expect(await code(attachLessonDeck(t.ownerId, t.l2, t.d1))).toBe("deck_in_use");

    const r = await attachLessonDeck(t.ownerId, t.l1, t.d2, { replace: true });
    expect(r.replacedDeckId).toBe(t.d1);
    expect((await getLessonDeckForEditor(t.ownerId, t.l1)).attached?.id).toBe(t.d2);
    expect(await code(attachLessonDeck(t.ownerId, t.l2, t.d1))).toBe("ok"); // d1 đã được nhả
  });

  it("chỉ người sửa được khoá mới gắn; bài giảng phải của chủ khoá", async () => {
    const t = await setup("ld-authz");
    expect(await code(attachLessonDeck(t.otherId, t.l1, t.d1))).toBe("forbidden");
    expect(await code(getLessonDeckForEditor(t.otherId, t.l1))).toBe("forbidden");

    await addCoInstructorByEmail(t.ownerId, t.courseId, "x-ld-authz@e.com", "co-instructor", BASE);
    const mine = await createLiveDeck({ userId: t.otherId, title: "Của người cộng tác" }, prisma);
    expect(await code(attachLessonDeck(t.otherId, t.l1, mine.id))).toBe("deck_not_owned_by_course_owner");
    expect(await code(attachLessonDeck(t.otherId, t.l1, t.d1))).toBe("ok"); // người cộng tác chọn bài giảng của chủ khoá
    expect((await getLessonDeckForEditor(t.otherId, t.l1)).isOwner).toBe(false);
  });

  it("không tìm thấy bài học hoặc bài giảng", async () => {
    const t = await setup("ld-404");
    expect(await code(attachLessonDeck(t.ownerId, "00000000-0000-0000-0000-000000000000", t.d1))).toBe("not_found");
    expect(await code(attachLessonDeck(t.ownerId, t.l1, "00000000-0000-0000-0000-000000000000"))).toBe("not_found");
  });

  it("xoá bài giảng thì bài học tự về không có bài giảng", async () => {
    const t = await setup("ld-del");
    await attachLessonDeck(t.ownerId, t.l1, t.d1);
    await prisma.liveDeck.delete({ where: { id: t.d1 } });
    expect((await getLessonDeckForEditor(t.ownerId, t.l1)).attached).toBeNull();
    expect(await getLiveDeckByLesson(t.l1, prisma)).toBeNull();
  });
});
