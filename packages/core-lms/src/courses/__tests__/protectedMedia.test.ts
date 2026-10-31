import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { createCourse, publishCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createContentItem, updateContentItem } from "../contents";
import { addCoInstructorByEmail } from "../instructors";
import { CourseAuthzError } from "../authz";
import {
  canAccessProtectedMedia,
  extractLessonMediaFilenames,
  findProtectingCourseIds,
  registerLessonMedia,
  setCourseProtectedMedia,
  syncProtectedMediaForCourse,
} from "../protectedMedia";

const BASE = "http://localhost:3000";
const PDF = "u1-1790000000000-aaaa1111bbbb2222.pdf";
const IMG = "u1-1790000000001-cccc3333dddd4444.png";
const VID = "u1-1790000000002-eeee5555ffff6666.mp4";

async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

/** Khoá có 1 module, bài thường + (tuỳ chọn) bài xem thử; mỗi bài một khối văn bản mang URL file. */
async function makeCourse(ownerId: string, slug: string) {
  const { courseId } = await createCourse(ownerId, { title: `t ${slug}`, description: "d", slug });
  const { moduleId } = await createModule(ownerId, courseId, { title: "M", orderIndex: 0 });
  return { courseId, moduleId };
}

async function addLessonWith(ownerId: string, moduleId: string, html: string, opts: { previewable?: boolean; index?: number } = {}) {
  const { lessonId } = await createLesson(ownerId, moduleId, { title: "L", orderIndex: opts.index ?? 0 });
  if (opts.previewable) await prisma.lesson.update({ where: { id: lessonId }, data: { previewable: true } });
  // Ghi thẳng DB: ở đây cần nội dung có sẵn TRƯỚC khi bật cờ, không đi qua hook của createContentItem.
  await prisma.contentItem.create({ data: { lessonId, type: "richtext", payload: { html }, orderIndex: 0 } });
  return lessonId;
}

const imgTag = (f: string) => `<p><img src="/api/lesson-media/images/${f}" /></p>`;

describe("extractLessonMediaFilenames", () => {
  it("lấy tên file ở mọi loại học liệu, trong chuỗi lồng nhau, mỗi file một lần", () => {
    const names = extractLessonMediaFilenames({
      url: `/api/lesson-media/pdfs/${PDF}`,
      html: `${imgTag(IMG)}${imgTag(IMG)}`,
      nested: [{ v: `/api/lesson-media/videos/${VID}` }],
      other: "/api/lesson-media/audio/a-1790000000003-0123456789abcdef.mp3",
      transcript: "/api/lesson-media/transcripts/t-1790000000004-0123456789abcdef.vtt",
      file: "/api/lesson-media/files/f-1790000000005-0123456789abcdef.xlsx",
      page: "/api/lesson-media/html/h-1790000000006-0123456789abcdef.html",
    });
    expect(names.sort()).toEqual(
      [
        PDF,
        IMG,
        VID,
        "a-1790000000003-0123456789abcdef.mp3",
        "t-1790000000004-0123456789abcdef.vtt",
        "f-1790000000005-0123456789abcdef.xlsx",
        "h-1790000000006-0123456789abcdef.html",
      ].sort(),
    );
  });

  it("có tiền tố đường dẫn gốc (basePath) vẫn nhận; URL ngoài và avatar thì không", () => {
    expect(extractLessonMediaFilenames(`/limio/api/lesson-media/pdfs/${PDF}`)).toEqual([PDF]);
    expect(extractLessonMediaFilenames("https://cdn.example.com/a.pdf /api/avatars/x.png /uploads/a.pdf")).toEqual([]);
  });

  it("dấu chấm cuối câu không dính vào tên file; giá trị không phải chuỗi/đối tượng bị bỏ qua", () => {
    expect(extractLessonMediaFilenames(`Xem /api/lesson-media/pdfs/${PDF}.`)).toEqual([PDF]);
    expect(extractLessonMediaFilenames(null)).toEqual([]);
    expect(extractLessonMediaFilenames(42)).toEqual([]);
  });
});

