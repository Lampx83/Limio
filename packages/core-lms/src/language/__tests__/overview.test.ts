import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { getLanguageLearnerOverview, getLanguageTeacherOverview } from "../overview";

/**
 * LANG L3 — số liệu trang tổng quan Limio Language. Chỉ đọc dữ liệu của CHÍNH người xem (L3.3):
 * giảng viên chỉ thấy khoá mình dạy, học viên chỉ thấy khoá mình đã ghi danh.
 */

let seq = 0;
const uid = () => `${Date.now()}-${++seq}-${Math.random().toString(36).slice(2, 7)}`;

async function user(tag: string) {
  return prisma.user.create({ data: { email: `ov-${tag}-${uid()}@e.com`, passwordHash: "x", displayName: `U ${tag} ${seq}` } });
}

async function course(
  teacherId: string,
  o: { languageMode?: boolean; status?: "draft" | "published"; title?: string } = {},
) {
  const c = await prisma.course.create({
    data: {
      slug: `ov-${uid()}`,
      title: o.title ?? "Khoá",
      description: "x",
      languageMode: o.languageMode ?? true,
      personalizationEnabled: o.languageMode ?? true,
      status: o.status ?? "published",
    },
  });
  await prisma.courseInstructor.create({ data: { courseId: c.id, userId: teacherId, role: "owner" } });
  const m = await prisma.module.create({ data: { courseId: c.id, title: "M", orderIndex: 0 } });
  return { courseId: c.id, moduleId: m.id };
}

async function lesson(moduleId: string, skill: "writing" | "speaking" | "reading" | null, order: number) {
  return prisma.lesson.create({ data: { moduleId, title: `L${order}`, orderIndex: order, ...(skill ? { languageSkill: skill } : {}) } });
}

async function submission(lessonId: string, studentId: string, status: "submitted" | "graded" = "submitted", at = new Date()) {
  const a = await prisma.assignment.create({ data: { lessonId, title: `A ${uid()}`, description: "d", maxScore: 10 } });
  return prisma.assignmentSubmission.create({
    data: { assignmentId: a.id, userId: studentId, body: "bài", status, submittedAt: at },
  });
}

const sections = new Map<string, string>();
async function sectionOf(courseId: string) {
  if (!sections.has(courseId)) sections.set(courseId, (await prisma.courseSection.create({ data: { courseId, name: "Lớp" } })).id);
  return sections.get(courseId)!;
}
async function enroll(userId: string, courseId: string, status: "active" | "dropped" = "active", lastLessonId?: string) {
  return prisma.enrollment.create({
    data: { userId, courseId, sectionId: await sectionOf(courseId), courseVersion: 1, status, ...(lastLessonId ? { lastLessonId } : {}) },
  });
}

async function exam(courseId: string, o: { mock?: boolean; status?: "draft" | "published"; allowMock?: boolean; allowPractice?: boolean } = {}) {
  return prisma.exam.create({
    data: {
      courseId,
      title: `Đề ${uid()}`,
      durationMin: 30,
      openAt: new Date(Date.now() - 86_400_000),
      closeAt: new Date(Date.now() + 86_400_000),
      mockMode: o.mock ?? true,
      status: o.status ?? "published",
      allowMock: o.allowMock ?? true,
      allowPractice: o.allowPractice ?? true,
    },
  });
}

describe("getLanguageTeacherOverview (L3.1, L3.3)", () => {
  it("chỉ các khoá NGOẠI NGỮ mà tôi dạy — không khoá thường, không khoá của người khác", async () => {
    const me = await user("t");
    const other = await user("o");
    const mine = await course(me.id, { title: "Tiếng Trung" });
    await course(me.id, { languageMode: false, title: "Lập trình" });
    await course(other.id, { title: "Của người khác" });
    const o = await getLanguageTeacherOverview(me.id);
    expect(o.courses.map((c) => c.id)).toEqual([mine.courseId]);
    expect(o.courses[0]).toMatchObject({ title: "Tiếng Trung", status: "published" });
  });

  it("đếm học viên đang học (bỏ người đã rút) và số đề thi thử theo trạng thái", async () => {
    const me = await user("t");
    const c = await course(me.id);
    const s1 = await user("s1");
    const s2 = await user("s2");
    await enroll(s1.id, c.courseId);
    await enroll(s2.id, c.courseId, "dropped");
    await exam(c.courseId, { status: "published" });
    await exam(c.courseId, { status: "published" });
    await exam(c.courseId, { status: "draft" });
    await exam(c.courseId, { mock: false, status: "published" }); // đề thường: không tính
    const o = await getLanguageTeacherOverview(me.id);
    expect(o.courses[0]).toMatchObject({ studentCount: 1, examCount: 3 });
    expect(o.exams).toEqual({ draft: 1, published: 2 });
  });

  it("bài chờ chấm: chỉ bài NỘP (chưa chấm) của bài học Viết/Nói trong khoá tôi dạy; xếp cũ nhất trước, tối đa 5", async () => {
    const me = await user("t");
    const c = await course(me.id);
    const st = await user("s");
    const w = await lesson(c.moduleId, "writing", 0);
    const sp = await lesson(c.moduleId, "speaking", 1);
    const rd = await lesson(c.moduleId, "reading", 2);
    const plain = await lesson(c.moduleId, null, 3);
    const t0 = Date.now();
    await submission(w.id, st.id, "submitted", new Date(t0 - 5000));
    await submission(sp.id, st.id, "submitted", new Date(t0 - 9000));
    await submission(w.id, st.id, "graded", new Date(t0 - 20000)); // đã chấm: không tính
    await submission(rd.id, st.id); // kỹ năng Đọc: không tính
    await submission(plain.id, st.id); // bài không gắn kỹ năng: không tính
    for (let i = 0; i < 6; i++) await submission(w.id, st.id, "submitted", new Date(t0 - 1000 * i));
    const o = await getLanguageTeacherOverview(me.id);
    expect(o.pendingGradeTotal).toBe(8);
    expect(o.pendingGrade).toHaveLength(5);
    expect(o.pendingGrade[0]).toMatchObject({ skill: "speaking" });
    expect(o.pendingGrade[0]!.submittedAt.getTime()).toBeLessThanOrEqual(o.pendingGrade[1]!.submittedAt.getTime());
    expect(o.pendingGrade[0]!.studentName).toMatch(/^U s/);
    expect(o.courses[0]!.pendingGrade).toBe(8);
  });

  it("không rò: bài nộp ở khoá của giảng viên khác không vào số liệu của tôi", async () => {
    const me = await user("t");
    const other = await user("o");
    await course(me.id);
    const oc = await course(other.id);
    const l = await lesson(oc.moduleId, "writing", 0);
    await submission(l.id, (await user("s")).id);
    const o = await getLanguageTeacherOverview(me.id);
    expect(o.pendingGradeTotal).toBe(0);
  });

  it("chưa có khoá ngoại ngữ nào → rỗng, không lỗi", async () => {
    const me = await user("t");
    expect(await getLanguageTeacherOverview(me.id)).toMatchObject({ courses: [], pendingGradeTotal: 0, exams: { draft: 0, published: 0 } });
  });
});

