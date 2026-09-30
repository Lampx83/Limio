import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { createCourse, publishCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createAssignment } from "../assignments";
import { createCourseSection } from "../sections";
import { createQuiz } from "../../quizzes/quizzes";
import { createQuestion } from "../../quizzes/questions";
import { startAttempt } from "../../quizzes/attempts";
import {
  effectiveAssignmentDues,
  getAssignmentDeadlines,
  getQuizDeadlines,
  setAssignmentSectionDeadlines,
  setQuizSectionSchedules,
} from "../sectionDeadlines";

const BASE = "http://localhost:3000";
const D = (s: string) => new Date(s);
const HOUR = 3600_000;

async function user(slug: string, who: string) {
  return (
    await registerUser({ email: `${who}-${slug}@e.com`, password: "password1234", displayName: who }, BASE)
  ).userId;
}

async function setup(slug: string) {
  const inst = await user(slug, "inst");
  const outsider = await user(slug, "out");
  const la = await user(slug, "la"); // học viên lớp A
  const lb = await user(slug, "lb"); // học viên lớp B
  const ld = await user(slug, "ld"); // chưa gán lớp (lớp mặc định)

  const c = await createCourse(inst, { title: slug, description: "x", slug });
  const m = await createModule(inst, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(inst, m.moduleId, { title: "L", orderIndex: 0 });
  await publishCourse(inst, c.courseId);

  const A = await createCourseSection(inst, c.courseId, { name: "Lớp A" });
  const B = await createCourseSection(inst, c.courseId, { name: "Lớp B" });
  for (const u of [la, lb, ld]) await enrollInCourse(u, c.courseId);
  await prisma.enrollment.update({ where: { userId_courseId: { userId: la, courseId: c.courseId } }, data: { sectionId: A.id } });
  await prisma.enrollment.update({ where: { userId_courseId: { userId: lb, courseId: c.courseId } }, data: { sectionId: B.id } });

  const base = "2026-10-10T16:59:00.000Z";
  const a = await createAssignment(inst, l.lessonId, { title: "BT", description: "d", dueAt: base });
  return { inst, outsider, la, lb, ld, courseId: c.courseId, lessonId: l.lessonId, A: A.id, B: B.id, assignmentId: a.assignmentId, base };
}

const dueFor = async (userId: string, s: { assignmentId: string; courseId: string; base: string }) =>
  (await effectiveAssignmentDues(userId, [{ id: s.assignmentId, courseId: s.courseId, dueAt: D(s.base) }])).get(s.assignmentId);

describe("hạn nộp bài tập theo lớp", () => {
  it("AC1 chưa đặt gì: mọi học viên (kể cả chưa gán lớp) theo hạn chung", async () => {
    const s = await setup("sd1");
    for (const u of [s.la, s.lb, s.ld]) expect((await dueFor(u, s))?.toISOString()).toBe(s.base);
  });

  it("AC2 đặt riêng một lớp: chỉ lớp đó đổi; lớp khác và người chưa gán lớp vẫn theo hạn chung", async () => {
    const s = await setup("sd2");
    const custom = "2026-10-17T16:59:00.000Z";
    await setAssignmentSectionDeadlines(s.inst, s.assignmentId, {
      sectionIds: [s.A],
      change: { mode: "custom", dueAt: custom },
    });
    expect((await dueFor(s.la, s))?.toISOString()).toBe(custom);
    expect((await dueFor(s.lb, s))?.toISOString()).toBe(s.base);
    expect((await dueFor(s.ld, s))?.toISOString()).toBe(s.base);
  });

  it("AC3 đặt chung cho nhiều lớp trong một lần lưu", async () => {
    const s = await setup("sd3");
    const custom = "2026-10-20T16:59:00.000Z";
    await setAssignmentSectionDeadlines(s.inst, s.assignmentId, {
      sectionIds: [s.A, s.B],
      change: { mode: "custom", dueAt: custom },
    });
    expect((await dueFor(s.la, s))?.toISOString()).toBe(custom);
    expect((await dueFor(s.lb, s))?.toISOString()).toBe(custom);
    expect((await dueFor(s.ld, s))?.toISOString()).toBe(s.base);
    const info = await getAssignmentDeadlines(s.inst, s.assignmentId);
    expect(info.sections.map((r) => [r.name, r.mode])).toEqual([["Lớp A", "custom"], ["Lớp B", "custom"]]);
  });

  it("AC4 trả về hạn chung (inherit) và đặt 'không hạn' cho lớp dù hạn chung có giá trị", async () => {
    const s = await setup("sd4");
    await setAssignmentSectionDeadlines(s.inst, s.assignmentId, {
      sectionIds: [s.A, s.B],
      change: { mode: "custom", dueAt: "2026-10-20T16:59:00.000Z" },
    });
    await setAssignmentSectionDeadlines(s.inst, s.assignmentId, { sectionIds: [s.A], change: { mode: "inherit" } });
    expect((await dueFor(s.la, s))?.toISOString()).toBe(s.base);
    await setAssignmentSectionDeadlines(s.inst, s.assignmentId, {
      sectionIds: [s.B],
      change: { mode: "custom", dueAt: null },
    });
    expect(await dueFor(s.lb, s)).toBeNull(); // lớp B không có hạn
    expect((await dueFor(s.la, s))?.toISOString()).toBe(s.base); // lớp A vẫn theo hạn chung
  });

  it("AC7 học viên chuyển lớp → hạn hiệu lực đổi theo lớp mới", async () => {
    const s = await setup("sd7");
    const custom = "2026-10-17T16:59:00.000Z";
    await setAssignmentSectionDeadlines(s.inst, s.assignmentId, { sectionIds: [s.A], change: { mode: "custom", dueAt: custom } });
    expect((await dueFor(s.lb, s))?.toISOString()).toBe(s.base);
    await prisma.enrollment.update({ where: { userId_courseId: { userId: s.lb, courseId: s.courseId } }, data: { sectionId: s.A } });
    expect((await dueFor(s.lb, s))?.toISOString()).toBe(custom);
  });

  it("lớp tạo SAU khi đã đặt hạn theo lớp không có hạn riêng → theo hạn chung", async () => {
    const s = await setup("sd-new");
    await setAssignmentSectionDeadlines(s.inst, s.assignmentId, {
      sectionIds: [s.A, s.B],
      change: { mode: "custom", dueAt: "2026-10-20T16:59:00.000Z" },
    });
    const C = await createCourseSection(s.inst, s.courseId, { name: "Lớp C (mới)" });
    const lc = await user("sd-new", "lc");
    await enrollInCourse(lc, s.courseId);
    await prisma.enrollment.update({ where: { userId_courseId: { userId: lc, courseId: s.courseId } }, data: { sectionId: C.id } });
    expect((await dueFor(lc, s))?.toISOString()).toBe(s.base);
    const info = await getAssignmentDeadlines(s.inst, s.assignmentId);
    expect(info.sections.find((r) => r.sectionId === C.id)?.mode).toBe("inherit");
  });

  it("AC8 phân quyền + lớp phải thuộc đúng khoá, không đặt riêng cho lớp mặc định", async () => {
    const s = await setup("sd8");
    const input = { sectionIds: [s.A], change: { mode: "custom", dueAt: "2026-10-20T16:59:00.000Z" } };
    await expect(setAssignmentSectionDeadlines(s.outsider, s.assignmentId, input)).rejects.toMatchObject({ code: "forbidden" });
    await expect(setAssignmentSectionDeadlines(s.la, s.assignmentId, input)).rejects.toMatchObject({ code: "forbidden" });
    await expect(getAssignmentDeadlines(s.outsider, s.assignmentId)).rejects.toMatchObject({ code: "forbidden" });

    // lớp của khoá khác
    const other = await createCourse(s.inst, { title: "other", description: "x", slug: "other-sd8" });
    const foreign = await createCourseSection(s.inst, other.courseId, { name: "Lớp lạ" });
    await expect(
      setAssignmentSectionDeadlines(s.inst, s.assignmentId, { ...input, sectionIds: [foreign.id] }),
    ).rejects.toMatchObject({ code: "section_not_in_course" });
    // lớp mặc định
    const def = await prisma.courseSection.findFirstOrThrow({ where: { courseId: s.courseId, isDefault: true } });
    await expect(
      setAssignmentSectionDeadlines(s.inst, s.assignmentId, { ...input, sectionIds: [def.id] }),
    ).rejects.toMatchObject({ code: "section_not_in_course" });
    // rỗng / ngày sai
    await expect(setAssignmentSectionDeadlines(s.inst, s.assignmentId, { ...input, sectionIds: [] })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      setAssignmentSectionDeadlines(s.inst, s.assignmentId, { sectionIds: [s.A], change: { mode: "custom", dueAt: "không phải ngày" } }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("AC9 xoá lớp hoặc xoá bài thì hạn riêng mất theo", async () => {
    const s = await setup("sd9");
    await setAssignmentSectionDeadlines(s.inst, s.assignmentId, {
      sectionIds: [s.A, s.B],
      change: { mode: "custom", dueAt: "2026-10-20T16:59:00.000Z" },
    });
    await prisma.enrollment.update({ where: { userId_courseId: { userId: s.la, courseId: s.courseId } }, data: { sectionId: (await prisma.courseSection.findFirstOrThrow({ where: { courseId: s.courseId, isDefault: true } })).id } });
    await prisma.courseSection.delete({ where: { id: s.A } });
    expect(await prisma.assignmentSectionDue.count({ where: { assignmentId: s.assignmentId } })).toBe(1);
    await prisma.assignment.delete({ where: { id: s.assignmentId } });
    expect(await prisma.assignmentSectionDue.count({ where: { assignmentId: s.assignmentId } })).toBe(0);
  });
});

describe("lịch quiz theo lớp (cổng bắt đầu làm bài)", () => {
  async function quizSetup(slug: string, sched: { opensAt?: string | null; dueAt?: string | null }) {
    const s = await setup(slug);
    const q = await createQuiz(
      s.inst,
      { courseId: s.courseId, lessonId: s.lessonId },
      { title: "Q", requireConfidence: false, ...sched },
    );
    await createQuestion(s.inst, q.quizId, {
      type: "true_false",
      prompt: "Sky is blue",
      points: 1,
      orderIndex: 0,
      options: [{ label: "T", isCorrect: true }, { label: "F", isCorrect: false }],
    });
    return { ...s, quizId: q.quizId };
  }
  const past = new Date(Date.now() - 24 * HOUR).toISOString();
  const future = new Date(Date.now() + 24 * HOUR).toISOString();

  it("hạn chung đã đóng nhưng lớp A được gia hạn: A bắt đầu được, B (và chưa gán lớp) bị chặn", async () => {
    const s = await quizSetup("sq1", { dueAt: past });
    await setQuizSectionSchedules(s.inst, s.quizId, {
      sectionIds: [s.A],
      change: { mode: "custom", opensAt: null, dueAt: future },
    });
    await expect(startAttempt(s.la, s.quizId)).resolves.toMatchObject({ created: true });
    await expect(startAttempt(s.lb, s.quizId)).rejects.toMatchObject({ code: "quiz_past_due" });
    await expect(startAttempt(s.ld, s.quizId)).rejects.toMatchObject({ code: "quiz_past_due" });
  });

  it("hạn chung còn mở nhưng lớp B đóng sớm: B bị chặn, A theo hạn chung vẫn làm được", async () => {
    const s = await quizSetup("sq2", { dueAt: future });
    await setQuizSectionSchedules(s.inst, s.quizId, {
      sectionIds: [s.B],
      change: { mode: "custom", opensAt: null, dueAt: past },
    });
    await expect(startAttempt(s.lb, s.quizId)).rejects.toMatchObject({ code: "quiz_past_due" });
    await expect(startAttempt(s.la, s.quizId)).resolves.toMatchObject({ created: true });
  });

  it("Hạn mở theo lớp: lớp A chưa tới giờ mở thì bị chặn, lớp B đã mở", async () => {
    const s = await quizSetup("sq3", { opensAt: past });
    await setQuizSectionSchedules(s.inst, s.quizId, {
      sectionIds: [s.A],
      change: { mode: "custom", opensAt: future, dueAt: null },
    });
    await expect(startAttempt(s.la, s.quizId)).rejects.toMatchObject({ code: "quiz_not_open" });
    await expect(startAttempt(s.lb, s.quizId)).resolves.toMatchObject({ created: true });
  });

  it("lịch riêng thay CẢ HAI mốc: hạn mở chung ở tương lai không còn áp cho lớp có lịch riêng (null = không có mốc)", async () => {
    const s = await quizSetup("sq4", { opensAt: future });
    await setQuizSectionSchedules(s.inst, s.quizId, {
      sectionIds: [s.A],
      change: { mode: "custom", opensAt: null, dueAt: null },
    });
    await expect(startAttempt(s.la, s.quizId)).resolves.toMatchObject({ created: true });
    await expect(startAttempt(s.lb, s.quizId)).rejects.toMatchObject({ code: "quiz_not_open" });
  });

  it("bỏ lịch riêng (inherit) → lớp quay về lịch chung; mở phải trước đóng; đọc lại thấy đủ", async () => {
    const s = await quizSetup("sq5", { dueAt: past });
    await setQuizSectionSchedules(s.inst, s.quizId, { sectionIds: [s.A], change: { mode: "custom", opensAt: null, dueAt: future } });
    await setQuizSectionSchedules(s.inst, s.quizId, { sectionIds: [s.A], change: { mode: "inherit" } });
    await expect(startAttempt(s.la, s.quizId)).rejects.toMatchObject({ code: "quiz_past_due" });

    await expect(
      setQuizSectionSchedules(s.inst, s.quizId, { sectionIds: [s.A], change: { mode: "custom", opensAt: future, dueAt: past } }),
    ).rejects.toMatchObject({ code: "invalid_window" });

    await setQuizSectionSchedules(s.inst, s.quizId, { sectionIds: [s.B], change: { mode: "custom", opensAt: past, dueAt: future } });
    const info = await getQuizDeadlines(s.inst, s.quizId);
    expect(info.base.dueAt).toBe(past);
    expect(info.sections.map((r) => [r.name, r.mode])).toEqual([["Lớp A", "inherit"], ["Lớp B", "custom"]]);
    expect(info.sections[1]).toMatchObject({ opensAt: past, dueAt: future });
  });

  it("quiz cũng chỉ cho người sửa được khoá đặt lịch theo lớp", async () => {
    const s = await quizSetup("sq6", {});
    await expect(
      setQuizSectionSchedules(s.outsider, s.quizId, { sectionIds: [s.A], change: { mode: "inherit" } }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