describe("setCourseProtectedMedia — bật / tắt", () => {
  it("bật: quét file của bài thường, bỏ qua bài xem thử; ghi audit và sự kiện không tính là hoạt động học", async () => {
    const owner = await makeUser("pm-owner1@e.com");
    const { courseId, moduleId } = await makeCourse(owner, "pm-1");
    await addLessonWith(owner, moduleId, imgTag(IMG), { index: 0 });
    await addLessonWith(owner, moduleId, `<a href="/api/lesson-media/pdfs/${PDF}">p</a>`, { index: 1, previewable: true });

    const r = await setCourseProtectedMedia(owner, courseId, true);
    expect(r).toEqual({ enabled: true, files: 1 });
    expect((await prisma.course.findUniqueOrThrow({ where: { id: courseId } })).protectedMedia).toBe(true);
    expect(await findProtectingCourseIds(IMG)).toEqual([courseId]);
    expect(await findProtectingCourseIds(PDF)).toEqual([]); // bài xem thử không bị bảo vệ

    const ev = await prisma.learningEvent.findFirst({ where: { eventType: LearningEventType.CourseProtectedMediaEnabled, courseId } });
    expect(ev?.userId).toBe(owner);
    expect(ev?.payload).toEqual({ courseId, files: 1 }); // chỉ id và số file
    expect(await prisma.auditLog.count({ where: { action: LearningEventType.CourseProtectedMediaEnabled, actorUserId: owner } })).toBe(1);
  });

  it("bật lại khi cờ không đổi: quét lại nhưng không ghi sự kiện thứ hai", async () => {
    const owner = await makeUser("pm-owner2@e.com");
    const { courseId, moduleId } = await makeCourse(owner, "pm-2");
    await addLessonWith(owner, moduleId, imgTag(IMG));
    await setCourseProtectedMedia(owner, courseId, true);
    await setCourseProtectedMedia(owner, courseId, true);
    expect(await prisma.protectedMediaFile.count({ where: { courseId } })).toBe(1);
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.CourseProtectedMediaEnabled, courseId } })).toBe(1);
  });

  it("tắt: nhả hết file về công khai", async () => {
    const owner = await makeUser("pm-owner3@e.com");
    const { courseId, moduleId } = await makeCourse(owner, "pm-3");
    await addLessonWith(owner, moduleId, imgTag(IMG));
    await setCourseProtectedMedia(owner, courseId, true);
    const r = await setCourseProtectedMedia(owner, courseId, false);
    expect(r).toEqual({ enabled: false, files: 0 });
    expect(await findProtectingCourseIds(IMG)).toEqual([]);
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.CourseProtectedMediaDisabled, courseId } })).toBe(1);
  });

  it("chỉ chủ khoá và admin: đồng giảng viên và người lạ bị từ chối, khoá không tồn tại → not_found", async () => {
    const owner = await makeUser("pm-owner4@e.com");
    const co = await makeUser("pm-co4@e.com");
    const stranger = await makeUser("pm-stranger4@e.com");
    const { courseId } = await makeCourse(owner, "pm-4");
    await addCoInstructorByEmail(owner, courseId, "pm-co4@e.com", "co-instructor", BASE);

    for (const who of [co, stranger]) {
      await expect(setCourseProtectedMedia(who, courseId, true)).rejects.toMatchObject({ code: "forbidden" });
    }
    await expect(setCourseProtectedMedia(owner, "00000000-0000-4000-8000-000000000000", true)).rejects.toBeInstanceOf(CourseAuthzError);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: courseId } })).protectedMedia).toBe(false);
  });

  it("file nằm ở hai khoá: bảo vệ nếu bất kỳ khoá nào bật cờ; tắt khoá này thì khoá kia vẫn giữ", async () => {
    const owner = await makeUser("pm-owner5@e.com");
    const a = await makeCourse(owner, "pm-5a");
    const b = await makeCourse(owner, "pm-5b");
    await addLessonWith(owner, a.moduleId, imgTag(IMG));
    await addLessonWith(owner, b.moduleId, imgTag(IMG));
    await setCourseProtectedMedia(owner, a.courseId, true);
    expect(await findProtectingCourseIds(IMG)).toEqual([a.courseId]);
    await setCourseProtectedMedia(owner, b.courseId, true);
    expect((await findProtectingCourseIds(IMG)).sort()).toEqual([a.courseId, b.courseId].sort());
    await setCourseProtectedMedia(owner, a.courseId, false);
    expect(await findProtectingCourseIds(IMG)).toEqual([b.courseId]);
  });
});

