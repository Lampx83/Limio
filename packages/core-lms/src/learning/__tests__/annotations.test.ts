import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  AnnotationError,
  createAnnotation,
  createAnnotationReply,
  deleteAnnotation,
  deleteAnnotationReply,
  listLessonAnnotations,
  updateAnnotation,
} from "../annotations";
import { enrollInCourse } from "../enroll";
import { createCourse, publishCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createContentItem } from "../../courses/contents";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const reg = (tag: string, name: string) =>
    registerUser(
      { email: `${tag}-${slug}@e.com`, password: "password1234", displayName: name },
      BASE,
    );
  const owner = await reg("o", "Owner");
  const a = await reg("a", "Alice");
  const b = await reg("b", "Bob");
  const outsider = await reg("x", "Outsider");
  const c = await createCourse(owner.userId, { title: slug, description: "x", slug });
  const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(owner.userId, m.moduleId, { title: "L", orderIndex: 0 });
  const item = await createContentItem(owner.userId, l.lessonId, {
    type: "markdown",
    payload: { body: "Hello world, this is the lesson body." },
    orderIndex: 0,
  });
  await publishCourse(owner.userId, c.courseId);
  await enrollInCourse(a.userId, c.courseId);
  await enrollInCourse(b.userId, c.courseId);
  return {
    ownerId: owner.userId,
    aId: a.userId,
    bId: b.userId,
    outsiderId: outsider.userId,
    courseId: c.courseId,
    lessonId: l.lessonId,
    itemId: item.contentItemId,
  };
}

const range = { quote: "lesson body", prefix: "this is the ", suffix: ".", startOffset: 25, endOffset: 36 };

