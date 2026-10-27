import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { recordPdfOpenedExternal } from "../pdfExternal";
import { LearningError } from "../lessons";
import { enrollInCourse } from "../enroll";
import { createCourse, publishCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createContentItem } from "../../courses/contents";
import { registerUser } from "../../auth/register";

/** docs/tieu-chi/doc-pdf-theo-trang.md — AC6: ghi việc mở PDF ở tab mới. */

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `po-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const learner = await registerUser(
    { email: `pl-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  const outsider = await registerUser(
    { email: `px-${slug}@e.com`, password: "password1234", displayName: "X" },
    BASE,
  );
  const c = await createCourse(owner.userId, { title: slug, description: "x", slug: `pdfx-${slug}` });
  const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(owner.userId, m.moduleId, { title: "L", orderIndex: 0 });
  const pdf = await createContentItem(owner.userId, l.lessonId, {
    type: "pdf",
    payload: { url: "https://example.com/a.pdf", title: "Tài liệu bí mật.pdf" },
    orderIndex: 0,
  });
  const video = await createContentItem(owner.userId, l.lessonId, {
    type: "video",
    payload: { url: "https://example.com/v.mp4", durationSec: 60 },
    orderIndex: 1,
  });
  await publishCourse(owner.userId, c.courseId);
  await enrollInCourse(learner.userId, c.courseId);
  return {
    learnerId: learner.userId,
    outsiderId: outsider.userId,
    lessonId: l.lessonId,
    courseId: c.courseId,
    pdfId: pdf.contentItemId,
    videoId: video.contentItemId,
  };
}

const events = (userId: string) =>
  prisma.learningEvent.findMany({
    where: { userId, eventType: LearningEventType.LessonPdfOpenedExternal },
  });

describe("recordPdfOpenedExternal", () => {
  it("ghi một event chỉ mang id, gắn courseId", async () => {
    const s = await setup("x1");
    await recordPdfOpenedExternal(s.learnerId, s.lessonId, s.pdfId);
    const rows = await events(s.learnerId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toEqual({ lessonId: s.lessonId, contentItemId: s.pdfId });
    expect(rows[0]!.courseId).toBe(s.courseId);
    // Không mang tiêu đề hay địa chỉ PDF.
    expect(JSON.stringify(rows[0]!.payload)).not.toContain("bí mật");
    expect(JSON.stringify(rows[0]!.payload)).not.toContain("example.com");
  });

  it("mỗi lần bấm một event, không chống trùng", async () => {
    const s = await setup("x2");
    await recordPdfOpenedExternal(s.learnerId, s.lessonId, s.pdfId);
    await recordPdfOpenedExternal(s.learnerId, s.lessonId, s.pdfId);
    expect(await events(s.learnerId)).toHaveLength(2);
  });

  it("người chưa ghi danh bị từ chối, không ghi gì", async () => {
    const s = await setup("x3");
    await expect(recordPdfOpenedExternal(s.outsiderId, s.lessonId, s.pdfId)).rejects.toMatchObject({
      code: "not_enrolled",
    });
    expect(await events(s.outsiderId)).toHaveLength(0);
  });

  it("khối không phải PDF, khối của bài khác, id bịa đều bị từ chối", async () => {
    const a = await setup("x4a");
    const b = await setup("x4b");
    for (const id of [a.videoId, b.pdfId, "00000000-0000-4000-8000-000000000000"]) {
      await expect(recordPdfOpenedExternal(a.learnerId, a.lessonId, id)).rejects.toMatchObject({
        code: "content_not_found",
      });
    }
    expect(await events(a.learnerId)).toHaveLength(0);
  });

  it("bài không tồn tại -> lesson_not_found; thiếu contentItemId -> validation_failed", async () => {
    const s = await setup("x5");
    await expect(
      recordPdfOpenedExternal(s.learnerId, "00000000-0000-4000-8000-000000000000", s.pdfId),
    ).rejects.toMatchObject({ code: "lesson_not_found" });
    await expect(recordPdfOpenedExternal(s.learnerId, s.lessonId, "")).rejects.toThrow(LearningError);
  });
});