describe("syncProtectedMediaForCourse / registerLessonMedia", () => {
  it("quét lại bỏ file đã gỡ khỏi bài, giữ file còn dùng", async () => {
    const owner = await makeUser("pm-sync1@e.com");
    const { courseId, moduleId } = await makeCourse(owner, "pm-s1");
    const lessonId = await addLessonWith(owner, moduleId, `${imgTag(IMG)}<a href="/api/lesson-media/pdfs/${PDF}">p</a>`);
    await setCourseProtectedMedia(owner, courseId, true);
    expect(await prisma.protectedMediaFile.count({ where: { courseId } })).toBe(2);

    await prisma.contentItem.updateMany({ where: { lessonId }, data: { payload: { html: imgTag(IMG) } } });
    expect(await syncProtectedMediaForCourse(courseId)).toBe(1);
    expect(await findProtectingCourseIds(PDF)).toEqual([]);
    expect(await findProtectingCourseIds(IMG)).toEqual([courseId]);
  });

  it("lưu khối nội dung mới trong khoá bản quyền → file vào bảng ngay (createContentItem và updateContentItem)", async () => {
    const owner = await makeUser("pm-reg1@e.com");
    const { courseId, moduleId } = await makeCourse(owner, "pm-r1");
    const { lessonId } = await createLesson(owner, moduleId, { title: "L", orderIndex: 0 });
    await setCourseProtectedMedia(owner, courseId, true);
    expect(await prisma.protectedMediaFile.count({ where: { courseId } })).toBe(0);

    const { contentItemId } = await createContentItem(owner, lessonId, { type: "richtext", payload: { html: imgTag(IMG) }, orderIndex: 0 });
    expect(await findProtectingCourseIds(IMG)).toEqual([courseId]);

    await updateContentItem(owner, contentItemId, { payload: { html: imgTag(IMG) + imgTag("u1-1790000000009-9999aaaa8888bbbb.png") } });
    expect(await findProtectingCourseIds("u1-1790000000009-9999aaaa8888bbbb.png")).toEqual([courseId]);
  });

  it("registerLessonMedia: khoá không bật cờ → không ghi gì; bài xem thử → không ghi gì; chạy lại không sinh trùng", async () => {
    const owner = await makeUser("pm-reg2@e.com");
    const plain = await makeCourse(owner, "pm-r2a");
    const lessonPlain = await addLessonWith(owner, plain.moduleId, imgTag(IMG));
    expect(await registerLessonMedia(lessonPlain)).toBe(0);
    expect(await prisma.protectedMediaFile.count({ where: { courseId: plain.courseId } })).toBe(0);

    const prot = await makeCourse(owner, "pm-r2b");
    await prisma.course.update({ where: { id: prot.courseId }, data: { protectedMedia: true } });
    const lessonPrev = await addLessonWith(owner, prot.moduleId, imgTag(IMG), { previewable: true });
    expect(await registerLessonMedia(lessonPrev)).toBe(0);

    const lessonNormal = await addLessonWith(owner, prot.moduleId, imgTag(IMG), { index: 1 });
    expect(await registerLessonMedia(lessonNormal)).toBe(1);
    expect(await registerLessonMedia(lessonNormal)).toBe(0);
    expect(await prisma.protectedMediaFile.count({ where: { courseId: prot.courseId } })).toBe(1);
  });

  it("registerLessonMedia không ném lỗi với bài không tồn tại", async () => {
    await expect(registerLessonMedia("00000000-0000-4000-8000-000000000000")).resolves.toBe(0);
  });
});

