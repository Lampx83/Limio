/**
 * Seed a published IELTS-style exam on the dai-so-co-ban sample course so the
 * UI runtime can be exercised end-to-end. Idempotent: skips if an exam with
 * the same title already exists.
 */
import { PrismaClient } from "./generated/client/index.js";

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findUnique({
    where: { slug: "dai-so-co-ban" },
  });
  if (!course) {
    console.error("Run seed:sample-course first.");
    process.exit(1);
  }
  const owner = await prisma.user.findFirstOrThrow({
    where: { email: "alice@feedbackme.dev" },
  });

  const existing = await prisma.exam.findFirst({
    where: { courseId: course.id, title: "Bài thi mẫu: Hiểu phương trình" },
  });
  if (existing) {
    console.log("Sample exam already seeded:", existing.id);
    console.log(`Open: /learn/dai-so-co-ban/exams/${existing.id}`);
    return;
  }

  const skill = await prisma.skill.upsert({
    where: { code: "algebra.linear.reading" },
    update: {},
    create: {
      code: "algebra.linear.reading",
      name: "Đọc hiểu bài toán đại số",
    },
  });

  const now = new Date();
  const exam = await prisma.exam.create({
    data: {
      courseId: course.id,
      title: "Bài thi mẫu: Hiểu phương trình",
      description: "Đọc đoạn văn và trả lời câu hỏi.",
      durationMin: 20,
      openAt: new Date(now.getTime() - 60_000),
      closeAt: new Date(now.getTime() + 365 * 24 * 60 * 60_000),
      passScore: 50,
    },
  });

  const passage = await prisma.examPassage.create({
    data: {
      examId: exam.id,
      title: "Đoạn 1: Khái niệm phương trình bậc 1",
      orderIndex: 0,
      contentJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Phương trình bậc 1 ẩn x có dạng tổng quát ax + b = 0, với a khác 0. Nghiệm duy nhất là x = -b/a.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Khi chuyển vế một số hạng, ta đổi dấu của số hạng đó. Đây là một trong các quy tắc cơ bản để giải phương trình.",
              },
            ],
          },
        ],
      },
    },
  });
  await prisma.examPassageSkillTag.create({
    data: { passageId: passage.id, skillId: skill.id },
  });

  const q1 = await prisma.examQuestion.create({
    data: {
      examId: exam.id,
      passageId: passage.id,
      type: "mcq",
      prompt: "Nghiệm của phương trình ax + b = 0 (a ≠ 0) là:",
      config: {
        options: [
          { id: "a", label: "x = b/a", isCorrect: false },
          { id: "b", label: "x = -b/a", isCorrect: true },
          { id: "c", label: "x = a/b", isCorrect: false },
          { id: "d", label: "x = -a/b", isCorrect: false },
        ],
      },
      points: 5,
      orderInExam: 0,
      orderInPassage: 0,
    },
  });
  await prisma.examQuestionSkillTag.create({
    data: { questionId: q1.id, skillId: skill.id },
  });

  const q2 = await prisma.examQuestion.create({
    data: {
      examId: exam.id,
      passageId: passage.id,
      type: "true_false_notgiven",
      prompt: "Phương trình bậc 1 luôn có đúng 1 nghiệm.",
      config: { correct: "true" },
      points: 3,
      orderInExam: 1,
      orderInPassage: 1,
    },
  });
  await prisma.examQuestionSkillTag.create({
    data: { questionId: q2.id, skillId: skill.id },
  });

  const q3 = await prisma.examQuestion.create({
    data: {
      examId: exam.id,
      passageId: passage.id,
      type: "gap_fill",
      prompt: "Khi chuyển vế một số hạng, ta đổi ___ của số hạng đó.",
      config: {
        blanks: [
          {
            id: "b1",
            acceptedAnswers: ["dấu"],
            matchMode: "case_insensitive",
          },
        ],
      },
      points: 2,
      orderInExam: 2,
      orderInPassage: 2,
    },
  });
  await prisma.examQuestionSkillTag.create({
    data: { questionId: q3.id, skillId: skill.id },
  });

  const q4 = await prisma.examQuestion.create({
    data: {
      examId: exam.id,
      type: "essay",
      prompt: "Trình bày các bước giải phương trình bậc 1 ẩn x.",
      config: { rubric: "Đầy đủ 3 bước: chuyển vế, gộp, chia." },
      points: 10,
      orderInExam: 3,
    },
  });
  await prisma.examQuestionSkillTag.create({
    data: { questionId: q4.id, skillId: skill.id },
  });

  await prisma.exam.update({
    where: { id: exam.id },
    data: { status: "published", publishedAt: now },
  });

  console.log("✓ Sample exam ready");
  console.log(`  Course: ${course.slug}`);
  console.log(`  Exam ID: ${exam.id}`);
  console.log(`  Owner (instructor): alice@feedbackme.dev`);
  console.log(`  Open: /learn/${course.slug}/exams/${exam.id}`);
  console.log(`  Total points: 20`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