describe("getLanguageLearnerOverview (L3.2, L3.3)", () => {
  it("chỉ khoá ngoại ngữ tôi đang học; bỏ khoá thường, khoá đã rút, khoá chưa ghi danh", async () => {
    const t = await user("t");
    const me = await user("me");
    const a = await course(t.id, { title: "A" });
    const b = await course(t.id, { languageMode: false, title: "B thường" });
    const d = await course(t.id, { title: "D đã rút" });
    await course(t.id, { title: "E chưa ghi danh" });
    await enroll(me.id, a.courseId);
    await enroll(me.id, b.courseId);
    await enroll(me.id, d.courseId, "dropped");
    const o = await getLanguageLearnerOverview(me.id);
    expect(o.courses.map((c) => c.title)).toEqual(["A"]);
  });

  it("đếm đề đang mở: đã xuất bản, là đề thi thử, còn bật thi thử hoặc luyện đề", async () => {
    const t = await user("t");
    const me = await user("me");
    const c = await course(t.id);
    await enroll(me.id, c.courseId);
    await exam(c.courseId); // mở
    await exam(c.courseId, { allowMock: false, allowPractice: true }); // mở
    await exam(c.courseId, { allowMock: false, allowPractice: false }); // tắt cả hai: không
    await exam(c.courseId, { status: "draft" }); // nháp: không
    await exam(c.courseId, { mock: false }); // đề thường: không
    const o = await getLanguageLearnerOverview(me.id);
    expect(o.courses[0]!.openExamCount).toBe(2);
    expect(o.openExamTotal).toBe(2);
  });

  it("bài học gần nhất để 'Tiếp tục'", async () => {
    const t = await user("t");
    const me = await user("me");
    const c = await course(t.id);
    const l = await lesson(c.moduleId, "reading", 0);
    await enroll(me.id, c.courseId, "active", l.id);
    const o = await getLanguageLearnerOverview(me.id);
    expect(o.courses[0]).toMatchObject({ lastLessonId: l.id });
    expect(o.continue).toMatchObject({ lessonId: l.id });
  });

  it("không rò dữ liệu của người khác; chưa có khoá nào → rỗng", async () => {
    const t = await user("t");
    const me = await user("me");
    const other = await user("other");
    const c = await course(t.id);
    await enroll(other.id, c.courseId);
    const o = await getLanguageLearnerOverview(me.id);
    expect(o).toMatchObject({ courses: [], openExamTotal: 0, continue: null });
  });
});

import { userHasLanguageCourses } from "../overview";

describe("userHasLanguageCourses (L1.3 — nút 'Sang Limio Language')", () => {
  it("true nếu tôi DẠY một khoá ngoại ngữ", async () => {
    const me = await user("t");
    await course(me.id);
    expect(await userHasLanguageCourses(me.id)).toBe(true);
  });
  it("true nếu tôi đang HỌC một khoá ngoại ngữ; false nếu đã rút", async () => {
    const t = await user("t");
    const a = await user("a");
    const b = await user("b");
    const c = await course(t.id);
    await enroll(a.id, c.courseId);
    await enroll(b.id, c.courseId, "dropped");
    expect(await userHasLanguageCourses(a.id)).toBe(true);
    expect(await userHasLanguageCourses(b.id)).toBe(false);
  });
  it("false nếu chỉ có khoá thường, hoặc không có gì", async () => {
    const t = await user("t");
    const s = await user("s");
    const c = await course(t.id, { languageMode: false });
    await enroll(s.id, c.courseId);
    expect(await userHasLanguageCourses(t.id)).toBe(false);
    expect(await userHasLanguageCourses(s.id)).toBe(false);
    expect(await userHasLanguageCourses((await user("x")).id)).toBe(false);
  });
});

describe("kind của khoá trong tổng quan (L6)", () => {
  it("giảng viên và học viên đều thấy kind để biết khoá nào là khoá luyện đề", async () => {
    const t = await user("t");
    const s = await user("s");
    const c = await course(t.id);
    await prisma.course.update({ where: { id: c.courseId }, data: { kind: "practice_bank" } });
    await enroll(s.id, c.courseId);
    expect((await getLanguageTeacherOverview(t.id)).courses[0]!.kind).toBe("practice_bank");
    expect((await getLanguageLearnerOverview(s.id)).courses[0]!.kind).toBe("practice_bank");
  });
});