describe("canAccessProtectedMedia — ai được xem", () => {
  async function protectedCourse(slug: string, ownerEmail: string) {
    const owner = await makeUser(ownerEmail);
    const c = await makeCourse(owner, slug);
    await addLessonWith(owner, c.moduleId, imgTag(IMG));
    await publishCourse(owner, c.courseId).catch(() => undefined);
    await prisma.course.update({ where: { id: c.courseId }, data: { status: "published" } });
    await setCourseProtectedMedia(owner, c.courseId, true);
    return { owner, ...c };
  }

  it("ẩn danh và người chưa ghi danh bị chặn; học viên đã ghi danh, chủ khoá và trợ giảng được xem", async () => {
    const { owner, courseId } = await protectedCourse("pm-a1", "pm-a1-owner@e.com");
    const learner = await makeUser("pm-a1-learner@e.com");
    const stranger = await makeUser("pm-a1-stranger@e.com");
    const ta = await makeUser("pm-a1-ta@e.com");
    await addCoInstructorByEmail(owner, courseId, "pm-a1-ta@e.com", "teaching-assistant", BASE);
    await enrollInCourse(learner, courseId);

    expect(await canAccessProtectedMedia(null, [courseId])).toBe(false);
    expect(await canAccessProtectedMedia(stranger, [courseId])).toBe(false);
    expect(await canAccessProtectedMedia(learner, [courseId])).toBe(true);
    expect(await canAccessProtectedMedia(owner, [courseId])).toBe(true);
    expect(await canAccessProtectedMedia(ta, [courseId])).toBe(true);
  });

  it("ghi danh hết hạn / đã hoàn tiền / đã bỏ → bị chặn ngay, không đợi liên kết hết hạn", async () => {
    const { courseId } = await protectedCourse("pm-a2", "pm-a2-owner@e.com");
    const learner = await makeUser("pm-a2-learner@e.com");
    await enrollInCourse(learner, courseId);
    expect(await canAccessProtectedMedia(learner, [courseId])).toBe(true);

    for (const status of ["refunded", "dropped", "expired"] as const) {
      await prisma.enrollment.updateMany({ where: { userId: learner, courseId }, data: { status, accessExpiresAt: null } });
      expect(await canAccessProtectedMedia(learner, [courseId])).toBe(false);
    }
    await prisma.enrollment.updateMany({ where: { userId: learner, courseId }, data: { status: "active", accessExpiresAt: new Date(Date.now() - 1000) } });
    expect(await canAccessProtectedMedia(learner, [courseId])).toBe(false);
  });

  it("khoá đã mở công khai và đang xuất bản → ai cũng xem được (theo đúng cổng của trang bài)", async () => {
    const { courseId } = await protectedCourse("pm-a3", "pm-a3-owner@e.com");
    await prisma.course.update({ where: { id: courseId }, data: { publicAccess: true } });
    expect(await canAccessProtectedMedia(null, [courseId])).toBe(true);
    await prisma.course.update({ where: { id: courseId }, data: { status: "draft" } });
    expect(await canAccessProtectedMedia(null, [courseId])).toBe(false);
  });

  it("file ở hai khoá: có quyền ở một trong hai là đủ", async () => {
    const a = await protectedCourse("pm-a4a", "pm-a4a-owner@e.com");
    const b = await protectedCourse("pm-a4b", "pm-a4b-owner@e.com");
    const learner = await makeUser("pm-a4-learner@e.com");
    await enrollInCourse(learner, b.courseId);
    expect(await canAccessProtectedMedia(learner, [a.courseId])).toBe(false);
    expect(await canAccessProtectedMedia(learner, [a.courseId, b.courseId])).toBe(true);
  });
});
