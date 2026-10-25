import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { addCoInstructorByEmail } from "../../courses/instructors";
import { createLiveDeck } from "../decks";
import { attachLessonDeck, detachLessonDeck, ensureCourseDeckGroup, getLessonDeckForEditor, LessonDeckError } from "../lessonDeck";
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

  it("chủ khoá và đồng giảng viên đều dùng được, mỗi người chỉ gắn bài giảng của chính mình; người ngoài khoá bị từ chối", async () => {
    const t = await setup("ld-authz");
    // Người ngoài khoá.
    expect(await code(attachLessonDeck(t.otherId, t.l1, t.d1))).toBe("forbidden");
    expect(await code(getLessonDeckForEditor(t.otherId, t.l1))).toBe("forbidden");
    expect(await code(detachLessonDeck(t.otherId, t.l1))).toBe("forbidden");

    // Đồng giảng viên: dùng được, nhưng chỉ gắn bài giảng của chính họ.
    await addCoInstructorByEmail(t.ownerId, t.courseId, "x-ld-authz@e.com", "co-instructor", BASE);
    expect(await code(attachLessonDeck(t.otherId, t.l1, t.d1))).toBe("deck_not_yours"); // bài giảng của chủ khoá
    // Được chủ bài giảng thêm làm đồng giảng viên của bài giảng thì gắn được và mở được (dong-giang-vien-bai-giang.md).
    await prisma.liveDeckCollaborator.create({ data: { deckId: t.d2, userId: t.otherId, addedById: t.ownerId } });
    expect((await getLessonDeckForEditor(t.otherId, t.l1)).candidates.map((c) => c.id)).toEqual([t.d2]);
    expect(await code(attachLessonDeck(t.otherId, t.l2, t.d2))).toBe("ok");
    expect((await getLessonDeckForEditor(t.otherId, t.l2)).attached).toMatchObject({ id: t.d2, canOpen: true, ownerName: "Chủ khoá" });
    await detachLessonDeck(t.otherId, t.l2);
    const theirs = await createLiveDeck({ userId: t.otherId, title: "Của đồng giảng viên" }, prisma);
    expect(await code(attachLessonDeck(t.otherId, t.l1, theirs.id))).toBe("ok");
    const asCo = await getLessonDeckForEditor(t.otherId, t.l1);
    expect(asCo.attached).toMatchObject({ id: theirs.id, canOpen: true });
    expect(asCo.candidates.every((c) => c.canOpen)).toBe(true);

    // Chủ khoá thấy đó là bài giảng của người khác, không gắn được bài giảng đó cho bài khác và vẫn thay/gỡ được.
    const asOwner = await getLessonDeckForEditor(t.ownerId, t.l1);
    expect(asOwner.attached).toMatchObject({ id: theirs.id, canOpen: false, ownerName: "Người ngoài" });
    expect(asOwner.candidates.map((c) => c.id).sort()).toEqual([t.d1, t.d2].sort()); // chỉ bài giảng của chính chủ khoá
    expect(await code(attachLessonDeck(t.ownerId, t.l2, theirs.id))).toBe("deck_not_yours");
    expect(await code(attachLessonDeck(t.ownerId, t.l1, t.d1))).toBe("lesson_has_deck");
    expect((await attachLessonDeck(t.ownerId, t.l1, t.d1, { replace: true })).replacedDeckId).toBe(theirs.id);
    await detachLessonDeck(t.otherId, t.l1); // đồng giảng viên gỡ được bài giảng đang gắn
    expect((await getLessonDeckForEditor(t.ownerId, t.l1)).attached).toBeNull();
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

  it("bài giảng chưa có nhóm được đưa vào nhóm của khoá; nhóm đã liên kết với khoá thì dùng lại; nhóm tự xếp thì giữ nguyên", async () => {
    const t = await setup("ld-group");
    await attachLessonDeck(t.ownerId, t.l1, t.d1);
    const d1 = await prisma.liveDeck.findUniqueOrThrow({ where: { id: t.d1 }, include: { group: true } });
    expect(d1.group).toMatchObject({ name: "ld-group", kind: "course", courseId: t.courseId, userId: t.ownerId });

    // Bài giảng thứ hai vào cùng nhóm đó, không tạo nhóm mới.
    await attachLessonDeck(t.ownerId, t.l2, t.d2);
    const d2 = await prisma.liveDeck.findUniqueOrThrow({ where: { id: t.d2 } });
    expect(d2.groupId).toBe(d1.groupId);
    expect(await prisma.liveDeckGroup.count({ where: { userId: t.ownerId, courseId: t.courseId } })).toBe(1);

    // Bài giảng đã được xếp nhóm khác thì không bị chuyển.
    const mine = await prisma.liveDeckGroup.create({ data: { userId: t.ownerId, name: "Nhóm riêng", kind: "other" } });
    const d3 = await createLiveDeck({ userId: t.ownerId, title: "Bài giảng 3" }, prisma);
    await prisma.liveDeck.update({ where: { id: d3.id }, data: { groupId: mine.id } });
    await detachLessonDeck(t.ownerId, t.l2);
    await attachLessonDeck(t.ownerId, t.l2, d3.id);
    expect((await prisma.liveDeck.findUniqueOrThrow({ where: { id: d3.id } })).groupId).toBe(mine.id);
  });

  it("ensureCourseDeckGroup dùng nhóm chủ khoá đã liên kết với khoá", async () => {
    const t = await setup("ld-group2");
    const linked = await prisma.liveDeckGroup.create({ data: { userId: t.ownerId, courseId: t.courseId, name: "Tên tự đặt", kind: "course" } });
    expect(await ensureCourseDeckGroup(t.ownerId, t.courseId)).toBe(linked.id);
  });
});
