import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  CoursePackError,
  getCoursePlan,
  getPackPreview,
  listPublishedPacks,
  publishCoursePack,
  releasePackVersion,
  unpublishCoursePack,
  updateCourseFromPack,
  usePack,
} from "../coursePacks";
import { cancelMeeting, getClassSchedule, listLearnerMeetings, listTeacherMeetings, setClassSchedule } from "../classSchedule";
import { CourseAuthzError } from "../authz";
import { createCourse } from "../courses";
import { createCourseSection } from "../sections";
import { createModule } from "../modules";
import { createLesson, updateLesson } from "../lessons";
import { createContentItem } from "../contents";
import { createAssignment } from "../assignments";
import { createQuiz } from "../../quizzes/quizzes";
import { createQuestion } from "../../quizzes/questions";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";
const NOW = new Date("2026-10-23T03:00:00.000Z");

async function makeUser(email: string, roles: string[] = []) {
  const r = await registerUser({ email, password: "password1234", displayName: email }, BASE);
  for (const name of roles) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    await prisma.userRole.create({ data: { userId: r.userId, roleId: role.id, grantedBy: r.userId } });
  }
  return r.userId;
}

const makeAdmin = (tag: string) => makeUser(`cp-${tag}-admin@e.com`, ["admin"]);
const makeTeacher = (tag: string) => makeUser(`cp-${tag}-teacher@e.com`, ["instructor"]);

/** Khoá soạn gói: `sessions` chương, mỗi chương 2 bài (từ vựng có ghi chú giảng viên, hội thoại có quiz). */
async function authorCourse(adminId: string, tag: string, sessions = 3, personalizationEnabled = false) {
  const { courseId } = await createCourse(adminId, { title: `Tiếng Trung ${tag}`, description: "Giáo trình mẫu", slug: `cp-src-${tag}`, personalizationEnabled });
  const moduleIds: string[] = [];
  const lessonIds: string[][] = [];
  for (let i = 1; i <= sessions; i++) {
    const m = await createModule(adminId, courseId, { title: `Buổi ${i}: chủ đề ${i}`, orderIndex: i - 1 });
    moduleIds.push(m.moduleId);
    const l1 = await createLesson(adminId, m.moduleId, { title: `Từ vựng ${i}`, orderIndex: 0 });
    const l2 = await createLesson(adminId, m.moduleId, { title: `Hội thoại ${i}`, orderIndex: 1 });
    lessonIds.push([l1.lessonId, l2.lessonId]);
    await createContentItem(adminId, l1.lessonId, { type: "markdown", orderIndex: 0, payload: { body: `Nội dung từ vựng ${i}` } });
    await createContentItem(adminId, l1.lessonId, { type: "teacher_note", orderIndex: 1, payload: { html: `<p>Đáp án buổi ${i}: bí mật của giáo viên</p>` } });
    const q = await createQuiz(adminId, { courseId, lessonId: l2.lessonId }, { title: `Quiz ${i}`, difficulty: 1 });
    await createQuestion(adminId, q.quizId, {
      type: "mcq",
      prompt: `Câu hỏi ${i}`,
      points: 1,
      orderIndex: 0,
      options: [{ label: "Đúng", isCorrect: true }, { label: "Sai", isCorrect: false }],
    });
  }
  return { courseId, moduleIds, lessonIds };
}

async function publishedPack(tag: string, sessions = 3) {
  const admin = await makeAdmin(tag);
  const src = await authorCourse(admin, tag, sessions);
  const pack = await publishCoursePack(admin, src.courseId, {
    slug: `pack-${tag}`,
    title: `Tiếng Trung sơ cấp ${tag}`,
    summary: "24 buổi cho người mới bắt đầu",
    language: "zh",
    outcomeLevel: "HSK 1",
  });
  return { admin, src, packId: pack.packId };
}