describe("lesson annotations", () => {
  it("AC2: mặc định riêng tư — người khác không thấy", async () => {
    const s = await setup("an1");
    await createAnnotation(s.aId, s.lessonId, {
      contentItemId: s.itemId,
      body: "Chỗ này chưa rõ",
      ...range,
    });
    expect(await listLessonAnnotations(s.aId, s.lessonId)).toHaveLength(1);
    expect(await listLessonAnnotations(s.bId, s.lessonId)).toHaveLength(0);
    expect(await listLessonAnnotations(s.ownerId, s.lessonId)).toHaveLength(0);
  });

  it("AC2: publish thì cả khoá thấy, thu hồi thì biến mất", async () => {
    const s = await setup("an2");
    const { annotationId } = await createAnnotation(s.aId, s.lessonId, {
      contentItemId: s.itemId,
      body: "Ghi chú",
      ...range,
    });
    await updateAnnotation(s.aId, annotationId, { published: true });
    const seen = await listLessonAnnotations(s.bId, s.lessonId);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.mine).toBe(false);
    expect(seen[0]?.author.displayName).toBe("Alice");
    // Không lộ id/email tác giả cho người khác.
    expect(JSON.stringify(seen[0])).not.toContain(s.aId);

    await updateAnnotation(s.aId, annotationId, { published: false });
    expect(await listLessonAnnotations(s.bId, s.lessonId)).toHaveLength(0);
  });

  it("AC2: người ngoài khoá không đọc, không tạo được", async () => {
    const s = await setup("an3");
    await expect(listLessonAnnotations(s.outsiderId, s.lessonId)).rejects.toMatchObject({
      code: "not_enrolled",
    });
    await expect(
      createAnnotation(s.outsiderId, s.lessonId, {
        contentItemId: s.itemId,
        body: "x",
        ...range,
      }),
    ).rejects.toBeInstanceOf(AnnotationError);
  });

  it("giảng viên (không ghi danh) tạo và đọc được annotation", async () => {
    const s = await setup("an4");
    await createAnnotation(s.ownerId, s.lessonId, {
      contentItemId: s.itemId,
      body: "Nhớ nhấn mạnh",
      ...range,
    });
    expect(await listLessonAnnotations(s.ownerId, s.lessonId)).toHaveLength(1);
  });

  it("từ chối khối nội dung không thuộc bài", async () => {
    const s = await setup("an5");
    await expect(
      createAnnotation(s.aId, s.lessonId, {
        contentItemId: "00000000-0000-4000-8000-000000000000",
        body: "x",
        ...range,
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("từ chối vùng rỗng / ghi chú rỗng", async () => {
    const s = await setup("an6");
    await expect(
      createAnnotation(s.aId, s.lessonId, {
        contentItemId: s.itemId,
        body: "x",
        ...range,
        endOffset: range.startOffset,
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      createAnnotation(s.aId, s.lessonId, {
        contentItemId: s.itemId,
        body: "   ",
        ...range,
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("AC3: reply chỉ có trên annotation đã publish", async () => {
    const s = await setup("an7");
    const { annotationId } = await createAnnotation(s.aId, s.lessonId, {
      contentItemId: s.itemId,
      body: "Ghi chú",
      ...range,
    });
    // Người khác: annotation riêng tư "không tồn tại".
    await expect(
      createAnnotationReply(s.bId, annotationId, { body: "hi" }),
    ).rejects.toMatchObject({ code: "annotation_not_found" });
    // Chính tác giả: được hướng dẫn publish trước.
    await expect(
      createAnnotationReply(s.aId, annotationId, { body: "hi" }),
    ).rejects.toMatchObject({ code: "not_published" });

    await updateAnnotation(s.aId, annotationId, { published: true });
    await createAnnotationReply(s.bId, annotationId, { body: "Mình cũng thắc mắc" });
    const list = await listLessonAnnotations(s.aId, s.lessonId);
    expect(list[0]?.replies).toHaveLength(1);
    expect(list[0]?.replies[0]?.author.displayName).toBe("Bob");

    // Thu hồi: reply ẩn theo, nhưng vẫn còn trong DB.
    await updateAnnotation(s.aId, annotationId, { published: false });
    expect((await listLessonAnnotations(s.aId, s.lessonId))[0]?.replies).toHaveLength(0);
    expect(await prisma.lessonAnnotationReply.count({ where: { annotationId } })).toBe(1);
  });

  it("AC3: người ngoài khoá không reply được annotation công khai", async () => {
    const s = await setup("an8");
    const { annotationId } = await createAnnotation(s.aId, s.lessonId, {
      contentItemId: s.itemId,
      body: "Ghi chú",
      published: true,
      ...range,
    });
    await expect(
      createAnnotationReply(s.outsiderId, annotationId, { body: "hi" }),
    ).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("AC4: chỉ tác giả sửa; người khác thấy như không tồn tại", async () => {
    const s = await setup("an9");
    const { annotationId } = await createAnnotation(s.aId, s.lessonId, {
      contentItemId: s.itemId,
      body: "Ghi chú",
      published: true,
      ...range,
    });
    await expect(
      updateAnnotation(s.bId, annotationId, { body: "hack" }),
    ).rejects.toMatchObject({ code: "annotation_not_found" });
    await updateAnnotation(s.aId, annotationId, { body: "Đã sửa" });
    expect((await listLessonAnnotations(s.aId, s.lessonId))[0]?.body).toBe("Đã sửa");
  });

  it("AC4: học viên không xoá được annotation của bạn; giảng viên gỡ được bản công khai", async () => {
    const s = await setup("an10");
    const pub = await createAnnotation(s.aId, s.lessonId, {
      contentItemId: s.itemId,
      body: "Công khai",
      published: true,
      ...range,
    });
    const priv = await createAnnotation(s.aId, s.lessonId, {
      contentItemId: s.itemId,
      body: "Riêng tư",
      ...range,
    });
    await expect(deleteAnnotation(s.bId, pub.annotationId)).rejects.toMatchObject({
      code: "annotation_not_found",
    });
    // Giảng viên không đụng được annotation riêng tư của học viên.
    await expect(deleteAnnotation(s.ownerId, priv.annotationId)).rejects.toMatchObject({
      code: "annotation_not_found",
    });
    await deleteAnnotation(s.ownerId, pub.annotationId);
    expect(await prisma.lessonAnnotation.count({ where: { id: pub.annotationId } })).toBe(0);
    expect(await prisma.lessonAnnotation.count({ where: { id: priv.annotationId } })).toBe(1);
  });

  it("AC4: xoá reply — tác giả reply và giảng viên được, người khác không", async () => {
    const s = await setup("an11");
    const { annotationId } = await createAnnotation(s.aId, s.lessonId, {
      contentItemId: s.itemId,
      body: "Ghi chú",
      published: true,
      ...range,
    });
    const r1 = await createAnnotationReply(s.bId, annotationId, { body: "một" });
    const r2 = await createAnnotationReply(s.bId, annotationId, { body: "hai" });
    // Tác giả annotation không xoá được reply của người khác.
    await expect(deleteAnnotationReply(s.aId, r1.replyId)).rejects.toMatchObject({
      code: "reply_not_found",
    });
    await deleteAnnotationReply(s.bId, r1.replyId);
    await deleteAnnotationReply(s.ownerId, r2.replyId);
    expect(await prisma.lessonAnnotationReply.count({ where: { annotationId } })).toBe(0);
  });

  it("AC5: mỗi thay đổi phát LearningEvent, không mang chữ của annotation", async () => {
    const s = await setup("an12");
    const { annotationId } = await createAnnotation(s.aId, s.lessonId, {
      contentItemId: s.itemId,
      body: "BÍ-MẬT-12345",
      ...range,
    });
    await updateAnnotation(s.aId, annotationId, { published: true });
    const { replyId } = await createAnnotationReply(s.bId, annotationId, {
      body: "BÍ-MẬT-67890",
    });
    await deleteAnnotationReply(s.bId, replyId);
    await deleteAnnotation(s.aId, annotationId);

    const events = await prisma.learningEvent.findMany({
      where: { courseId: s.courseId, eventType: { startsWith: "lesson.annotation." } },
      orderBy: { id: "asc" },
    });
    expect(events.map((e) => e.eventType)).toEqual([
      "lesson.annotation.created",
      "lesson.annotation.published",
      "lesson.annotation.replied",
      "lesson.annotation.removed",
      "lesson.annotation.removed",
    ]);
    const blob = JSON.stringify(events.map((e) => e.payload));
    expect(blob).not.toContain("BÍ-MẬT");
  });

  it("không cho ghi chú lên ghi chú giảng viên / khối ẩn, và ẩn annotation khi khối bị ẩn", async () => {
    const s = await setup("an13");
    const note = await prisma.contentItem.create({
      data: {
        lessonId: s.lessonId,
        type: "teacher_note",
        payload: { body: "Chỉ giảng viên đọc" },
        orderIndex: 1,
      },
    });
    await expect(
      createAnnotation(s.ownerId, s.lessonId, {
        contentItemId: note.id,
        body: "x",
        ...range,
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });

    await createAnnotation(s.aId, s.lessonId, {
      contentItemId: s.itemId,
      body: "Công khai",
      published: true,
      ...range,
    });
    expect(await listLessonAnnotations(s.bId, s.lessonId)).toHaveLength(1);
    await prisma.contentItem.update({ where: { id: s.itemId }, data: { isHidden: true } });
    expect(await listLessonAnnotations(s.bId, s.lessonId)).toHaveLength(0);
  });

  it("bài khoá/ẩn: học viên không đọc được annotation, giảng viên vẫn đọc", async () => {
    const s = await setup("an14");
    await createAnnotation(s.aId, s.lessonId, {
      contentItemId: s.itemId,
      body: "Công khai",
      published: true,
      ...range,
    });
    await prisma.lesson.update({ where: { id: s.lessonId }, data: { isLocked: true } });
    await expect(listLessonAnnotations(s.bId, s.lessonId)).rejects.toMatchObject({
      code: "lesson_not_found",
    });
    expect(await listLessonAnnotations(s.ownerId, s.lessonId)).toHaveLength(1);
  });
});
