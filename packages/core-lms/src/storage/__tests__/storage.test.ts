import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  attributeStoredFiles,
  classifyStorageKey,
  getStorageUsageReport,
  getUserStorageUsageBytes,
  markStoredFileDeleted,
  recordStoredFile,
  resolveCourseOwner,
  uploaderFromStorageKey,
} from "../index";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createAssignment, submitAssignment } from "../../courses/assignments";
import { enrollInCourse } from "../../learning/enroll";

const BASE = "http://localhost:3000";
const uid = "11111111-2222-4333-8444-555555555555";

async function user(name: string) {
  return registerUser(
    { email: `u-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: name },
    BASE,
  );
}

describe("classifyStorageKey / uploaderFromStorageKey (thuần, không cần DB)", () => {
  it("phân loại theo tiền tố key", () => {
    expect(classifyStorageKey("public", "lesson-media/videos/2026/09/x.mp4")).toBe("lesson_video");
    expect(classifyStorageKey("public", "lesson-media/pdfs/2026/09/x.pdf")).toBe("lesson_pdf");
    expect(classifyStorageKey("private", "submissions/2026/09/x.zip")).toBe("submission");
    expect(classifyStorageKey("public", `avatars/${uid}/a.png`)).toBe("avatar");
    expect(classifyStorageKey("private", "proctor-snapshots/2026/09/x.jpg")).toBe("proctor_snapshot");
    expect(classifyStorageKey("public", "something/else.bin")).toBe("other");
    // tmp là layer, không phải tiền tố: mọi thứ trong tmp đều là tmp.
    expect(classifyStorageKey("tmp", "2026-09-29/s/lesson-media/videos/x.mp4")).toBe("tmp");
  });

  it("suy người upload từ tên file và thư mục avatar; không đoán bừa", () => {
    expect(uploaderFromStorageKey(`lesson-media/videos/2026/09/${uid}-1790000000000-ab12cd.mp4`)).toBe(uid);
    expect(uploaderFromStorageKey(`avatars/${uid}/whatever.png`)).toBe(uid);
    expect(uploaderFromStorageKey("lesson-media/videos/2026/09/random-name.mp4")).toBeNull();
    // Khớp UUID chặt: chuỗi giống-mà-không-phải-UUID không được nhận.
    expect(uploaderFromStorageKey("x/not-a-uuid-1790000000000-ab.mp4")).toBeNull();
  });
});

describe("sổ ghi dung lượng (cần DB)", () => {
  it("ghi mới → tính cho người upload; ghi đè cập nhật dung lượng; xoá rồi ghi lại thì hồi sinh", async () => {
    const u = await user("Up");
    const key = `lesson-media/videos/2026/09/${u.userId}-1790000000000-aa11.mp4`;

    await recordStoredFile({ layer: "public", key, sizeBytes: 1000, contentType: "video/mp4" });
    expect(await getUserStorageUsageBytes(u.userId)).toBe(1000);

    await recordStoredFile({ layer: "public", key, sizeBytes: 4000 });
    expect(await getUserStorageUsageBytes(u.userId)).toBe(4000);
    expect(await prisma.storedFile.count({ where: { key } })).toBe(1);

    await markStoredFileDeleted("public", key);
    expect(await getUserStorageUsageBytes(u.userId)).toBe(0);

    await recordStoredFile({ layer: "public", key, sizeBytes: 500 });
    expect(await getUserStorageUsageBytes(u.userId)).toBe(500);
  });

  it("file không suy được người upload thì chưa gán cho ai, và hiện ở mục 'chưa gán'", async () => {
    await recordStoredFile({ layer: "public", key: "exam-assets/2026/09/anon.png", sizeBytes: 300 });
    const r = await getStorageUsageReport();
    expect(r.unattributed).toEqual({ files: 1, bytes: 300 });
  });

  it("file có dung lượng lớn hơn 2 GB không tràn", async () => {
    const u = await user("Big");
    const key = `lesson-media/videos/2026/09/${u.userId}-1790000000001-bb22.mp4`;
    await recordStoredFile({ layer: "public", key, sizeBytes: 3 * 1024 ** 3 });
    expect(await getUserStorageUsageBytes(u.userId)).toBe(3 * 1024 ** 3);
  });

  it("resolveCourseOwner trả đúng chủ khoá, không phải đồng giảng", async () => {
    const owner = await user("Owner");
    const co = await user("Co");
    const c = await createCourse(owner.userId, { title: "K", description: "x" });
    await prisma.courseInstructor.create({ data: { courseId: c.courseId, userId: co.userId, role: "co-instructor" } });
    expect(await resolveCourseOwner(c.courseId)).toBe(owner.userId);
  });

  it("D1: đồng giảng upload video vào bài → dung lượng tính cho CHỦ KHOÁ sau khi gán theo tham chiếu", async () => {
    const owner = await user("Owner");
    const co = await user("Co");
    const c = await createCourse(owner.userId, { title: "K", description: "x" });
    await prisma.courseInstructor.create({ data: { courseId: c.courseId, userId: co.userId, role: "co-instructor" } });
    const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
    const l = await createLesson(owner.userId, m.moduleId, { title: "L", orderIndex: 0 });

    const filename = `${co.userId}-1790000000002-cc33.mp4`;
    const key = `lesson-media/videos/2026/09/${filename}`;
    await recordStoredFile({ layer: "public", key, sizeBytes: 2000 });
    // Trước khi có bài học tham chiếu: tạm tính cho người upload (đồng giảng).
    expect(await getUserStorageUsageBytes(co.userId)).toBe(2000);

    await prisma.contentItem.create({
      data: { lessonId: l.lessonId, type: "video", orderIndex: 0, payload: { url: `/api/lesson-media/videos/${filename}` } },
    });
    const res = await attributeStoredFiles();
    expect(res.attributed).toBeGreaterThanOrEqual(1);

    expect(await getUserStorageUsageBytes(co.userId)).toBe(0);
    expect(await getUserStorageUsageBytes(owner.userId)).toBe(2000);
    const row = await prisma.storedFile.findUniqueOrThrow({ where: { layer_key: { layer: "public", key } } });
    expect(row.courseId).toBe(c.courseId);
    expect(row.attribution).toBe("reference:content_item");
  });

  it("D1: bài nộp của học viên tính cho chủ khoá, không phải học viên", async () => {
    const owner = await user("Owner");
    const learner = await user("Learner");
    const c = await createCourse(owner.userId, { title: "K", description: "x" });
    const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
    const l = await createLesson(owner.userId, m.moduleId, { title: "L", orderIndex: 0 });
    await prisma.course.update({ where: { id: c.courseId }, data: { status: "published" } });
    await enrollInCourse(learner.userId, c.courseId);
    const a = await createAssignment(owner.userId, l.lessonId, { title: "A", description: "x", maxScore: 10 });

    const filename = `${learner.userId}-1790000000003-dd44.zip`;
    await recordStoredFile({ layer: "private", key: `submissions/2026/09/${filename}`, sizeBytes: 9000 });
    await submitAssignment(learner.userId, a.assignmentId, { body: "b", attachmentUrl: `${BASE}/api/submissions/files/${filename}` });

    await attributeStoredFiles();
    expect(await getUserStorageUsageBytes(learner.userId)).toBe(0);
    expect(await getUserStorageUsageBytes(owner.userId)).toBe(9000);
  });

  it("gán theo tham chiếu chạy lại được (idempotent) và file chưa ai tham chiếu vẫn tính cho người upload", async () => {
    const u = await user("Orphan");
    const key = `lesson-media/images/2026/09/${u.userId}-1790000000004-ee55.png`;
    await recordStoredFile({ layer: "public", key, sizeBytes: 700 });
    const r1 = await attributeStoredFiles();
    const r2 = await attributeStoredFiles();
    expect(r1.unreferenced).toBeGreaterThanOrEqual(1);
    expect(r2.attributed).toBe(0);
    expect(await getUserStorageUsageBytes(u.userId)).toBe(700);
  });

  it("báo cáo: tổng theo loại và top người dùng, không tính file đã xoá", async () => {
    const a = await user("Alpha");
    const b = await user("Beta");
    await recordStoredFile({ layer: "public", key: `lesson-media/pdfs/2026/09/${a.userId}-1790000000005-f1.pdf`, sizeBytes: 5000 });
    await recordStoredFile({ layer: "public", key: `lesson-media/pdfs/2026/09/${b.userId}-1790000000006-f2.pdf`, sizeBytes: 100 });
    const gone = `lesson-media/pdfs/2026/09/${b.userId}-1790000000007-f3.pdf`;
    await recordStoredFile({ layer: "public", key: gone, sizeBytes: 99999 });
    await markStoredFileDeleted("public", gone);

    const r = await getStorageUsageReport({ topN: 5 });
    expect(r.byKind.find((k) => k.kind === "lesson_pdf")).toMatchObject({ files: 2, bytes: 5100 });
    expect(r.topUsers[0]).toMatchObject({ userId: a.userId, bytes: 5000, displayName: "Alpha" });
    expect(r.totalBytes).toBe(5100);
  });
});
