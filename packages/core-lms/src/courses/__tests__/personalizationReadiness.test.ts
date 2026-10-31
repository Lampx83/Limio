import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createQuiz } from "../../quizzes/quizzes";
import { createQuestion } from "../../quizzes/questions";
import { registerUser } from "../../auth/register";
import { CourseAuthzError } from "../authz";
import { getPersonalizationReadiness, READINESS_MIN_QUESTIONS } from "../personalizationReadiness";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

async function makeCourse(slug: string, personalizationEnabled = true) {
  const owner = await makeUser(`${slug}-owner@e.com`);
  const c = await createCourse(owner, { title: `t ${slug}`, description: "d", slug, personalizationEnabled });
  const m = await createModule(owner, c.courseId, { title: "Chương 1", orderIndex: 0 });
  return { owner, courseId: c.courseId, moduleId: m.moduleId };
}

/** Câu mcq: đáp án đúng + 2 đáp án sai, đáp án sai đầu tiên gắn nhầm lẫn nếu có. */
async function addQuestion(
  owner: string,
  quizId: string,
  opts: { explanation?: string; misconceptionId?: string } = {},
) {
  return createQuestion(owner, quizId, {
    type: "mcq",
    prompt: "Chọn đáp án đúng.",
    explanation: opts.explanation,
    options: [
      { label: "Đúng", isCorrect: true },
      { label: "Gần đúng", isCorrect: false, misconceptionId: opts.misconceptionId ?? null },
      { label: "Sai", isCorrect: false },
    ],
  });
}

async function makeMisconception(code: string) {
  return prisma.misconception.create({ data: { code, name: code, description: "d" } });
}

describe("getPersonalizationReadiness — khoá bán", () => {
  it("khoá chưa có giá, gói hay mã: không phải khoá bán", async () => {
    const { owner, courseId } = await makeCourse("rd-sale-0");
    const r = await getPersonalizationReadiness(owner, courseId);
    expect(r.forSale).toBe(false);
  });

  it("có đơn giá > 0 → khoá bán", async () => {
    const { owner, courseId } = await makeCourse("rd-sale-1");
    await prisma.course.update({ where: { id: courseId }, data: { priceCents: 199_000, currency: "VND" } });
    expect((await getPersonalizationReadiness(owner, courseId)).forSale).toBe(true);
  });

  it("có gói truy cập đang bán → khoá bán; gói đã ẩn thì không", async () => {
    const { owner, courseId } = await makeCourse("rd-sale-2");
    const plan = await prisma.courseAccessPlan.create({
      data: { courseId, label: "1 năm", durationMonths: 12, priceCents: 99_000, currency: "VND", isActive: false, createdBy: owner },
    });
    expect((await getPersonalizationReadiness(owner, courseId)).forSale).toBe(false);
    await prisma.courseAccessPlan.update({ where: { id: plan.id }, data: { isActive: true } });
    expect((await getPersonalizationReadiness(owner, courseId)).forSale).toBe(true);
  });

  it("có mã kích hoạt chưa thu hồi → khoá bán; chỉ còn mã đã thu hồi thì không", async () => {
    const { owner, courseId } = await makeCourse("rd-sale-3");
    await prisma.courseAccessCode.create({ data: { courseId, code: "RD3A-AAAA-AAAA", createdBy: owner, status: "revoked" } });
    expect((await getPersonalizationReadiness(owner, courseId)).forSale).toBe(false);
    await prisma.courseAccessCode.create({ data: { courseId, code: "RD3B-AAAA-AAAA", createdBy: owner, status: "unused" } });
    expect((await getPersonalizationReadiness(owner, courseId)).forSale).toBe(true);
  });
});

describe("getPersonalizationReadiness — khoá tắt cá nhân hoá", () => {
  it("không có bảng (enabled=false, không bài, không quiz độc lập) nhưng vẫn báo khoá bán", async () => {
    const { owner, courseId, moduleId } = await makeCourse("rd-off", false);
    const { lessonId } = await createLesson(owner, moduleId, { title: "Bài 1", orderIndex: 0 });
    await createQuiz(owner, { courseId, lessonId }, { title: "Q" });
    await prisma.course.update({ where: { id: courseId }, data: { priceCents: 50_000, currency: "VND" } });
    const r = await getPersonalizationReadiness(owner, courseId);
    expect(r).toMatchObject({ enabled: false, forSale: true, lessons: [], standaloneQuizzes: [] });
  });
});