describe("publishCoursePack / releasePackVersion", () => {
  it("chỉ quản trị mới phát hành gói", async () => {
    const admin = await makeAdmin("pub-auth");
    const src = await authorCourse(admin, "pub-auth");
    const teacher = await makeTeacher("pub-auth");
    await expect(
      publishCoursePack(teacher, src.courseId, { slug: "x", title: "x", summary: "x", language: "zh" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("đánh số buổi cho các chương theo thứ tự, tạo gói đã xuất bản ở phiên bản 1", async () => {
    const { src, packId } = await publishedPack("pub");
    const modules = await prisma.module.findMany({ where: { courseId: src.courseId }, orderBy: { orderIndex: "asc" } });
    expect(modules.map((m) => m.sessionNo)).toEqual([1, 2, 3]);

    const pack = await prisma.coursePack.findUniqueOrThrow({ where: { id: packId } });
    expect(pack).toMatchObject({ isPublished: true, version: 1, language: "zh", outcomeLevel: "HSK 1", courseId: src.courseId });
    expect(pack.publishedAt).not.toBeNull();
  });

  it("khoá không có chương nào có bài thì không phát hành được", async () => {
    const admin = await makeAdmin("pub-empty");
    const { courseId } = await createCourse(admin, { title: "Rỗng", description: "d", slug: "cp-src-empty" });
    await createModule(admin, courseId, { title: "Chương trống", orderIndex: 0 });
    await expect(
      publishCoursePack(admin, courseId, { slug: "empty", title: "t", summary: "s", language: "zh" }),
    ).rejects.toMatchObject({ code: "no_sessions" });
  });

  it("slug trùng với gói của khoá khác bị từ chối; phát hành lại cùng khoá thì cập nhật, giữ nguyên phiên bản", async () => {
    const { admin, src, packId } = await publishedPack("pub-slug");
    const other = await authorCourse(admin, "pub-slug-2");
    await expect(
      publishCoursePack(admin, other.courseId, { slug: "pack-pub-slug", title: "t", summary: "s", language: "zh" }),
    ).rejects.toMatchObject({ code: "slug_taken" });

    const again = await publishCoursePack(admin, src.courseId, { slug: "pack-pub-slug", title: "Tên mới", summary: "s", language: "zh" });
    expect(again.packId).toBe(packId);
    expect(await prisma.coursePack.count()).toBe(1);
    expect((await prisma.coursePack.findUniqueOrThrow({ where: { id: packId } })).title).toBe("Tên mới");
  });

  it("releasePackVersion tăng phiên bản; người không phải quản trị bị từ chối", async () => {
    const { admin, packId } = await publishedPack("rel");
    expect(await releasePackVersion(admin, packId)).toEqual({ version: 2 });
    const teacher = await makeTeacher("rel");
    await expect(releasePackVersion(teacher, packId)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("thư viện giáo trình (C3.1)", () => {
  it("giảng viên thấy gói đã xuất bản kèm số buổi, số bài; gói đã gỡ thì không thấy", async () => {
    const { admin, packId } = await publishedPack("lib");
    const teacher = await makeTeacher("lib");

    const list = await listPublishedPacks(teacher);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: packId, title: "Tiếng Trung sơ cấp lib", language: "zh", outcomeLevel: "HSK 1", version: 1, sessionCount: 3, lessonCount: 6 });

    await unpublishCoursePack(admin, packId);
    expect(await listPublishedPacks(teacher)).toEqual([]);
  });

  it("học viên (không phải giảng viên) không xem được thư viện", async () => {
    await publishedPack("lib-learner");
    const learner = await makeUser("cp-lib-learner-l@e.com");
    await expect(listPublishedPacks(learner)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("xem trước từng buổi: tên buổi, các bài, và loại nội dung trong bài", async () => {
    const { packId } = await publishedPack("preview");
    const teacher = await makeTeacher("preview");
    const view = await getPackPreview(teacher, packId);

    expect(view.sessions.map((s) => [s.sessionNo, s.title])).toEqual([
      [1, "Buổi 1: chủ đề 1"],
      [2, "Buổi 2: chủ đề 2"],
      [3, "Buổi 3: chủ đề 3"],
    ]);
    const first = view.sessions[0]!;
    expect(first.lessons.map((l) => l.title)).toEqual(["Từ vựng 1", "Hội thoại 1"]);
    expect(first.lessons[0]!.kinds).toMatchObject({ teacherNote: 1 });
    expect(first.lessons[1]!.kinds).toMatchObject({ quiz: 1 });
  });

  it("gói chưa xuất bản thì không xem trước và không dùng được", async () => {
    const { admin, packId } = await publishedPack("unpub");
    await unpublishCoursePack(admin, packId);
    const teacher = await makeTeacher("unpub");
    await expect(getPackPreview(teacher, packId)).rejects.toMatchObject({ code: "not_published" });
    await expect(usePack(teacher, packId)).rejects.toMatchObject({ code: "not_published" });
  });
});

describe("usePack — sao chép về tài khoản giảng viên (C3.2, C3.6, C3.9, C3.10)", () => {
  it("tạo khoá nháp thuộc giảng viên, giữ số buổi của từng chương, ghi nguồn và phiên bản gói", async () => {
    const { packId, src } = await publishedPack("use");
    const teacher = await makeTeacher("use");
    const { courseId } = await usePack(teacher, packId);

    const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, include: { instructors: true } });
    expect(course).toMatchObject({ status: "draft", sourcePackId: packId, sourcePackVersion: 1, title: "Tiếng Trung sơ cấp use" });
    expect(course.instructors.map((i) => [i.userId, i.role])).toEqual([[teacher, "owner"]]);

    const modules = await prisma.module.findMany({ where: { courseId }, orderBy: { orderIndex: "asc" }, include: { lessons: true } });
    expect(modules.map((m) => m.sessionNo)).toEqual([1, 2, 3]);
    expect(modules.every((m) => m.lessons.length === 2)).toBe(true);
    // Bản sao độc lập: id chương khác với khoá nguồn.
    const srcModules = await prisma.module.findMany({ where: { courseId: src.courseId } });
    expect(modules.some((m) => srcModules.some((s) => s.id === m.id))).toBe(false);
  });

  it("sửa bài trên bản sao không đụng gói gốc", async () => {
    const { packId, src } = await publishedPack("indep");
    const teacher = await makeTeacher("indep");
    const { courseId } = await usePack(teacher, packId);
    const copyLesson = await prisma.lesson.findFirstOrThrow({ where: { module: { courseId }, title: "Từ vựng 1" } });
    await updateLesson(teacher, copyLesson.id, { title: "Từ vựng 1 (đã sửa)" });

    const srcLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: src.lessonIds[0]![0]! } });
    expect(srcLesson.title).toBe("Từ vựng 1");
  });

  it("ghi chú giảng viên được sao nguyên là loại teacher_note (bộ lọc phía học viên dựa vào loại này)", async () => {
    const { packId } = await publishedPack("note");
    const teacher = await makeTeacher("note");
    const { courseId } = await usePack(teacher, packId);
    const notes = await prisma.contentItem.findMany({ where: { lesson: { module: { courseId } }, type: "teacher_note" } });
    expect(notes).toHaveLength(3);
  });

  it("chỉ giảng viên mới dùng được gói", async () => {
    const { packId } = await publishedPack("use-auth");
    const learner = await makeUser("cp-use-auth-l@e.com");
    await expect(usePack(learner, packId)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("khoá nguồn không bật cá nhân hoá thì bản sao không sinh Skill thừa; bật thì mỗi bài có một Skill (C3.9)", async () => {
    const off = await publishedPack("tag-off");
    const t1 = await makeTeacher("tag-off");
    await usePack(t1, off.packId);
    expect(await prisma.skill.count({ where: { code: { startsWith: "lesson." } } })).toBe(0);

    const on = await publishedPack("tag-on");
    await prisma.course.update({ where: { id: on.src.courseId }, data: { personalizationEnabled: true } });
    const t2 = await makeTeacher("tag-on");
    const { courseId } = await usePack(t2, on.packId);
    const lessons = await prisma.lesson.findMany({ where: { module: { courseId } }, select: { id: true } });
    const skills = await prisma.skill.findMany({ where: { code: { in: lessons.map((l) => `lesson.${l.id}`) } } });
    expect(skills).toHaveLength(lessons.length);
  });

  it("tệp media dùng chung tham chiếu, không nhân đôi file và không thêm dòng vào sổ dung lượng (C3.10)", async () => {
    const admin = await makeAdmin("media");
    const src = await authorCourse(admin, "media", 1);
    const url = "/api/lesson-media/audio/2026/10/bai-1.mp3";
    await createContentItem(admin, src.lessonIds[0]![0]!, { type: "audio", orderIndex: 2, payload: { url, title: "Nghe bài 1" } });
    const pack = await publishCoursePack(admin, src.courseId, { slug: "pack-media", title: "t", summary: "s", language: "zh" });
    const before = await prisma.storedFile.count();

    const teacher = await makeTeacher("media");
    const { courseId } = await usePack(teacher, pack.packId);
    const copied = await prisma.contentItem.findFirstOrThrow({ where: { lesson: { module: { courseId } }, type: "audio" } });
    expect((copied.payload as { url: string }).url).toBe(url);
    expect(await prisma.storedFile.count()).toBe(before);
  });
});

describe("giáo án theo buổi trên lịch lớp (C3.3, C3.4, C3.5)", () => {
  const PLAN = (n: number) => ({
    startDate: "2026-11-03",
    totalMeetings: n,
    slots: [{ weekday: 2, startTime: "18:30", durationMin: 120 }],
  });

  async function classOfCopy(tag: string, meetings: number, sessions = 3) {
    const { packId, admin, src } = await publishedPack(tag, sessions);
    const teacher = await makeTeacher(tag);
    const { courseId } = await usePack(teacher, packId);
    const section = await createCourseSection(teacher, courseId, { name: "Lớp A" });
    await setClassSchedule(teacher, section.id, PLAN(meetings), prisma, NOW);
    return { admin, src, packId, teacher, courseId, sectionId: section.id };
  }

  const range = { from: "2026-11-01", to: "2027-03-31" };

  it("buổi seq N hiện giáo án của buổi N: tên buổi và các bài; buổi dư hiện chưa có giáo án", async () => {
    const c = await classOfCopy("plan", 4);
    const ms = await listTeacherMeetings(c.teacher, range);
    expect(ms.map((m) => m.plan?.title ?? null)).toEqual(["Buổi 1: chủ đề 1", "Buổi 2: chủ đề 2", "Buổi 3: chủ đề 3", null]);
    expect(ms[0]!.plan!.lessons.map((l) => l.title)).toEqual(["Từ vựng 1", "Hội thoại 1"]);
    expect(ms[0]!.plan!.sessionNo).toBe(1);
  });

  it("thiếu buổi so với giáo án: báo còn bao nhiêu buổi giáo án chưa có lịch; thừa buổi: báo số buổi chưa có giáo án", async () => {
    const few = await classOfCopy("plan-few", 2);
    const fewDetail = await getClassSchedule(few.teacher, few.sectionId);
    expect(fewDetail).toMatchObject({ planSessions: 3, unscheduledSessions: 1, meetingsWithoutPlan: 0 });

    const many = await classOfCopy("plan-many", 5);
    const manyDetail = await getClassSchedule(many.teacher, many.sectionId);
    expect(manyDetail).toMatchObject({ planSessions: 3, unscheduledSessions: 0, meetingsWithoutPlan: 2 });
  });

  it("lớp thuộc khoá không có giáo án theo buổi thì không có plan và không có cảnh báo", async () => {
    const teacher = await makeTeacher("noplan");
    const { courseId } = await createCourse(teacher, { title: "Khoá thường", description: "d", slug: "cp-noplan" });
    const section = await createCourseSection(teacher, courseId, { name: "Lớp" });
    await setClassSchedule(teacher, section.id, PLAN(2), prisma, NOW);
    const ms = await listTeacherMeetings(teacher, range);
    expect(ms.every((m) => m.plan === null)).toBe(true);
    expect(await getClassSchedule(teacher, section.id)).toMatchObject({ planSessions: 0, unscheduledSessions: 0, meetingsWithoutPlan: 0 });
  });

  it("huỷ một buổi thì giáo án đi theo số thứ tự: buổi kế tiếp nhận giáo án của buổi bị huỷ", async () => {
    const c = await classOfCopy("plan-cancel", 4);
    const before = await prisma.classMeeting.findMany({ where: { sectionId: c.sectionId }, orderBy: { startsAt: "asc" } });
    await cancelMeeting(c.teacher, before[1]!.id, { reason: "Nghỉ lễ" }, prisma);

    const ms = await listTeacherMeetings(c.teacher, range);
    const live = ms.filter((m) => m.status !== "cancelled");
    // 4 buổi, huỷ 1 → còn 3 buổi học thật, đánh số lại 1..3 nên mỗi buổi nhận đúng giáo án theo số mới.
    expect(live.map((m) => m.seq)).toEqual([1, 2, 3]);
    expect(live.map((m) => m.plan?.title ?? null)).toEqual(["Buổi 1: chủ đề 1", "Buổi 2: chủ đề 2", "Buổi 3: chủ đề 3"]);
    expect(ms.find((m) => m.status === "cancelled")!.plan).toBeNull();
  });

  it("học viên chỉ thấy tên bài và id, không thấy bài ẩn, không có nội dung hay ghi chú giảng viên", async () => {
    const c = await classOfCopy("plan-learner", 3);
    const hidden = await prisma.lesson.findFirstOrThrow({ where: { module: { courseId: c.courseId }, title: "Hội thoại 1" } });
    await prisma.lesson.update({ where: { id: hidden.id }, data: { isHidden: true } });

    const learner = await makeUser("cp-plan-learner-l@e.com");
    await prisma.enrollment.create({ data: { userId: learner, courseId: c.courseId, sectionId: c.sectionId, courseVersion: 1 } });

    const mine = await listLearnerMeetings(learner, range);
    expect(mine[0]!.plan!.lessons.map((l) => l.title)).toEqual(["Từ vựng 1"]);
    const raw = JSON.stringify(mine);
    expect(raw).not.toContain("bí mật");
    expect(raw).not.toContain("payload");

    const teacherView = await listTeacherMeetings(c.teacher, range);
    expect(teacherView[0]!.plan!.lessons).toHaveLength(2);
  });
});

describe("getCoursePlan và cập nhật khi gói ra bản mới (C3.7)", () => {
  it("bản sao mới chưa có bản cập nhật; gói phát hành bản mới thì báo có bản mới, bản sao không đổi", async () => {
    const { admin, src, packId } = await publishedPack("upd");
    const teacher = await makeTeacher("upd");
    const { courseId } = await usePack(teacher, packId);

    const before = await getCoursePlan(teacher, courseId);
    expect(before.pack).toMatchObject({ hasUpdate: false, copiedVersion: 1, currentVersion: 1 });
    expect(before.sessions).toHaveLength(3);

    await updateLesson(admin, src.lessonIds[1]![0]!, { title: "Từ vựng 2 (bản mới)" });
    await releasePackVersion(admin, packId);

    const after = await getCoursePlan(teacher, courseId);
    expect(after.pack).toMatchObject({ hasUpdate: true, copiedVersion: 1, currentVersion: 2 });
    expect(after.sessions[1]!.lessons[0]!.title).toBe("Từ vựng 2");
  });

  it("cập nhật chỉ thay những buổi chưa dạy và chưa có hoạt động của học viên; còn lại giữ nguyên và được báo lý do", async () => {
    const { admin, src, packId } = await publishedPack("upd2");
    const teacher = await makeTeacher("upd2");
    const { courseId } = await usePack(teacher, packId);
    const section = await createCourseSection(teacher, courseId, { name: "Lớp A" });
    await setClassSchedule(teacher, section.id, { startDate: "2026-11-03", totalMeetings: 3, slots: [{ weekday: 2, startTime: "18:30", durationMin: 120 }] }, prisma, NOW);
    const meetings = await prisma.classMeeting.findMany({ where: { sectionId: section.id }, orderBy: { startsAt: "asc" } });

    // Buổi 1 đã dạy; buổi 2 có học viên đã xem bài; buổi 3 chưa gì cả.
    await prisma.classMeeting.update({ where: { id: meetings[0]!.id }, data: { status: "held" } });
    const learner = await makeUser("cp-upd2-l@e.com");
    const copyLesson2 = await prisma.lesson.findFirstOrThrow({ where: { module: { courseId, sessionNo: 2 } } });
    await prisma.lessonEngagement.create({ data: { userId: learner, lessonId: copyLesson2.id, courseId } });

    for (const i of [0, 1, 2]) await updateLesson(admin, src.lessonIds[i]![0]!, { title: `Từ vựng ${i + 1} (bản mới)` });
    await releasePackVersion(admin, packId);

    const modulesBefore = await prisma.module.findMany({ where: { courseId }, orderBy: { sessionNo: "asc" } });
    const res = await updateCourseFromPack(teacher, courseId, prisma, NOW);
    expect(res.updatedSessions).toEqual([3]);
    expect(res.skipped).toEqual([
      { sessionNo: 1, reason: "taught" },
      { sessionNo: 2, reason: "has_activity" },
    ]);

    const modulesAfter = await prisma.module.findMany({ where: { courseId }, orderBy: { sessionNo: "asc" }, include: { lessons: true } });
    expect(modulesAfter.map((m) => m.sessionNo)).toEqual([1, 2, 3]);
    expect(modulesAfter[0]!.id).toBe(modulesBefore[0]!.id);
    expect(modulesAfter[1]!.id).toBe(modulesBefore[1]!.id);
    expect(modulesAfter[2]!.id).not.toBe(modulesBefore[2]!.id);
    expect(modulesAfter[2]!.lessons.map((l) => l.title)).toContain("Từ vựng 3 (bản mới)");
    expect(modulesAfter[0]!.lessons.map((l) => l.title)).toContain("Từ vựng 1");

    const plan = await getCoursePlan(teacher, courseId);
    expect(plan.pack).toMatchObject({ hasUpdate: false, copiedVersion: 2 });
  });

  it("không có bản mới thì không cập nhật; người không sửa được khoá bị từ chối; khoá không phải bản sao của gói báo lỗi", async () => {
    const { packId } = await publishedPack("upd3");
    const teacher = await makeTeacher("upd3");
    const { courseId } = await usePack(teacher, packId);
    await expect(updateCourseFromPack(teacher, courseId, prisma, NOW)).rejects.toMatchObject({ code: "nothing_to_update" });

    const stranger = await makeTeacher("upd3-x");
    await expect(updateCourseFromPack(stranger, courseId, prisma, NOW)).rejects.toBeInstanceOf(CourseAuthzError);

    const plain = await createCourse(teacher, { title: "Thường", description: "d", slug: "cp-upd3-plain" });
    await expect(updateCourseFromPack(teacher, plain.courseId, prisma, NOW)).rejects.toMatchObject({ code: "not_a_pack_copy" });
  });
});

describe("lỗi", () => {
  it("CoursePackError mang mã", () => {
    expect(new CoursePackError("forbidden").code).toBe("forbidden");
  });
});
