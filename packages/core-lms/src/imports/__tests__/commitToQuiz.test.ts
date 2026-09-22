import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createQuiz } from "../../quizzes/quizzes";
import { aiQuestionsToParseResult } from "../aiQuestionRows";
import { commitMcqRowsToQuiz } from "../commitToQuiz";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `commit-quiz-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `commit-quiz-course-${slug}`,
  });
  const quiz = await createQuiz(owner.userId, { courseId: course.courseId }, { title: "Q" });
  return { ownerId: owner.userId, quizId: quiz.quizId };
}

describe("commitMcqRowsToQuiz — ordering/matching (Đợt sau đợt 1: mở rộng Nhập bằng AI)", () => {
  it("ordering: tạo QuizQuestion type=ordering, options giữ đúng thứ tự (orderIndex = thứ tự mảng)", async () => {
    const { ownerId, quizId } = await setup("ordering");
    const { rows } = aiQuestionsToParseResult([
      {
        type: "ordering",
        prompt: "Sắp xếp thành câu đúng",
        items: [{ label: "邮局" }, { label: "我" }, { label: "去" }],
        explanation: null,
        topic: null,
      },
    ]);
    const r = await commitMcqRowsToQuiz(ownerId, quizId, rows);
    expect(r).toEqual({ created: 1, errors: [] });

    const q = await prisma.quizQuestion.findFirstOrThrow({
      where: { quizId },
      include: { options: { orderBy: { orderIndex: "asc" } } },
    });
    expect(q.type).toBe("ordering");
    expect(q.options.map((o) => o.label)).toEqual(["邮局", "我", "去"]);
  });

  it("matching: tạo QuizQuestion type=matching, mỗi cặp ra 2 option side=left/right cùng pairKey", async () => {
    const { ownerId, quizId } = await setup("matching");
    const { rows } = aiQuestionsToParseResult([
      {
        type: "matching",
        prompt: "Ghép từ Hán với nghĩa tiếng Việt",
        pairs: [
          { left: "寄", right: "gửi" },
          { left: "包裹", right: "bưu kiện" },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    const r = await commitMcqRowsToQuiz(ownerId, quizId, rows);
    expect(r).toEqual({ created: 1, errors: [] });

    const q = await prisma.quizQuestion.findFirstOrThrow({
      where: { quizId },
      include: { options: true },
    });
    expect(q.type).toBe("matching");
    expect(q.options).toHaveLength(4); // 2 cặp × 2 vế
    const lefts = q.options.filter((o) => (o.extra as { side?: string })?.side === "left");
    const rights = q.options.filter((o) => (o.extra as { side?: string })?.side === "right");
    expect(lefts.map((o) => o.label).sort()).toEqual(["寄", "包裹"].sort());
    expect(rights.map((o) => o.label).sort()).toEqual(["gửi", "bưu kiện"].sort());
    // Mỗi cặp: vế trái và vế phải phải cùng pairKey để chấm đúng (xem quizzes/grading.ts).
    for (const l of lefts) {
      const pairKey = (l.extra as { pairKey?: string }).pairKey;
      const partner = rights.find((r2) => (r2.extra as { pairKey?: string }).pairKey === pairKey);
      expect(partner).toBeDefined();
    }
  });

  it("fill_in: tạo QuizQuestion type=fill_in, mọi đáp án chấp nhận đều isCorrect=true", async () => {
    const { ownerId, quizId } = await setup("fillin");
    const { rows } = aiQuestionsToParseResult([
      {
        type: "fill_in",
        prompt: "我明天＿＿上海。",
        acceptedAnswers: ["去", "qù"],
        explanation: null,
        topic: null,
      },
    ]);
    const r = await commitMcqRowsToQuiz(ownerId, quizId, rows);
    expect(r).toEqual({ created: 1, errors: [] });

    const q = await prisma.quizQuestion.findFirstOrThrow({
      where: { quizId },
      include: { options: true },
    });
    expect(q.type).toBe("fill_in");
    expect(q.options.every((o) => o.isCorrect)).toBe(true);
    expect(q.options.map((o) => o.label).sort()).toEqual(["去", "qù"].sort());
  });

  it("trộn mcq + ordering + matching + fill_in: cả 4 đều tạo được trong cùng quiz", async () => {
    const { ownerId, quizId } = await setup("mixed");
    const { rows } = aiQuestionsToParseResult([
      {
        type: "mcq",
        prompt: "Câu mcq",
        options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: false }],
        explanation: null,
        topic: null,
      },
      { type: "ordering", prompt: "Câu ordering", items: [{ label: "a" }, { label: "b" }], explanation: null, topic: null },
      {
        type: "matching",
        prompt: "Câu matching",
        pairs: [{ left: "a", right: "x" }, { left: "b", right: "y" }],
        explanation: null,
        topic: null,
      },
      { type: "fill_in", prompt: "Câu fill_in ＿＿", acceptedAnswers: ["x"], explanation: null, topic: null },
    ]);
    const r = await commitMcqRowsToQuiz(ownerId, quizId, rows);
    expect(r).toEqual({ created: 4, errors: [] });
    const types = (await prisma.quizQuestion.findMany({ where: { quizId }, select: { type: true } }))
      .map((q) => q.type)
      .sort();
    expect(types).toEqual(["mcq", "matching", "ordering", "fill_in"].sort());
  });
});
