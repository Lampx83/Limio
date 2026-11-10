import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createContentItem } from "../../courses/contents";
import { getOwnedPracticeExamId } from "../../courses/practiceBlock";
import { createAudioAsset, createExam, createImageAsset } from "../";

/**
 * Tải ảnh/audio của Đoạn văn: đề thường chỉ khi còn nháp; đề ẩn của khối Bài luyện (luôn `published`) vẫn tải được khi chưa lưu trữ.
 * Lỗi thực tế: "Upload lỗi: exam_not_draft" khi tải audio vào Đoạn văn của Bài luyện.
 */

const BASE = "http://localhost:3000";
const image = { s3Key: "exam-assets/x.png", mimeType: "image/png", sizeBytes: 1000, altText: "Ảnh" };
const audio = { s3Key: "exam-assets/x.mp3", mimeType: "audio/mpeg", sizeBytes: 1000, altText: "Nghe" };

async function setup(tag: string) {
  const owner = (await registerUser({ email: `ap-o-${tag}@e.com`, password: "password1234", displayName: "O" }, BASE)).userId;
  const c = await createCourse(owner, { title: `C ${tag}`, description: "x", slug: `ap-${tag}` });
  const m = await createModule(owner, c.courseId, { title: "U1", orderIndex: 0 });
  const l = await createLesson(owner, m.moduleId, { title: "Bài 1", orderIndex: 0 });
  return { owner, courseId: c.courseId, lessonId: l.lessonId };
}

async function practiceExam(s: { owner: string; lessonId: string }) {
  const { contentItemId } = await createContentItem(s.owner, s.lessonId, { type: "exam_practice", payload: {}, orderIndex: 0 });
  return (await getOwnedPracticeExamId(contentItemId))!;
}

describe("tải ảnh và audio cho Đoạn văn", () => {
  it("đề ẩn của Bài luyện (đã xuất bản) tải được ảnh và audio", async () => {
    const s = await setup("practice");
    const examId = await practiceExam(s);
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: examId } })).status).toBe("published");
    await expect(createImageAsset(s.owner, examId, image)).resolves.toHaveProperty("assetId");
    await expect(createAudioAsset(s.owner, examId, audio)).resolves.toHaveProperty("assetId");
  });

  it("đề ẩn của Bài luyện đã lưu trữ thì vẫn chặn (exam_not_draft)", async () => {
    const s = await setup("archived");
    const examId = await practiceExam(s);
    await prisma.exam.update({ where: { id: examId }, data: { status: "archived" } });
    await expect(createImageAsset(s.owner, examId, image)).rejects.toMatchObject({ code: "exam_not_draft" });
    await expect(createAudioAsset(s.owner, examId, audio)).rejects.toMatchObject({ code: "exam_not_draft" });
  });

  it("đề thường: nháp tải được, đã xuất bản thì chặn (giữ nguyên quy tắc cũ)", async () => {
    const s = await setup("regular");
    const { examId } = await createExam(s.owner, s.courseId, { title: "Đề thường", durationMin: 10 });
    await expect(createImageAsset(s.owner, examId, image)).resolves.toHaveProperty("assetId");
    await prisma.exam.update({ where: { id: examId }, data: { status: "published" } });
    await expect(createImageAsset(s.owner, examId, image)).rejects.toMatchObject({ code: "exam_not_draft" });
    await expect(createAudioAsset(s.owner, examId, audio)).rejects.toMatchObject({ code: "exam_not_draft" });
  });

  it("người không sửa được khoá vẫn bị từ chối với đề ẩn của Bài luyện", async () => {
    const s = await setup("stranger");
    const examId = await practiceExam(s);
    const stranger = (await registerUser({ email: "ap-x-stranger@e.com", password: "password1234", displayName: "X" }, BASE)).userId;
    await expect(createImageAsset(stranger, examId, image)).rejects.toBeTruthy();
  });
});