describe("getPersonalizationReadiness — bảng theo bài", () => {
  it(`đếm quiz, câu, câu có giải thích, đáp án sai đã khai báo nhầm lẫn; thin khi < ${READINESS_MIN_QUESTIONS} câu`, async () => {
    const { owner, courseId, moduleId } = await makeCourse("rd-rows");
    const mc = await makeMisconception("rd-rows.mc1");

    // Bài 1: đủ dữ liệu — 3 câu, 2 có giải thích, 1 đáp án sai khai báo nhầm lẫn
    const l1 = await createLesson(owner, moduleId, { title: "Bài 1", orderIndex: 0 });
    const q1 = await createQuiz(owner, { courseId, lessonId: l1.lessonId }, { title: "Quiz 1" });
    await addQuestion(owner, q1.quizId, { explanation: "Giải thích A", misconceptionId: mc.id });
    await addQuestion(owner, q1.quizId, { explanation: "Giải thích B" });
    await addQuestion(owner, q1.quizId);

    // Bài 2: không có quiz
    await createLesson(owner, moduleId, { title: "Bài 2", orderIndex: 1 });

    // Bài 3: quiz chỉ 2 câu
    const l3 = await createLesson(owner, moduleId, { title: "Bài 3", orderIndex: 2 });
    const q3 = await createQuiz(owner, { courseId, lessonId: l3.lessonId }, { title: "Quiz 3" });
    await addQuestion(owner, q3.quizId, { explanation: "  " }); // chỉ khoảng trắng: không tính là có giải thích
    await addQuestion(owner, q3.quizId);

    const r = await getPersonalizationReadiness(owner, courseId);
    expect(r.enabled).toBe(true);
    expect(r.lessons.map((l) => l.title)).toEqual(["Bài 1", "Bài 2", "Bài 3"]);
    expect(r.lessons[0]).toMatchObject({
      moduleTitle: "Chương 1", quizCount: 1, questionCount: 3, explainedCount: 2, misconceptionCount: 1, thin: false,
    });
    expect(r.lessons[1]).toMatchObject({ quizCount: 0, questionCount: 0, explainedCount: 0, misconceptionCount: 0, thin: true });
    expect(r.lessons[2]).toMatchObject({ quizCount: 1, questionCount: 2, explainedCount: 0, misconceptionCount: 0, thin: true });
  });

  it("nhiều quiz trong một bài cộng dồn; quiz ẩn không tính", async () => {
    const { owner, courseId, moduleId } = await makeCourse("rd-multi");
    const l = await createLesson(owner, moduleId, { title: "Bài 1", orderIndex: 0 });
    const a = await createQuiz(owner, { courseId, lessonId: l.lessonId }, { title: "A" });
    const b = await createQuiz(owner, { courseId, lessonId: l.lessonId }, { title: "B" });
    const hidden = await createQuiz(owner, { courseId, lessonId: l.lessonId }, { title: "Ẩn" });
    await addQuestion(owner, a.quizId);
    await addQuestion(owner, a.quizId);
    await addQuestion(owner, b.quizId);
    await addQuestion(owner, hidden.quizId);
    await prisma.quiz.update({ where: { id: hidden.quizId }, data: { isHidden: true } });

    const [row] = (await getPersonalizationReadiness(owner, courseId)).lessons;
    expect(row).toMatchObject({ quizCount: 2, questionCount: 3, thin: false });
  });

  it("quiz độc lập (không gắn bài) có danh sách riêng và không được tính vào bài nào", async () => {
    const { owner, courseId, moduleId } = await makeCourse("rd-standalone");
    await createLesson(owner, moduleId, { title: "Bài 1", orderIndex: 0 });
    const s = await createQuiz(owner, { courseId }, { title: "Ôn tập cuối khoá" });
    await addQuestion(owner, s.quizId);
    await addQuestion(owner, s.quizId);

    const r = await getPersonalizationReadiness(owner, courseId);
    expect(r.standaloneQuizzes).toEqual([{ quizId: s.quizId, title: "Ôn tập cuối khoá", questionCount: 2 }]);
    expect(r.lessons[0]).toMatchObject({ quizCount: 0, questionCount: 0 });
  });

  it("quiz của khoá khác không lẫn vào", async () => {
    const a = await makeCourse("rd-iso-a");
    const b = await makeCourse("rd-iso-b");
    const lb = await createLesson(b.owner, b.moduleId, { title: "B1", orderIndex: 0 });
    const qb = await createQuiz(b.owner, { courseId: b.courseId, lessonId: lb.lessonId }, { title: "QB" });
    await addQuestion(b.owner, qb.quizId);
    const r = await getPersonalizationReadiness(a.owner, a.courseId);
    expect(r.lessons).toEqual([]);
    expect(r.standaloneQuizzes).toEqual([]);
  });
});

describe("getPersonalizationReadiness — quyền", () => {
  it("người không sửa được khoá bị từ chối", async () => {
    const { courseId } = await makeCourse("rd-authz");
    const stranger = await makeUser("rd-authz-stranger@e.com");
    await expect(getPersonalizationReadiness(stranger, courseId)).rejects.toBeInstanceOf(CourseAuthzError);
  });
});
