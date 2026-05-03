/**
 * Seed a demo published course end-to-end:
 *   - One instructor user (alice@feedbackme.dev / password1234)
 *   - 3 skills (math.algebra.basics, math.algebra.linear_eq, math.algebra.quadratic)
 *   - One course "Đại số cơ bản" with 2 modules, 4 lessons, mixed content types
 *   - All lessons skill-tagged
 *   - Course published
 *
 * Idempotent: safe to run repeatedly. Each run skips entities that already exist by slug/email/code.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { RoleName } from "@feedbackme/shared-types";

const prisma = new PrismaClient();

const INSTRUCTOR_EMAIL = "alice@feedbackme.dev";
const INSTRUCTOR_PASSWORD = "password1234";
const COURSE_SLUG = "dai-so-co-ban";

async function ensureRoles() {
  for (const name of Object.values(RoleName)) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
}

async function ensureInstructor() {
  const existing = await prisma.user.findUnique({ where: { email: INSTRUCTOR_EMAIL } });
  if (existing) return existing.id;
  const passwordHash = await bcrypt.hash(INSTRUCTOR_PASSWORD, 12);
  const learnerRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.Learner } });
  const instructorRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.Instructor } });
  const user = await prisma.user.create({
    data: {
      email: INSTRUCTOR_EMAIL,
      passwordHash,
      displayName: "Alice (Demo Instructor)",
      emailVerifiedAt: new Date(),
      authProviders: { create: { provider: "password", providerUserId: INSTRUCTOR_EMAIL } },
      userRoles: { create: [{ roleId: learnerRole.id }, { roleId: instructorRole.id }] },
    },
  });
  console.log(`Created instructor user: ${INSTRUCTOR_EMAIL} / ${INSTRUCTOR_PASSWORD}`);
  return user.id;
}

async function ensureSkill(code: string, name: string) {
  return prisma.skill.upsert({
    where: { code },
    update: {},
    create: { code, name },
  });
}

async function main() {
  await ensureRoles();
  const ownerId = await ensureInstructor();

  if (await prisma.course.findUnique({ where: { slug: COURSE_SLUG } })) {
    console.log(`Course "${COURSE_SLUG}" already exists. Skipping.`);
    return;
  }

  const skills = await Promise.all([
    ensureSkill("math.algebra.basics", "Đại số cơ bản"),
    ensureSkill("math.algebra.linear_eq", "Phương trình bậc 1"),
    ensureSkill("math.algebra.quadratic", "Phương trình bậc 2"),
  ]);

  const course = await prisma.course.create({
    data: {
      slug: COURSE_SLUG,
      title: "Đại số cơ bản",
      description:
        "Khóa học giới thiệu đại số cho học sinh trung học: số, biến, phương trình bậc 1 và bậc 2.",
      language: "vi",
      level: "beginner",
      category: "math",
      status: "published",
      publishedAt: new Date(),
      instructors: { create: { userId: ownerId, role: "owner" } },
      modules: {
        create: [
          {
            orderIndex: 0,
            title: "Module 1 — Khái niệm cơ bản",
            lessons: {
              create: [
                {
                  orderIndex: 0,
                  title: "Số và biến",
                  contentItems: {
                    create: [
                      {
                        orderIndex: 0,
                        type: "markdown",
                        payload: {
                          body: "# Số và biến\n\nBài học giới thiệu khái niệm biến trong đại số.",
                        },
                      },
                    ],
                  },
                },
                {
                  orderIndex: 1,
                  title: "Phép toán",
                  contentItems: {
                    create: [
                      {
                        orderIndex: 0,
                        type: "video",
                        payload: { url: "https://demo.example.com/video1.mp4", durationSec: 480 },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            orderIndex: 1,
            title: "Module 2 — Phương trình",
            lessons: {
              create: [
                {
                  orderIndex: 0,
                  title: "Phương trình bậc 1",
                  contentItems: {
                    create: [
                      {
                        orderIndex: 0,
                        type: "markdown",
                        payload: { body: "Định nghĩa và cách giải phương trình bậc 1." },
                      },
                      {
                        orderIndex: 1,
                        type: "external_link",
                        payload: {
                          url: "https://wikipedia.org/wiki/Linear_equation",
                          title: "Wikipedia: Linear equation",
                        },
                      },
                    ],
                  },
                },
                {
                  orderIndex: 1,
                  title: "Phương trình bậc 2",
                  contentItems: {
                    create: [
                      {
                        orderIndex: 0,
                        type: "video",
                        payload: { url: "https://demo.example.com/video2.mp4", durationSec: 600 },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { lessons: true } } },
  });

  // Tag skills on lessons.
  const allLessons = course.modules.flatMap((m) => m.lessons);
  // Lesson "Số và biến" → basics
  // Lesson "Phép toán" → basics
  // Lesson "Phương trình bậc 1" → linear_eq
  // Lesson "Phương trình bậc 2" → quadratic
  const tags: Array<{ lessonTitle: string; skillCode: string }> = [
    { lessonTitle: "Số và biến", skillCode: "math.algebra.basics" },
    { lessonTitle: "Phép toán", skillCode: "math.algebra.basics" },
    { lessonTitle: "Phương trình bậc 1", skillCode: "math.algebra.linear_eq" },
    { lessonTitle: "Phương trình bậc 2", skillCode: "math.algebra.quadratic" },
  ];
  for (const t of tags) {
    const lesson = allLessons.find((l) => l.title === t.lessonTitle)!;
    const skill = skills.find((s) => s.code === t.skillCode)!;
    await prisma.contentSkillMapping.create({
      data: { contentType: "lesson", contentId: lesson.id, skillId: skill.id },
    });
  }

  // Create a misconception + a quiz on the "Phương trình bậc 1" lesson.
  const misconception = await prisma.misconception.upsert({
    where: { code: "wrong_sign_when_moving_terms" },
    update: {},
    create: {
      code: "wrong_sign_when_moving_terms",
      name: "Sai dấu khi chuyển vế",
      description:
        "Học viên quên đảo dấu khi chuyển một số hạng từ vế này sang vế kia của phương trình.",
    },
  });

  const linearLesson = allLessons.find((l) => l.title === "Phương trình bậc 1")!;
  const linearSkill = skills.find((s) => s.code === "math.algebra.linear_eq")!;

  const quiz = await prisma.quiz.create({
    data: {
      courseId: course.id,
      lessonId: linearLesson.id,
      title: "Quiz: Phương trình bậc 1",
      description: "Kiểm tra nhanh sau bài học về phương trình bậc 1.",
      difficulty: 2,
      passThresholdPct: 70,
      timeLimitSec: 600,
      maxAttempts: 3,
      requireConfidence: true,
      questions: {
        create: [
          {
            type: "true_false",
            prompt: "Phương trình 2x + 3 = 7 có nghiệm x = 2.",
            explanation: "Đúng. Trừ 3 hai vế: 2x = 4 → x = 2.",
            points: 1,
            orderIndex: 0,
            options: {
              create: [
                { label: "Đúng", isCorrect: true, orderIndex: 0 },
                { label: "Sai", isCorrect: false, orderIndex: 1 },
              ],
            },
          },
          {
            // MCQ with a wrong answer tagged with misconception.
            type: "mcq",
            prompt: "Giải phương trình: x + 5 = 12. Chọn đáp án đúng.",
            explanation: "Trừ 5 hai vế: x = 12 - 5 = 7.",
            points: 2,
            orderIndex: 1,
            options: {
              create: [
                { label: "x = 7", isCorrect: true, orderIndex: 0 },
                {
                  label: "x = 17",
                  isCorrect: false,
                  orderIndex: 1,
                  misconceptionId: misconception.id,
                },
                { label: "x = -7", isCorrect: false, orderIndex: 2 },
                { label: "x = 12", isCorrect: false, orderIndex: 3 },
              ],
            },
          },
          {
            type: "fill_in",
            prompt: "Nghiệm của phương trình 3x = 9 là x = ?",
            explanation: "Chia 3 hai vế: x = 3.",
            points: 1,
            orderIndex: 2,
            options: {
              create: [
                { label: "3", isCorrect: true, orderIndex: 0 },
                { label: "ba", isCorrect: true, orderIndex: 1 },
              ],
            },
          },
        ],
      },
    },
    include: { questions: true },
  });

  // Tag all questions with the linear_eq skill.
  await prisma.questionSkillTag.createMany({
    data: quiz.questions.map((q) => ({ questionId: q.id, skillId: linearSkill.id })),
    skipDuplicates: true,
  });

  console.log(`Created published course: /catalog/${COURSE_SLUG}`);
  console.log(`Owner: ${INSTRUCTOR_EMAIL} / ${INSTRUCTOR_PASSWORD}`);
  console.log(`Quiz created with 3 questions on the "Phương trình bậc 1" lesson.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
