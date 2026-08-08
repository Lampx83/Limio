/**
 * Seed end-to-end demo activity so instructor hubs have data to render:
 *   - 6 demo learners (existing + new ones)
 *   - Skill tags on every lesson + the seeded quiz questions
 *   - Course published (since publishCourse requires every lesson skill-tagged)
 *   - 1 quiz with 4 questions (MCQ + numerical + essay), 1 assignment
 *   - Enrollments with varied enrolledAt (some recent, some stale)
 *   - QuizAttempts with mixed correct/incorrect responses (some essays pending)
 *   - LearnerSkillState populated via BKT updater
 *   - AssignmentSubmissions (pending + graded)
 *   - Spread of LearningEvents (lesson.viewed, quiz.completed) over last 30 days
 *   - 2 forum threads (1 resolved, 1 stale)
 *
 * Idempotent — keyed off displayName / quiz title / assignment title.
 * Run after seed-sample-course + seed-demo-users.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/client";
import { RoleName, LearningEventType } from "@feedbackme/shared-types";
import { seedDefaultSectionId } from "./seedHelpers";

const prisma = new PrismaClient();
const PASSWORD = "password1234";

const EXTRA_LEARNERS = [
  "David (Demo Learner)",
  "Emma (Demo Learner)",
  "Frank (Demo Learner — đã chậm)",
  "Grace (Demo Learner — chậm chân)",
];

const QUIZ_TITLE = "Quiz mở đầu — Demo";
const ASSIGNMENT_TITLE = "Bài tập mở đầu — Demo";

const QUESTIONS = [
  {
    type: "mcq" as const,
    prompt: "Kỹ năng nào quan trọng nhất trong giao tiếp công sở?",
    options: [
      { label: "Lắng nghe chủ động", isCorrect: true },
      { label: "Nói thật to", isCorrect: false },
      { label: "Né tránh tranh luận", isCorrect: false },
      { label: "Đồng ý mọi điều", isCorrect: false },
    ],
    explanation: "Lắng nghe chủ động cho phép hiểu đúng và đáp ứng phù hợp.",
  },
  {
    type: "mcq" as const,
    prompt: "Khi conflict tại lớp, bước đầu tiên nên làm là?",
    options: [
      { label: "Tìm hiểu góc nhìn của các bên", isCorrect: true },
      { label: "Phán xét ai sai", isCorrect: false },
      { label: "Phớt lờ và đi tiếp", isCorrect: false },
      { label: "Báo lên trưởng nhóm ngay", isCorrect: false },
    ],
    explanation: "Hiểu trước, phán xét sau.",
  },
  {
    type: "numerical" as const,
    prompt: "Theo bài học, một cuộc họp hiệu quả không nên dài quá bao nhiêu phút?",
    expected: 45,
    tolerance: 5,
  },
  {
    type: "essay" as const,
    prompt: "Hãy mô tả một tình huống bạn từng giải quyết xung đột bằng giao tiếp tích cực (≥3 câu).",
  },
];

async function ensureLearner(displayName: string): Promise<string> {
  const existing = await prisma.user.findFirst({ where: { displayName } });
  if (existing) return existing.id;
  const email = `${displayName.split(" ")[0]!.toLowerCase()}.demo+${Date.now()}@feedbackme.dev`;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const learnerRole = await prisma.role.findUniqueOrThrow({
    where: { name: RoleName.Learner },
  });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      emailVerifiedAt: new Date(),
      authProviders: { create: { provider: "password", providerUserId: email } },
      userRoles: { create: [{ roleId: learnerRole.id }] },
    },
  });
  console.log(`  + learner ${displayName} (${email})`);
  return user.id;
}

async function ensureLessonSkillTags(courseId: string, skillIds: string[]) {
  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true },
  });
  let created = 0;
  for (const l of lessons) {
    const existing = await prisma.contentSkillMapping.findFirst({
      where: { contentType: "lesson", contentId: l.id },
    });
    if (existing) continue;
    // 1-2 skills per lesson, rotating
    const pickedSkill = skillIds[created % skillIds.length];
    await prisma.contentSkillMapping.create({
      data: {
        contentType: "lesson",
        contentId: l.id,
        skillId: pickedSkill!,
        coverageWeight: 1.0,
      },
    });
    created++;
  }
  if (created > 0) console.log(`  + tagged ${created} lessons with skills`);
}

async function ensureQuiz(lessonId: string, courseId: string, skillIds: string[]) {
  let quiz = await prisma.quiz.findFirst({
    where: { title: QUIZ_TITLE, lessonId },
  });
  if (!quiz) {
    quiz = await prisma.quiz.create({
      data: {
        title: QUIZ_TITLE,
        description: "Quiz demo cho central pending grading + BKT.",
        lessonId,
        courseId,
        passThresholdPct: 70,
        difficulty: 2,
      },
    });
    console.log(`  + quiz "${QUIZ_TITLE}"`);
  }

  const existingQs = await prisma.quizQuestion.count({ where: { quizId: quiz.id } });
  if (existingQs === 0) {
    for (let i = 0; i < QUESTIONS.length; i++) {
      const q = QUESTIONS[i];
      if (!q) continue;
      const created = await prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          type: q.type,
          prompt: q.prompt,
          orderIndex: i,
          points: q.type === "essay" ? 5 : 1,
          explanation: "explanation" in q ? q.explanation : null,
          extra:
            q.type === "numerical"
              ? { expected: q.expected, tolerance: q.tolerance }
              : undefined,
          options:
            q.type === "mcq"
              ? {
                  create: q.options.map((o, idx) => ({
                    label: o.label,
                    isCorrect: o.isCorrect,
                    orderIndex: idx,
                  })),
                }
              : undefined,
          skillTags: {
            create: [{ skillId: skillIds[i % skillIds.length]!, weight: 1.0 }],
          },
        },
      });
      void created;
    }
    console.log(`  + ${QUESTIONS.length} quiz questions (tagged with skills)`);
  }
  return quiz;
}

async function ensureAssignment(lessonId: string) {
  const existing = await prisma.assignment.findFirst({
    where: { title: ASSIGNMENT_TITLE, lessonId },
  });
  if (existing) return existing;
  const a = await prisma.assignment.create({
    data: {
      lessonId,
      title: ASSIGNMENT_TITLE,
      description: "Viết một đoạn 200 từ về kỹ năng giao tiếp bạn muốn cải thiện.",
      dueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      maxScore: 100,
    },
  });
  console.log(`  + assignment "${ASSIGNMENT_TITLE}"`);
  return a;
}

async function publishCourseIfDraft(courseId: string) {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  if (course.status === "published") return;
  await prisma.course.update({
    where: { id: courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  console.log(`  + course published`);
}

async function ensureEnrollment(
  userId: string,
  courseId: string,
  daysAgo: number,
): Promise<{ created: boolean }> {
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return { created: false };
  const sectionId = await seedDefaultSectionId(courseId, prisma);
  await prisma.enrollment.create({
    data: {
      userId,
      courseId,
      sectionId,
      courseVersion: 1,
      enrolledAt: new Date(Date.now() - daysAgo * 24 * 3600 * 1000),
    },
  });
  return { created: true };
}

async function emitEvent(
  userId: string,
  eventType: string,
  daysAgo: number,
  payload: Record<string, unknown>,
  courseId: string,
) {
  const eventKey = `demo-seed:${userId}:${eventType}:${daysAgo}:${JSON.stringify(payload).slice(0, 50)}`;
  const existing = await prisma.learningEvent.findUnique({ where: { eventKey } });
  if (existing) return;
  await prisma.learningEvent.create({
    data: {
      eventKey,
      userId,
      eventType,
      courseId,
      payload: payload as object,
      occurredAt: new Date(Date.now() - daysAgo * 24 * 3600 * 1000),
    },
  });
}

async function seedAttemptAndAnswers(
  userId: string,
  quiz: { id: string },
  correctness: boolean[],
  daysAgo: number,
  includeEssay: "skip" | "pending" | "graded",
) {
  // Skip if learner already has an attempt for this quiz (idempotent).
  const existing = await prisma.quizAttempt.findFirst({
    where: { userId, quizId: quiz.id },
  });
  if (existing) return existing;

  const questions = await prisma.quizQuestion.findMany({
    where: { quizId: quiz.id },
    orderBy: { orderIndex: "asc" },
    include: { options: true },
  });

  const attempt = await prisma.quizAttempt.create({
    data: {
      userId,
      quizId: quiz.id,
      status: "submitted",
      startedAt: new Date(Date.now() - (daysAgo + 0.01) * 24 * 3600 * 1000),
      submittedAt: new Date(Date.now() - daysAgo * 24 * 3600 * 1000),
    },
  });

  let scoredPoints = 0;
  let totalPoints = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q) continue;
    totalPoints += q.points;
    const isEssay = q.type === "essay";
    if (isEssay && includeEssay === "skip") continue;

    let isCorrect = false;
    let response: unknown = "";
    let needsGrading = false;
    let manualScore: number | null = null;

    if (q.type === "mcq") {
      const correctOpt = q.options.find((o) => o.isCorrect)!;
      const wrongOpt = q.options.find((o) => !o.isCorrect)!;
      const wantCorrect = correctness[i] ?? true;
      response = [wantCorrect ? correctOpt.id : wrongOpt.id];
      isCorrect = wantCorrect;
    } else if (q.type === "numerical") {
      const meta = q.extra as { expected: number };
      const wantCorrect = correctness[i] ?? true;
      response = wantCorrect ? meta.expected : meta.expected + 10;
      isCorrect = wantCorrect;
    } else if (q.type === "essay") {
      response =
        "Trong dự án trước, tôi và đồng nghiệp bất đồng về deadline. Tôi đã lắng nghe lý do của họ, đề xuất chia nhỏ task, và cùng thống nhất milestone mới.";
      needsGrading = includeEssay === "pending";
      isCorrect = includeEssay === "graded";
      manualScore = includeEssay === "graded" ? q.points : null;
    }

    if (isCorrect) scoredPoints += q.points;
    if (manualScore !== null) scoredPoints += 0; // already counted above when graded

    await prisma.answerResponse.create({
      data: {
        attemptId: attempt.id,
        questionId: q.id,
        response: response as object,
        isCorrect,
        needsGrading,
        manualScore,
        responseTimeMs: 12_000 + i * 1_500,
        confidence: 3,
        answeredAt: new Date(Date.now() - daysAgo * 24 * 3600 * 1000),
      },
    });
  }

  const scorePct = totalPoints > 0 ? (scoredPoints / totalPoints) * 100 : 0;
  await prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: { scorePct, passed: scorePct >= 70 },
  });
  return attempt;
}

async function runBktForAttempts(userIds: string[]) {
  // Lazy-import to avoid circular workspace deps when running standalone.
  const { updateLearnerStateFromAttempt } = await import(
    "@feedbackme/core-feedback"
  );
  let updated = 0;
  for (const userId of userIds) {
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId, status: "submitted" },
      select: { id: true },
    });
    for (const a of attempts) {
      await updateLearnerStateFromAttempt(userId, a.id);
      updated++;
    }
  }
  if (updated > 0) console.log(`  + ran BKT updater on ${updated} attempts`);
}

async function ensureAssignmentSubmission(
  assignmentId: string,
  userId: string,
  state: "submitted" | "graded",
  daysAgo: number,
) {
  const existing = await prisma.assignmentSubmission.findFirst({
    where: { assignmentId, userId },
  });
  if (existing) return;
  await prisma.assignmentSubmission.create({
    data: {
      assignmentId,
      userId,
      body:
        "Em sẽ cải thiện kỹ năng lắng nghe chủ động bằng cách tóm tắt lại ý người nói trước khi phản hồi…",
      status: state,
      submittedAt: new Date(Date.now() - daysAgo * 24 * 3600 * 1000),
      ...(state === "graded"
        ? { score: 85, feedback: "Tốt, nên thêm ví dụ cụ thể.", gradedAt: new Date() }
        : {}),
    },
  });
}

async function ensureForumThreads(lessonId: string, learnerIds: string[]) {
  const titles = [
    {
      title: "Có ai gợi ý sách về giao tiếp không?",
      daysAgo: 1,
      resolved: false,
      author: learnerIds[0]!,
    },
    {
      title: "Bài tập về xung đột có cần dài 200 từ không?",
      daysAgo: 4,
      resolved: false,
      author: learnerIds[1]!,
    },
    {
      title: "Cách áp dụng lắng nghe chủ động vào meeting công ty?",
      daysAgo: 10,
      resolved: true,
      author: learnerIds[2]!,
    },
  ];

  for (const t of titles) {
    const existing = await prisma.forumThread.findFirst({
      where: { title: t.title, lessonId },
    });
    if (existing) continue;
    const thread = await prisma.forumThread.create({
      data: {
        lessonId,
        authorId: t.author,
        title: t.title,
        body: "Câu hỏi demo cho seed dữ liệu.",
        createdAt: new Date(Date.now() - t.daysAgo * 24 * 3600 * 1000),
      },
    });
    if (t.resolved) {
      // Add a reply + mark it resolved.
      const post = await prisma.forumPost.create({
        data: {
          threadId: thread.id,
          authorId: learnerIds[0]!,
          body: "Mình thường dùng cách paraphrase trước khi phản hồi — rất hữu ích.",
        },
      });
      await prisma.forumThread.update({
        where: { id: thread.id },
        data: { resolvedPostId: post.id },
      });
    }
  }
}

async function main() {
  console.log("Seeding demo activity...");

  const alice = await prisma.user.findUniqueOrThrow({
    where: { email: "alice@feedbackme.dev" },
  });
  const course = await prisma.course.findFirstOrThrow({
    where: { instructors: { some: { userId: alice.id } } },
    include: { modules: { include: { lessons: { orderBy: { orderIndex: "asc" } } } } },
  });
  const firstLesson = course.modules[0]!.lessons[0]!;
  const secondLesson = course.modules[0]!.lessons[1] ?? firstLesson;

  const skills = await prisma.skill.findMany({ take: 3, orderBy: { code: "asc" } });
  if (skills.length < 3) {
    throw new Error("Cần ≥3 skill trong DB (chạy seed-sample-course trước).");
  }
  const skillIds = skills.map((s) => s.id);

  await ensureLessonSkillTags(course.id, skillIds);
  await publishCourseIfDraft(course.id);
  const quiz = await ensureQuiz(firstLesson.id, course.id, skillIds);
  const assignment = await ensureAssignment(secondLesson.id);

  // Learners. Bob + Charlie already exist; add 4 more.
  const bob = await prisma.user.findUniqueOrThrow({
    where: { email: "bob@feedbackme.dev" },
  });
  const charlie = await prisma.user.findUniqueOrThrow({
    where: { email: "charlie@feedbackme.dev" },
  });
  const extraIds: string[] = [];
  for (const name of EXTRA_LEARNERS) {
    extraIds.push(await ensureLearner(name));
  }
  const learnerIds = [bob.id, charlie.id, ...extraIds];

  // Enrollments with mixed enrolledAt.
  const enrollmentDays = [3, 5, 1, 8, 35, 60]; // last two are stale
  for (let i = 0; i < learnerIds.length; i++) {
    await ensureEnrollment(learnerIds[i]!, course.id, enrollmentDays[i]!);
  }

  // Quiz attempts. Vary correctness + essay state per learner.
  const attemptPlans: Array<{
    userId: string;
    correctness: boolean[];
    daysAgo: number;
    essay: "skip" | "pending" | "graded";
  }> = [
    { userId: bob.id, correctness: [true, true, true], daysAgo: 1, essay: "pending" },
    { userId: charlie.id, correctness: [true, false, true], daysAgo: 2, essay: "graded" },
    { userId: extraIds[0]!, correctness: [true, true, false], daysAgo: 3, essay: "pending" },
    { userId: extraIds[1]!, correctness: [false, true, true], daysAgo: 6, essay: "skip" },
    // Frank and Grace are stale — no attempts.
  ];
  for (const p of attemptPlans) {
    await seedAttemptAndAnswers(p.userId, quiz, p.correctness, p.daysAgo, p.essay);
  }

  await runBktForAttempts(attemptPlans.map((p) => p.userId));

  // Assignment submissions: 2 pending, 1 graded.
  await ensureAssignmentSubmission(assignment.id, bob.id, "submitted", 2);
  await ensureAssignmentSubmission(assignment.id, extraIds[0]!, "submitted", 4);
  await ensureAssignmentSubmission(assignment.id, charlie.id, "graded", 5);

  // LearningEvents — recent lesson views from active learners; none from stale ones.
  const activeLearners = [bob.id, charlie.id, extraIds[0]!, extraIds[1]!];
  let eventCount = 0;
  for (const userId of activeLearners) {
    for (const lessonIdx of [0, 1, 2]) {
      const lesson = course.modules[0]!.lessons[lessonIdx];
      if (!lesson) continue;
      await emitEvent(
        userId,
        LearningEventType.LessonViewed,
        Math.floor(Math.random() * 5) + 1,
        { lessonId: lesson.id, courseId: course.id },
        course.id,
      );
      eventCount++;
    }
  }
  console.log(`  + emitted ${eventCount} lesson.viewed events`);

  // Forum threads.
  await ensureForumThreads(firstLesson.id, learnerIds);
  console.log(`  + forum threads ensured`);

  console.log("Demo activity seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
