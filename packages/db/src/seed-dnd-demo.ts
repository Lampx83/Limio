/**
 * Seed demo: thêm 1 câu `ordering` và 1 câu `matching` vào quiz đầu tiên của
 * course "dai-so-co-ban" (do seed-sample-course tạo) để verify drag-and-drop UI.
 * Tạo sẵn 1 attempt in_progress cho Alice để mở thẳng được URL learner.
 * Idempotent.
 */
import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient();
const COURSE_SLUG = "dai-so-co-ban";
const INSTRUCTOR_EMAIL = "alice@feedbackme.dev";
const SKILL_CODE = "math.algebra.linear_eq";

async function main() {
  const course = await prisma.course.findFirst({
    where: { slug: COURSE_SLUG },
    include: { modules: { include: { lessons: { include: { quizzes: true } } } } },
  });
  if (!course) throw new Error(`Run seed:sample-course first (course ${COURSE_SLUG} not found)`);

  let quiz: { id: string } | undefined;
  for (const m of course.modules) for (const l of m.lessons) for (const q of l.quizzes) { quiz = q; break; }
  if (!quiz) throw new Error("No quiz found under course; nothing to attach to");

  const skill = await prisma.skill.upsert({
    where: { code: SKILL_CODE },
    update: {},
    create: { code: SKILL_CODE, name: "Phương trình bậc 1", description: "Linear equations skill (demo)" },
  });

  const existing = await prisma.quizQuestion.findMany({ where: { quizId: quiz.id } });
  const maxIdx = existing.reduce((m, q) => Math.max(m, q.orderIndex), -1);
  const hasOrdering = existing.some((q) => q.type === "ordering");
  const hasMatching = existing.some((q) => q.type === "matching");

  if (!hasOrdering) {
    const q = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        type: "ordering",
        prompt: "Sắp xếp các bước giải phương trình 2x + 3 = 11 theo đúng thứ tự.",
        explanation: "Trừ 3 hai vế → chia 2 hai vế → ra nghiệm.",
        points: 2,
        orderIndex: maxIdx + 1,
        options: {
          create: [
            { label: "Trừ 3 hai vế: 2x = 8", isCorrect: false, orderIndex: 0 },
            { label: "Chia 2 hai vế: x = 4", isCorrect: false, orderIndex: 1 },
            { label: "Kết luận: x = 4", isCorrect: false, orderIndex: 2 },
          ],
        },
      },
    });
    await prisma.questionSkillTag.create({ data: { questionId: q.id, skillId: skill.id } });
    console.log("✓ ordering question created", q.id);
  } else {
    console.log("• ordering question already exists, skipping");
  }

  if (!hasMatching) {
    const q = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        type: "matching",
        prompt: "Ghép mỗi phương trình với nghiệm của nó.",
        explanation: "Giải từng phương trình để tìm nghiệm.",
        points: 3,
        orderIndex: maxIdx + 2,
        options: {
          create: [
            { label: "x + 5 = 12", isCorrect: false, orderIndex: 0, extra: { side: "left", pairKey: "p1" } },
            { label: "2x = 10",    isCorrect: false, orderIndex: 1, extra: { side: "left", pairKey: "p2" } },
            { label: "x - 4 = -1", isCorrect: false, orderIndex: 2, extra: { side: "left", pairKey: "p3" } },
            { label: "x = 7", isCorrect: false, orderIndex: 3, extra: { side: "right", pairKey: "p1" } },
            { label: "x = 5", isCorrect: false, orderIndex: 4, extra: { side: "right", pairKey: "p2" } },
            { label: "x = 3", isCorrect: false, orderIndex: 5, extra: { side: "right", pairKey: "p3" } },
          ],
        },
      },
    });
    await prisma.questionSkillTag.create({ data: { questionId: q.id, skillId: skill.id } });
    console.log("✓ matching question created", q.id);
  } else {
    console.log("• matching question already exists, skipping");
  }

  const alice = await prisma.user.findUnique({ where: { email: INSTRUCTOR_EMAIL } });
  if (!alice) throw new Error("Alice user not found");

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: alice.id, courseId: course.id } },
    update: {},
    create: { userId: alice.id, courseId: course.id, courseVersion: 1 },
  });

  const existingAttempt = await prisma.quizAttempt.findFirst({
    where: { userId: alice.id, quizId: quiz.id, status: "in_progress" },
  });
  const attemptId =
    existingAttempt?.id ??
    (await prisma.quizAttempt.create({
      data: { userId: alice.id, quizId: quiz.id, status: "in_progress" },
    })).id;

  console.log("\n=== Open in browser (Alice already logged in) ===");
  console.log(`  /learn/${COURSE_SLUG}/quizzes/${quiz.id}?attemptId=${attemptId}`);
  console.log(`  attemptId: ${attemptId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
