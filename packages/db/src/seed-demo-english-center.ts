/**
 * seed-demo-english-center.ts
 * ─────────────────────────────────────────────────────────────────────
 * Profile demo "Limio English & Soft Skills Center" cho buổi demo khách
 * hàng. Toàn bộ entity dùng prefix có thể nhận diện để dọn dẹp sau demo:
 *   - User email domain:  *@demo-english.limio.vn
 *   - Course slug prefix: demo-eng-*
 *   - Skill code prefix:  demo.eng.*
 *
 * KHÔNG xóa bất kỳ data nào — toàn bộ là upsert / find-or-create. An
 * toàn chạy nhiều lần.
 *
 * Sau demo, gỡ data bằng:
 *   DELETE FROM "User" WHERE email LIKE '%@demo-english.limio.vn';
 *   DELETE FROM "Course" WHERE slug LIKE 'demo-eng-%';
 *   DELETE FROM "Skill" WHERE code LIKE 'demo.eng.%';
 *   (FK cascade sẽ dọn hầu hết phần còn lại; tournament thì xóa thủ công.)
 *
 * Bảng được populate (≈50/113):
 *   Auth:        User, AuthProvider, Role*, UserRole
 *   Catalog:     Skill, SkillPrerequisite, Course, CourseInstructor,
 *                Module, Lesson, ContentItem, ContentSkillMapping,
 *                Misconception
 *   Learning:    Enrollment, UserCourseProgress, LearningEvent, Note,
 *                LearnerSkillState, MisconceptionFlag
 *   Assessment:  Quiz, QuizQuestion, QuestionOption, QuizAttempt,
 *                AnswerResponse, Assignment, AssignmentSubmission,
 *                QuestionSkillTag
 *   Exam:        Exam, ExamSection, ExamSectionItem, QuestionBank,
 *                BankQuestion, BankQuestionSkillTag, ExamQuestionFromBank
 *   Forum:       ForumThread, ForumPost
 *   Gamif:       XpTransaction, Badge*, UserBadge, StreakRecord,
 *                Quest*, UserQuestProgress, LeaderboardEntry
 *   Feedback:    FeedbackTemplate*, FeedbackDelivery
 *   Tournament:  Tournament, TournamentRegistration, TournamentMission,
 *                MissionSubmission, MissionReviewAssignment,
 *                TournamentRanking, HackathonVote, TournamentJudge
 *   Notif:       (LearningEvent serves as event log; in-app
 *                Notification model is derived at read time from events)
 *
 * Bảng KHÔNG seed (chủ ý — infra hoặc cần config bên ngoài):
 *   SCORM/LTI/H5P/Order, AuditLog, AiConversation/AiMessage/AiUsageLog,
 *   AttemptProctorSnapshot, IntegrationCredential, EmailDispatchBatch,
 *   Organization, ExamSessionTemplate, ClassroomSession, WordCloud,
 *   InteractiveBoard, GroupingSession, TimerTemplate, SystemRelease.
 *
 *   * = đã được seed sẵn ở seed-badges / seed-quests / seed-feedback-templates
 *       / seed.ts (Role) — script này gọi luôn nếu chưa tồn tại để demo có
 *       đủ catalog.
 * ─────────────────────────────────────────────────────────────────────
 */

import bcrypt from "bcryptjs";
import { PrismaClient, Prisma } from "./generated/client";
import { RoleName } from "@feedbackme/shared-types";
import { seedDefaultSectionId } from "./seedHelpers";

const prisma = new PrismaClient();

// ── Cấu hình ────────────────────────────────────────────────────────
const DOMAIN = "demo-english.limio.vn";
const PASSWORD = "demo1234";
const NOW = new Date();
const DAY = 86_400_000;

// ── Helpers ──────────────────────────────────────────────────────────

function offset(days: number, hours = 0): Date {
  return new Date(NOW.getTime() + days * DAY + hours * 3_600_000);
}

async function ensureRoles() {
  for (const name of Object.values(RoleName)) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
}

async function ensureUser(
  email: string,
  displayName: string,
  roleNames: string[],
): Promise<string> {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let u = await prisma.user.findUnique({ where: { email } });
  if (!u) {
    u = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        emailVerifiedAt: new Date(),
        authProviders: {
          create: { provider: "password", providerUserId: email },
        },
      },
    });
  }
  for (const r of roleNames) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: r } });
    const has = await prisma.userRole.findFirst({
      where: { userId: u.id, roleId: role.id },
    });
    if (!has) {
      await prisma.userRole.create({
        data: { userId: u.id, roleId: role.id, grantedBy: u.id },
      });
    }
  }
  return u.id;
}

async function ensureSkill(code: string, name: string, description?: string) {
  return prisma.skill.upsert({
    where: { code },
    update: { name, description },
    create: { code, name, description },
  });
}

async function ensureMisconception(code: string, name: string, desc: string) {
  return prisma.misconception.upsert({
    where: { code },
    update: { name, description: desc },
    create: { code, name, description: desc },
  });
}

async function emitEvent(
  userId: string,
  eventType: string,
  payload: Prisma.InputJsonValue,
  courseId: string | null,
  occurredAt: Date,
  eventKey?: string,
) {
  if (eventKey) {
    const existing = await prisma.learningEvent.findUnique({ where: { eventKey } });
    if (existing) return;
  }
  await prisma.learningEvent.create({
    data: { userId, eventType, payload, courseId, occurredAt, eventKey },
  });
}

// ────────────────────────────────────────────────────────────────────
// 1. Skills catalog (English + Soft skills)
// ────────────────────────────────────────────────────────────────────

async function seedSkills() {
  const skills = await Promise.all([
    ensureSkill("demo.eng.listening.b1", "Listening B1", "Nghe hiểu mức B1 CEFR"),
    ensureSkill("demo.eng.listening.b2", "Listening B2", "Nghe hiểu mức B2 CEFR"),
    ensureSkill("demo.eng.speaking.b1", "Speaking B1", "Nói lưu loát mức B1"),
    ensureSkill("demo.eng.speaking.b2", "Speaking B2", "Nói lưu loát mức B2"),
    ensureSkill("demo.eng.writing.b1", "Writing B1", "Viết câu/đoạn mạch lạc"),
    ensureSkill("demo.eng.grammar.tenses", "Grammar — Tenses", "Thì động từ"),
    ensureSkill("demo.eng.vocab.business", "Business vocabulary", "Từ vựng công sở"),
    ensureSkill("demo.soft.communication", "Communication", "Giao tiếp đa kênh"),
    ensureSkill("demo.soft.public_speaking", "Public Speaking", "Thuyết trình trước đám đông"),
    ensureSkill("demo.soft.critical_thinking", "Critical Thinking", "Tư duy phản biện"),
    ensureSkill("demo.soft.teamwork", "Teamwork", "Làm việc nhóm"),
  ]);

  // Prerequisite: Listening B2 depends on B1; Speaking B2 depends on B1.
  const byCode = new Map(skills.map((s) => [s.code, s.id]));
  const prereqs: Array<[string, string]> = [
    ["demo.eng.listening.b1", "demo.eng.listening.b2"],
    ["demo.eng.speaking.b1", "demo.eng.speaking.b2"],
  ];
  for (const [from, to] of prereqs) {
    const fromId = byCode.get(from)!;
    const toId = byCode.get(to)!;
    const has = await prisma.skillPrerequisite.findUnique({
      where: {
        skillId_prerequisiteSkillId: { skillId: toId, prerequisiteSkillId: fromId },
      },
    });
    if (!has) {
      await prisma.skillPrerequisite.create({
        data: { skillId: toId, prerequisiteSkillId: fromId },
      });
    }
  }

  return byCode;
}

// ────────────────────────────────────────────────────────────────────
// 2. Misconceptions
// ────────────────────────────────────────────────────────────────────

async function seedMisconceptions() {
  return {
    presentPerfectVsPast: await ensureMisconception(
      "demo.eng.tense.present_perfect_vs_past",
      "Nhầm Present Perfect với Simple Past",
      "Học viên dùng 'have done' khi thời điểm cụ thể, hoặc 'did' khi nói trải nghiệm chung chung.",
    ),
    fillerWords: await ensureMisconception(
      "demo.soft.filler_words",
      "Lạm dụng filler khi thuyết trình",
      "Quá nhiều 'um/uh/like' trong public speaking → giảm uy tín.",
    ),
    presentationStructure: await ensureMisconception(
      "demo.soft.presentation_no_close",
      "Thuyết trình không có closing",
      "Bài thuyết trình kết thúc đột ngột, không tổng kết / không CTA.",
    ),
  };
}

// ────────────────────────────────────────────────────────────────────
// 3. Users (1 admin + 3 instructors + 8 students)
// ────────────────────────────────────────────────────────────────────

interface SeedUser {
  email: string;
  name: string;
  roles: string[];
}

const STUDENTS: SeedUser[] = [
  { email: `minh@${DOMAIN}`, name: "Nguyễn Minh", roles: [RoleName.Learner] },
  { email: `hoa@${DOMAIN}`, name: "Trần Thị Hoa", roles: [RoleName.Learner] },
  { email: `tung@${DOMAIN}`, name: "Lê Văn Tùng", roles: [RoleName.Learner] },
  { email: `anh@${DOMAIN}`, name: "Phạm Thị Anh", roles: [RoleName.Learner] },
  { email: `nam@${DOMAIN}`, name: "Hoàng Văn Nam", roles: [RoleName.Learner] },
  { email: `mai@${DOMAIN}`, name: "Đỗ Thị Mai", roles: [RoleName.Learner] },
  { email: `phong@${DOMAIN}`, name: "Vũ Đình Phong", roles: [RoleName.Learner] },
  { email: `hieu@${DOMAIN}`, name: "Bùi Trung Hiếu", roles: [RoleName.Learner] },
];

const INSTRUCTORS: SeedUser[] = [
  {
    email: `sarah@${DOMAIN}`,
    name: "Sarah Williams (IELTS Speaking)",
    roles: [RoleName.Learner, RoleName.Instructor],
  },
  {
    email: `james@${DOMAIN}`,
    name: "James Carter (Business Comm)",
    roles: [RoleName.Learner, RoleName.Instructor],
  },
  {
    email: `linh@${DOMAIN}`,
    name: "Nguyễn Khánh Linh (Soft Skills)",
    roles: [RoleName.Learner, RoleName.Instructor],
  },
];

const ADMIN: SeedUser = {
  email: `admin@${DOMAIN}`,
  name: "Center Admin",
  roles: [RoleName.Learner, RoleName.Admin],
};

async function seedUsers() {
  const adminId = await ensureUser(ADMIN.email, ADMIN.name, ADMIN.roles);
  const instructorIds: Record<string, string> = {};
  for (const u of INSTRUCTORS) {
    instructorIds[u.email] = await ensureUser(u.email, u.name, u.roles);
  }
  const studentIds: Record<string, string> = {};
  for (const u of STUDENTS) {
    studentIds[u.email] = await ensureUser(u.email, u.name, u.roles);
  }
  return { adminId, instructorIds, studentIds };
}

// ────────────────────────────────────────────────────────────────────
// 4. Courses (3 courses with modules/lessons/content/skill tags)
// ────────────────────────────────────────────────────────────────────

interface CourseSeed {
  slug: string;
  title: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  category: string;
  ownerEmail: string;
  modules: Array<{
    title: string;
    lessons: Array<{
      title: string;
      contents: Array<
        | { type: "markdown"; body: string }
        | { type: "video"; url: string; durationSec: number }
        | { type: "external_link"; url: string; title: string }
      >;
      skillCodes: string[];
    }>;
  }>;
}

const COURSE_SEEDS: CourseSeed[] = [
  {
    slug: "demo-eng-ielts-speaking-foundation",
    title: "IELTS Speaking Foundation",
    description:
      "Khóa nền tảng IELTS Speaking — luyện Part 1/2/3, sửa phát âm, mở rộng từ vựng theo chủ đề. Có peer review video tự ghi.",
    level: "intermediate",
    category: "english",
    ownerEmail: `sarah@${DOMAIN}`,
    modules: [
      {
        title: "Module 1 — Part 1 & Warm-up",
        lessons: [
          {
            title: "Lesson 1.1 — Cấu trúc Part 1 & cách trả lời tự nhiên",
            skillCodes: ["demo.eng.speaking.b1"],
            contents: [
              {
                type: "markdown",
                body: "# Part 1 — Giới thiệu\n\nPart 1 kéo dài 4-5 phút. Examiner hỏi 8-10 câu về chủ đề quen thuộc (work, hometown, hobbies).\n\n**Strategy:**\n- Trả lời 2-3 câu/question (không dài quá).\n- Thêm 1 detail/example.\n- Tránh just 'yes/no'.",
              },
              {
                type: "video",
                url: "https://demo.example.com/ielts/speaking-part1-intro.mp4",
                durationSec: 540,
              },
            ],
          },
          {
            title: "Lesson 1.2 — Topic: Work / Studies",
            skillCodes: ["demo.eng.speaking.b1", "demo.eng.vocab.business"],
            contents: [
              {
                type: "markdown",
                body: "## Vocabulary cluster\n\n- *deal with* — handle\n- *take on* — accept (responsibility)\n- *be in charge of* — responsible for\n\nLuyện trả lời các câu: What do you do? Do you enjoy your work? What's challenging about it?",
              },
            ],
          },
        ],
      },
      {
        title: "Module 2 — Part 2 Cue Card",
        lessons: [
          {
            title: "Lesson 2.1 — Cấu trúc 1-2 phút độc thoại",
            skillCodes: ["demo.eng.speaking.b2"],
            contents: [
              {
                type: "markdown",
                body: "Part 2 yêu cầu monologue 1-2 phút theo cue card. Cấu trúc gợi ý:\n1. Setting (When/Where)\n2. Description (What/Who)\n3. Action (How it happened)\n4. Feeling/Reflection",
              },
              {
                type: "external_link",
                url: "https://ielts.org/take-a-test/preparation-resources/sample-test-questions/speaking",
                title: "IELTS Speaking sample questions",
              },
            ],
          },
          {
            title: "Lesson 2.2 — Pronunciation & intonation",
            skillCodes: ["demo.eng.speaking.b2"],
            contents: [
              {
                type: "video",
                url: "https://demo.example.com/ielts/intonation.mp4",
                durationSec: 720,
              },
            ],
          },
        ],
      },
      {
        title: "Module 3 — Part 3 Discussion",
        lessons: [
          {
            title: "Lesson 3.1 — Mở rộng ý + signposting language",
            skillCodes: ["demo.eng.speaking.b2", "demo.soft.critical_thinking"],
            contents: [
              {
                type: "markdown",
                body: "Part 3 đi sâu vào chủ đề Part 2. Kỹ thuật:\n- **Signposting:** 'In my view...', 'On the other hand...', 'It's a bit of a balancing act'\n- **Hedging:** 'I would say', 'roughly speaking'\n- **Examples** thay vì abstract claims.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "demo-eng-business-communication-101",
    title: "Business Communication 101",
    description:
      "Email, meeting, presentation cho môi trường công sở quốc tế. Có nhiều bài viết được peer review.",
    level: "intermediate",
    category: "english",
    ownerEmail: `james@${DOMAIN}`,
    modules: [
      {
        title: "Module 1 — Email essentials",
        lessons: [
          {
            title: "Lesson 1.1 — Cấu trúc email chuẩn",
            skillCodes: ["demo.eng.writing.b1", "demo.eng.vocab.business"],
            contents: [
              {
                type: "markdown",
                body: "## Anatomy of a business email\n\n1. **Subject** — concise, action-oriented.\n2. **Greeting** — Dear/Hi + name.\n3. **Opening** — context (1 sentence).\n4. **Body** — purpose + details.\n5. **Call to action** — what you need.\n6. **Sign-off** — Best regards / Kind regards.",
              },
            ],
          },
          {
            title: "Lesson 1.2 — Politeness & tone",
            skillCodes: ["demo.eng.writing.b1", "demo.soft.communication"],
            contents: [
              {
                type: "markdown",
                body: "**Direct vs. softened request:**\n- ❌ Send me the report.\n- ✅ Could you send me the report by Friday, please?\n\nUse modal verbs (could/would) + please + reason.",
              },
            ],
          },
        ],
      },
      {
        title: "Module 2 — Meetings",
        lessons: [
          {
            title: "Lesson 2.1 — Tham gia & lead meeting",
            skillCodes: ["demo.soft.communication", "demo.eng.speaking.b1"],
            contents: [
              {
                type: "video",
                url: "https://demo.example.com/biz/meeting-phrases.mp4",
                durationSec: 600,
              },
            ],
          },
        ],
      },
      {
        title: "Module 3 — Presentations",
        lessons: [
          {
            title: "Lesson 3.1 — Structure & visual aids",
            skillCodes: ["demo.soft.public_speaking"],
            contents: [
              {
                type: "markdown",
                body: "**Rule of 3** trong presentation. Slide nguyên tắc 6x6 (≤6 dòng, ≤6 từ/dòng).",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "demo-eng-public-speaking-mastery",
    title: "Public Speaking Mastery",
    description:
      "Kỹ năng nói trước đám đông cho người đi làm. Bài tập thuyết trình quay video + chấm thủ công bởi giảng viên.",
    level: "advanced",
    category: "soft-skills",
    ownerEmail: `linh@${DOMAIN}`,
    modules: [
      {
        title: "Module 1 — Foundations",
        lessons: [
          {
            title: "Lesson 1.1 — Body language & eye contact",
            skillCodes: ["demo.soft.public_speaking"],
            contents: [
              {
                type: "markdown",
                body: "## Body language checklist\n- Stance: shoulder-width apart, weight balanced.\n- Hands: above waist, open palms.\n- Eye contact: 3-second rule per person.\n- Avoid: hand-in-pocket, swaying.",
              },
              {
                type: "video",
                url: "https://demo.example.com/ps/body-language.mp4",
                durationSec: 480,
              },
            ],
          },
          {
            title: "Lesson 1.2 — Voice projection",
            skillCodes: ["demo.soft.public_speaking"],
            contents: [
              {
                type: "markdown",
                body: "Diaphragmatic breathing exercise — 4-second inhale, 8-second exhale, 5 reps.",
              },
            ],
          },
        ],
      },
      {
        title: "Module 2 — Storytelling",
        lessons: [
          {
            title: "Lesson 2.1 — STAR framework",
            skillCodes: ["demo.soft.public_speaking", "demo.soft.critical_thinking"],
            contents: [
              {
                type: "markdown",
                body: "**S**ituation → **T**ask → **A**ction → **R**esult. Mỗi câu chuyện thuyết trình nên fit khung này.",
              },
            ],
          },
        ],
      },
    ],
  },
];

async function seedCourses(
  instructorIds: Record<string, string>,
  skillsByCode: Map<string, string>,
) {
  const result: Array<{
    courseId: string;
    slug: string;
    title: string;
    ownerId: string;
    lessonIds: Map<string, string>;
  }> = [];

  for (const cs of COURSE_SEEDS) {
    const ownerId = instructorIds[cs.ownerEmail]!;
    const existing = await prisma.course.findUnique({ where: { slug: cs.slug } });
    if (existing) {
      const lessons = await prisma.lesson.findMany({
        where: { module: { courseId: existing.id } },
        select: { id: true, title: true },
      });
      result.push({
        courseId: existing.id,
        slug: cs.slug,
        title: cs.title,
        ownerId,
        lessonIds: new Map(lessons.map((l) => [l.title, l.id])),
      });
      continue;
    }
    const course = await prisma.course.create({
      data: {
        slug: cs.slug,
        title: cs.title,
        description: cs.description,
        language: "en",
        level: cs.level,
        category: cs.category,
        status: "published",
        publishedAt: offset(-30),
        instructors: { create: { userId: ownerId, role: "owner" } },
        modules: {
          create: cs.modules.map((m, mIdx) => ({
            orderIndex: mIdx,
            title: m.title,
            lessons: {
              create: m.lessons.map((l, lIdx) => ({
                orderIndex: lIdx,
                title: l.title,
                contentItems: {
                  create: l.contents.map((c, cIdx) => {
                    let payload: Prisma.InputJsonValue;
                    if (c.type === "markdown") payload = { body: c.body };
                    else if (c.type === "video")
                      payload = { url: c.url, durationSec: c.durationSec };
                    else payload = { url: c.url, title: c.title };
                    return { orderIndex: cIdx, type: c.type, payload };
                  }),
                },
              })),
            },
          })),
        },
      },
      include: { modules: { include: { lessons: true } } },
    });

    // Skill tags on lessons.
    const lessonIdMap = new Map<string, string>();
    for (const m of course.modules) {
      for (const l of m.lessons) lessonIdMap.set(l.title, l.id);
    }
    for (const m of cs.modules) {
      for (const l of m.lessons) {
        const lessonId = lessonIdMap.get(l.title)!;
        for (const skillCode of l.skillCodes) {
          const skillId = skillsByCode.get(skillCode)!;
          await prisma.contentSkillMapping.create({
            data: { contentType: "lesson", contentId: lessonId, skillId },
          });
        }
      }
    }

    result.push({
      courseId: course.id,
      slug: cs.slug,
      title: cs.title,
      ownerId,
      lessonIds: lessonIdMap,
    });
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────
// 5. Quizzes (auto-graded with skill tags + misconceptions)
// ────────────────────────────────────────────────────────────────────

async function seedQuizzes(
  courses: Awaited<ReturnType<typeof seedCourses>>,
  skillsByCode: Map<string, string>,
  miscs: Awaited<ReturnType<typeof seedMisconceptions>>,
) {
  const ielts = courses.find((c) => c.slug === "demo-eng-ielts-speaking-foundation")!;
  const biz = courses.find((c) => c.slug === "demo-eng-business-communication-101")!;

  const quizzes: Array<{ id: string; courseId: string; questionIds: string[] }> = [];

  // Quiz 1 — IELTS vocabulary check.
  const lesson12 = ielts.lessonIds.get("Lesson 1.2 — Topic: Work / Studies")!;
  const existingQ1 = await prisma.quiz.findFirst({
    where: { lessonId: lesson12 },
    include: { questions: { select: { id: true } } },
  });
  if (existingQ1) {
    quizzes.push({
      id: existingQ1.id,
      courseId: ielts.courseId,
      questionIds: existingQ1.questions.map((q) => q.id),
    });
  } else {
    const q = await prisma.quiz.create({
      data: {
        courseId: ielts.courseId,
        lessonId: lesson12,
        title: "Quiz: Work vocabulary",
        description: "Kiểm tra nhanh từ vựng chủ đề Work.",
        difficulty: 2,
        passThresholdPct: 70,
        timeLimitSec: 300,
        maxAttempts: 3,
        questions: {
          create: [
            {
              type: "mcq",
              prompt: "What does 'be in charge of' mean?",
              explanation: "'be in charge of' = responsible for.",
              points: 1,
              orderIndex: 0,
              options: {
                create: [
                  { label: "Responsible for", isCorrect: true, orderIndex: 0 },
                  { label: "Afraid of", isCorrect: false, orderIndex: 1 },
                  { label: "Working with", isCorrect: false, orderIndex: 2 },
                ],
              },
            },
            {
              type: "true_false",
              prompt: "'Deal with' has the same meaning as 'handle'.",
              explanation: "Yes — synonyms in business context.",
              points: 1,
              orderIndex: 1,
              options: {
                create: [
                  { label: "True", isCorrect: true, orderIndex: 0 },
                  { label: "False", isCorrect: false, orderIndex: 1 },
                ],
              },
            },
            {
              type: "fill_in",
              prompt: "Complete: I've been ___ this project since January.",
              explanation: "working on / in charge of are common.",
              points: 1,
              orderIndex: 2,
              options: {
                create: [
                  { label: "working on", isCorrect: true, orderIndex: 0 },
                  { label: "in charge of", isCorrect: true, orderIndex: 1 },
                ],
              },
            },
          ],
        },
      },
      include: { questions: true },
    });
    const speakingSkill = skillsByCode.get("demo.eng.speaking.b1")!;
    await prisma.questionSkillTag.createMany({
      data: q.questions.map((qq) => ({ questionId: qq.id, skillId: speakingSkill })),
      skipDuplicates: true,
    });
    quizzes.push({
      id: q.id,
      courseId: ielts.courseId,
      questionIds: q.questions.map((qq) => qq.id),
    });
  }

  // Quiz 2 — Business email tone (misconception tagged).
  const bizLesson12 = biz.lessonIds.get("Lesson 1.2 — Politeness & tone")!;
  const existingQ2 = await prisma.quiz.findFirst({
    where: { lessonId: bizLesson12 },
    include: { questions: { select: { id: true } } },
  });
  if (existingQ2) {
    quizzes.push({
      id: existingQ2.id,
      courseId: biz.courseId,
      questionIds: existingQ2.questions.map((q) => q.id),
    });
  } else {
    const q = await prisma.quiz.create({
      data: {
        courseId: biz.courseId,
        lessonId: bizLesson12,
        title: "Quiz: Tense usage in emails",
        difficulty: 3,
        passThresholdPct: 70,
        timeLimitSec: 360,
        maxAttempts: 2,
        questions: {
          create: [
            {
              type: "mcq",
              prompt: "I ___ the report yesterday. (Choose the correct tense.)",
              explanation: "Specific past time → Simple Past.",
              points: 2,
              orderIndex: 0,
              options: {
                create: [
                  { label: "sent", isCorrect: true, orderIndex: 0 },
                  {
                    label: "have sent",
                    isCorrect: false,
                    orderIndex: 1,
                    misconceptionId: miscs.presentPerfectVsPast.id,
                  },
                  { label: "send", isCorrect: false, orderIndex: 2 },
                ],
              },
            },
            {
              type: "mcq",
              prompt: "We ___ many improvements since the audit.",
              explanation: "Open time frame → Present Perfect.",
              points: 2,
              orderIndex: 1,
              options: {
                create: [
                  { label: "have made", isCorrect: true, orderIndex: 0 },
                  {
                    label: "made",
                    isCorrect: false,
                    orderIndex: 1,
                    misconceptionId: miscs.presentPerfectVsPast.id,
                  },
                  { label: "are making", isCorrect: false, orderIndex: 2 },
                ],
              },
            },
          ],
        },
      },
      include: { questions: true },
    });
    const grammarSkill = skillsByCode.get("demo.eng.grammar.tenses")!;
    await prisma.questionSkillTag.createMany({
      data: q.questions.map((qq) => ({ questionId: qq.id, skillId: grammarSkill })),
      skipDuplicates: true,
    });
    quizzes.push({
      id: q.id,
      courseId: biz.courseId,
      questionIds: q.questions.map((qq) => qq.id),
    });
  }
  return quizzes;
}

// ────────────────────────────────────────────────────────────────────
// 6. Assignments (peer review + manual review)
// ────────────────────────────────────────────────────────────────────

async function seedAssignments(courses: Awaited<ReturnType<typeof seedCourses>>) {
  const ielts = courses.find((c) => c.slug === "demo-eng-ielts-speaking-foundation")!;
  const ps = courses.find((c) => c.slug === "demo-eng-public-speaking-mastery")!;
  const assignments: Array<{ id: string; lessonId: string; courseId: string }> = [];

  const ieltsLesson = ielts.lessonIds.get("Lesson 2.1 — Cấu trúc 1-2 phút độc thoại")!;
  const existing1 = await prisma.assignment.findFirst({ where: { lessonId: ieltsLesson } });
  if (existing1) {
    assignments.push({ id: existing1.id, lessonId: ieltsLesson, courseId: ielts.courseId });
  } else {
    const a = await prisma.assignment.create({
      data: {
        lessonId: ieltsLesson,
        title: "Bài tập 2.1 — Ghi âm Part 2 cue card",
        description:
          "Tự ghi âm 1-2 phút trả lời cue card 'Describe a memorable trip you took'. Đính link audio + viết transcript ngắn (~80 từ).",
        maxScore: 100,
        dueAt: offset(7),
        responseFormat: "text",
        assessmentModes: ["peer_reviewed"],
        requireReflection: true,
      },
    });
    assignments.push({ id: a.id, lessonId: ieltsLesson, courseId: ielts.courseId });
  }

  const psLesson = ps.lessonIds.get("Lesson 2.1 — STAR framework")!;
  const existing2 = await prisma.assignment.findFirst({ where: { lessonId: psLesson } });
  if (existing2) {
    assignments.push({ id: existing2.id, lessonId: psLesson, courseId: ps.courseId });
  } else {
    const a = await prisma.assignment.create({
      data: {
        lessonId: psLesson,
        title: "Bài tập 2.1 — Quay 3-phút pitch theo STAR",
        description:
          "Quay video pitch dự án bạn từng tham gia, dùng đúng framework STAR. Upload link Google Drive + viết tóm tắt 200 từ.",
        maxScore: 100,
        dueAt: offset(10),
        responseFormat: "text",
        assessmentModes: ["instructor_graded"],
        requireSelfRating: true,
      },
    });
    assignments.push({ id: a.id, lessonId: psLesson, courseId: ps.courseId });
  }

  return assignments;
}

// ────────────────────────────────────────────────────────────────────
// 7. Enrollments + LearningEvents + UserCourseProgress (data học)
// ────────────────────────────────────────────────────────────────────

interface EnrollmentSpec {
  studentEmail: string;
  courseSlug: string;
  /** % progress 0-100 */
  progressPct: number;
}

const ENROLLMENT_SPECS: EnrollmentSpec[] = [
  // IELTS course — 6 students
  { studentEmail: `minh@${DOMAIN}`, courseSlug: "demo-eng-ielts-speaking-foundation", progressPct: 80 },
  { studentEmail: `hoa@${DOMAIN}`, courseSlug: "demo-eng-ielts-speaking-foundation", progressPct: 60 },
  { studentEmail: `tung@${DOMAIN}`, courseSlug: "demo-eng-ielts-speaking-foundation", progressPct: 45 },
  { studentEmail: `anh@${DOMAIN}`, courseSlug: "demo-eng-ielts-speaking-foundation", progressPct: 100 },
  { studentEmail: `nam@${DOMAIN}`, courseSlug: "demo-eng-ielts-speaking-foundation", progressPct: 20 },
  { studentEmail: `mai@${DOMAIN}`, courseSlug: "demo-eng-ielts-speaking-foundation", progressPct: 70 },
  // Business — 4 students
  { studentEmail: `minh@${DOMAIN}`, courseSlug: "demo-eng-business-communication-101", progressPct: 50 },
  { studentEmail: `phong@${DOMAIN}`, courseSlug: "demo-eng-business-communication-101", progressPct: 75 },
  { studentEmail: `hieu@${DOMAIN}`, courseSlug: "demo-eng-business-communication-101", progressPct: 30 },
  { studentEmail: `mai@${DOMAIN}`, courseSlug: "demo-eng-business-communication-101", progressPct: 90 },
  // Public Speaking — 3 students
  { studentEmail: `hoa@${DOMAIN}`, courseSlug: "demo-eng-public-speaking-mastery", progressPct: 40 },
  { studentEmail: `tung@${DOMAIN}`, courseSlug: "demo-eng-public-speaking-mastery", progressPct: 60 },
  { studentEmail: `anh@${DOMAIN}`, courseSlug: "demo-eng-public-speaking-mastery", progressPct: 25 },
];

async function seedEnrollments(
  studentIds: Record<string, string>,
  courses: Awaited<ReturnType<typeof seedCourses>>,
) {
  const courseBySlug = new Map(courses.map((c) => [c.slug, c]));

  for (const spec of ENROLLMENT_SPECS) {
    const userId = studentIds[spec.studentEmail]!;
    const course = courseBySlug.get(spec.courseSlug)!;

    const lessons = await prisma.lesson.findMany({
      where: { module: { courseId: course.courseId } },
      orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    });
    if (lessons.length === 0) continue;

    const completeCount = Math.floor((spec.progressPct / 100) * lessons.length);
    const lastLessonIdx = Math.min(completeCount, lessons.length - 1);

    const existingEnroll = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.courseId } },
    });
    if (!existingEnroll) {
      const sectionId = await seedDefaultSectionId(course.courseId, prisma);
      await prisma.enrollment.create({
        data: {
          userId,
          courseId: course.courseId,
          sectionId,
          courseVersion: 1,
          status: spec.progressPct >= 100 ? "completed" : "active",
          lastLessonId: lessons[lastLessonIdx]?.id ?? null,
          lastPositionSec: 30,
        },
      });
      await emitEvent(
        userId,
        "enrollment.created",
        { courseId: course.courseId },
        course.courseId,
        offset(-25),
        `enroll:${userId}:${course.courseId}`,
      );
    }

    // Emit lesson.completed events for the first N lessons.
    for (let i = 0; i < completeCount; i++) {
      const lesson = lessons[i]!;
      await emitEvent(
        userId,
        "lesson.completed",
        { lessonId: lesson.id, reason: "marked_complete" },
        course.courseId,
        offset(-20 + i),
        `lesson.completed:${userId}:${lesson.id}`,
      );
    }

    // UserCourseProgress = XP/level tracker (not lesson count). Seed a small
    // level snapshot so leaderboard math has something to roll up.
    const xp = Math.round((spec.progressPct / 100) * 500);
    const progress = await prisma.userCourseProgress.findUnique({
      where: { userId_courseId: { userId, courseId: course.courseId } },
    });
    if (progress) {
      await prisma.userCourseProgress.update({
        where: { userId_courseId: { userId, courseId: course.courseId } },
        data: { xp, level: Math.floor(xp / 100) + 1 },
      });
    } else {
      await prisma.userCourseProgress.create({
        data: { userId, courseId: course.courseId, xp, level: Math.floor(xp / 100) + 1 },
      });
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// 8. Quiz attempts (mix passed / failed)
// ────────────────────────────────────────────────────────────────────

async function seedQuizAttempts(
  studentIds: Record<string, string>,
  quizzes: Awaited<ReturnType<typeof seedQuizzes>>,
) {
  if (quizzes.length === 0) return;
  // Choose a few learners to attempt the first quiz.
  const ids = Object.values(studentIds).slice(0, 5);
  for (const quiz of quizzes) {
    for (const [i, userId] of ids.entries()) {
      const exists = await prisma.quizAttempt.findFirst({
        where: { quizId: quiz.id, userId },
      });
      if (exists) continue;
      const scorePct = [85, 60, 95, 40, 70][i]!;
      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          userId,
          status: "submitted",
          startedAt: offset(-3 - i, -2),
          submittedAt: offset(-3 - i, -1),
          scorePct,
          passed: scorePct >= 70,
        },
      });
      // Per-question answer (correct if scorePct >= 70 else first one wrong)
      for (const [qIdx, qid] of quiz.questionIds.entries()) {
        const isCorrect = scorePct >= 70 ? true : qIdx > 0;
        await prisma.answerResponse.create({
          data: {
            attemptId: attempt.id,
            questionId: qid,
            response: ["demo_option"] as Prisma.InputJsonValue,
            isCorrect,
            responseTimeMs: (30 + qIdx * 5) * 1000,
          },
        });
      }
      await emitEvent(
        userId,
        "quiz.submitted",
        { quizId: quiz.id, attemptId: attempt.id, scorePct, passed: scorePct >= 70 },
        quiz.courseId,
        offset(-3 - i, -1),
        `quiz.submitted:${attempt.id}`,
      );
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// 9. Assignment submissions (some graded, some pending)
// ────────────────────────────────────────────────────────────────────

async function seedAssignmentSubmissions(
  studentIds: Record<string, string>,
  assignments: Awaited<ReturnType<typeof seedAssignments>>,
  instructorIds: Record<string, string>,
) {
  if (assignments.length === 0) return;

  const submitters = Object.values(studentIds).slice(0, 4);
  for (const a of assignments) {
    for (const [i, userId] of submitters.entries()) {
      const exists = await prisma.assignmentSubmission.findUnique({
        where: { assignmentId_userId: { assignmentId: a.id, userId } },
      });
      if (exists) continue;
      const graded = i < 2; // First 2 graded, rest pending.
      await prisma.assignmentSubmission.create({
        data: {
          assignmentId: a.id,
          userId,
          body:
            i === 0
              ? "Audio link: https://drive.example.com/audio-minh.mp3\n\nTranscript: My memorable trip was to Hoi An last summer. I went with my family for 4 days..."
              : "Bài nộp demo " + (i + 1),
          status: graded ? "graded" : "submitted",
          submittedAt: offset(-5 + i),
          score: graded ? [85, 72][i]! : null,
          feedback: graded
            ? i === 0
              ? "Tốt! Phát âm rõ, có dùng signposting. Cần thêm 1-2 example cụ thể trong Part 3."
              : "Đúng cấu trúc nhưng còn lặp từ. Mở rộng vocabulary cluster ở Lesson 1.2."
            : null,
          graderId: graded ? Object.values(instructorIds)[0]! : null,
          gradedAt: graded ? offset(-4 + i) : null,
        },
      });
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// 10. Forum threads
// ────────────────────────────────────────────────────────────────────

async function seedForum(
  courses: Awaited<ReturnType<typeof seedCourses>>,
  studentIds: Record<string, string>,
  instructorIds: Record<string, string>,
) {
  const ielts = courses.find((c) => c.slug === "demo-eng-ielts-speaking-foundation")!;
  const firstLessonId = [...ielts.lessonIds.values()][0]!;
  const existing = await prisma.forumThread.findFirst({
    where: { lessonId: firstLessonId },
  });
  if (existing) return;

  const minhId = studentIds[`minh@${DOMAIN}`]!;
  const sarahId = instructorIds[`sarah@${DOMAIN}`]!;
  const hoaId = studentIds[`hoa@${DOMAIN}`]!;

  const thread = await prisma.forumThread.create({
    data: {
      lessonId: firstLessonId,
      authorId: minhId,
      title: "Em hay bị 'just yes/no' ở Part 1, có cách nào fix nhanh không ạ?",
      body: "Mỗi lần examiner hỏi 'Do you like cooking?' em chỉ trả lời 'Yes I do' rồi tắc tị. Có template/phrase nào để mở rộng câu trả lời không cô?",
      createdAt: offset(-7),
    },
  });
  await prisma.forumPost.create({
    data: {
      threadId: thread.id,
      authorId: sarahId,
      body:
        "Hi Minh! Em thử công thức **Yes/No + Reason + Example** nhé:\n- Yes I do, because cooking helps me unwind after work. For instance, last Sunday I tried making bún bò Huế for the first time.\n\nNguyên tắc: 1 câu trả lời chính + 1 lý do + 1 ví dụ cụ thể.",
      createdAt: offset(-7, 2),
    },
  });
  await prisma.forumPost.create({
    data: {
      threadId: thread.id,
      authorId: hoaId,
      body: "Cám ơn cô, em cũng đang vướng chỗ này. Sẽ luyện theo công thức trên.",
      createdAt: offset(-6),
    },
  });
}

// ────────────────────────────────────────────────────────────────────
// 11. Gamification: XP, badges (use seed-badges if missing), streaks, leaderboard
// ────────────────────────────────────────────────────────────────────

async function seedGamification(
  studentIds: Record<string, string>,
  courses: Awaited<ReturnType<typeof seedCourses>>,
) {
  // Make sure at least one badge exists.
  const completionBadge = await prisma.badge.upsert({
    where: { code: "demo-eng-first-lesson" },
    update: {},
    create: {
      code: "demo-eng-first-lesson",
      name: "First Step",
      description: "Hoàn thành bài học đầu tiên",
      emoji: "🌱",
      category: "milestone",
      criteria: { type: "lesson_count", threshold: 1 } as Prisma.InputJsonValue,
    },
  });
  const speakingBadge = await prisma.badge.upsert({
    where: { code: "demo-eng-speaking-streak-7" },
    update: {},
    create: {
      code: "demo-eng-speaking-streak-7",
      name: "Speaking 7-day streak",
      description: "Luyện nói 7 ngày liên tục",
      emoji: "🔥",
      category: "milestone",
      criteria: { type: "streak_days", threshold: 7 } as Prisma.InputJsonValue,
    },
  });

  // Award XP + badges + streaks for top 5 students.
  const top5 = Object.entries(studentIds).slice(0, 5);
  const ielts = courses.find((c) => c.slug === "demo-eng-ielts-speaking-foundation")!;

  for (const [i, [, userId]] of top5.entries()) {
    const baseXp = 500 - i * 80;

    // XP transactions. Unique key (userId, reason, sourceId) makes them
    // idempotent per kind. Use a synthetic sourceId per row so multiple
    // entries of the same reason coexist.
    for (let k = 0; k < 4; k++) {
      const reason = [
        "lesson.completed",
        "quiz.passed",
        "streak.daily",
        "assignment.graded",
      ][k]!;
      const synthSource = `demo-eng:${userId}:${k}`;
      const exists = await prisma.xpTransaction.findUnique({
        where: { userId_reason_sourceId: { userId, reason, sourceId: synthSource } },
      });
      if (!exists) {
        await prisma.xpTransaction.create({
          data: {
            userId,
            courseId: ielts.courseId,
            amount: Math.floor(baseXp / 4) + k * 5,
            reason,
            sourceId: synthSource,
          },
        });
      }
    }

    // Badges.
    const hasFirst = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: completionBadge.id } },
    });
    if (!hasFirst) {
      await prisma.userBadge.create({
        data: { userId, badgeId: completionBadge.id, earnedAt: offset(-10 + i) },
      });
    }
    if (i < 2) {
      const hasSpeak = await prisma.userBadge.findUnique({
        where: { userId_badgeId: { userId, badgeId: speakingBadge.id } },
      });
      if (!hasSpeak) {
        await prisma.userBadge.create({
          data: { userId, badgeId: speakingBadge.id, earnedAt: offset(-3) },
        });
      }
    }

    // Streak (per-course; one row for IELTS course).
    const days = [12, 8, 5, 3, 1][i]!;
    const streak = await prisma.streakRecord.findUnique({
      where: { userId_courseId: { userId, courseId: ielts.courseId } },
    });
    if (streak) {
      await prisma.streakRecord.update({
        where: { userId_courseId: { userId, courseId: ielts.courseId } },
        data: {
          currentStreak: days,
          longestStreak: Math.max(streak.longestStreak, days),
          lastActiveDate: offset(0),
        },
      });
    } else {
      await prisma.streakRecord.create({
        data: {
          userId,
          courseId: ielts.courseId,
          currentStreak: days,
          longestStreak: days,
          lastActiveDate: offset(0),
        },
      });
    }
  }

  // Leaderboard entries (weekly snapshot for IELTS course).
  const periodKey = `week-${NOW.getFullYear()}-W${Math.ceil(NOW.getDate() / 7)}-demo-eng`;
  for (const [i, [, userId]] of top5.entries()) {
    const exists = await prisma.leaderboardEntry.findUnique({
      where: {
        scope_courseId_period_periodKey_userId: {
          scope: "course",
          courseId: ielts.courseId,
          period: "weekly",
          periodKey,
          userId,
        },
      },
    });
    if (exists) continue;
    await prisma.leaderboardEntry.create({
      data: {
        scope: "course",
        courseId: ielts.courseId,
        period: "weekly",
        periodKey,
        userId,
        rank: i + 1,
        xp: 500 - i * 80,
      },
    });
  }
}

// ────────────────────────────────────────────────────────────────────
// 12. Tournaments — 1 active speaking marathon + 1 ended writing challenge
// ────────────────────────────────────────────────────────────────────

async function seedTournaments(
  instructorIds: Record<string, string>,
  studentIds: Record<string, string>,
  courses: Awaited<ReturnType<typeof seedCourses>>,
) {
  const ielts = courses.find((c) => c.slug === "demo-eng-ielts-speaking-foundation")!;
  const biz = courses.find((c) => c.slug === "demo-eng-business-communication-101")!;
  const sarahId = instructorIds[`sarah@${DOMAIN}`]!;
  const jamesId = instructorIds[`james@${DOMAIN}`]!;

  // ── Active: "Speaking Marathon — Spring 2026"
  let active = await prisma.tournament.findFirst({
    where: { title: "Speaking Marathon — Spring 2026" },
  });
  if (!active) {
    active = await prisma.tournament.create({
      data: {
        courseId: ielts.courseId,
        creatorId: sarahId,
        title: "Speaking Marathon — Spring 2026",
        description:
          "5 missions luyện nói trong 2 tuần. Mỗi mission ghi âm 1-2 phút, được peer review hoặc giảng viên chấm. Top 3 nhận XP thưởng.",
        status: "active",
        startsAt: offset(-3),
        endsAt: offset(11),
        teamSize: 1,
        prizeXp: 1000,
        prizeDistribution: { "1": 50, "2": 30, "3": 20 } as Prisma.InputJsonValue,
        allowLateRegistration: true,
      },
    });

    // Missions (mix verifyMode).
    const m1 = await prisma.tournamentMission.create({
      data: {
        tournamentId: active.id,
        title: "Mission 1 — Daily 1-minute self-intro",
        description: "Ghi âm phần giới thiệu bản thân 1 phút, không đọc giấy.",
        orderIndex: 0,
        points: 100,
        missionType: "CUSTOM",
        verifyMode: "AUTO_CHECK",
        submissionDeadline: offset(2),
      },
    });
    const m2 = await prisma.tournamentMission.create({
      data: {
        tournamentId: active.id,
        title: "Mission 2 — Part 2 cue card (peer reviewed)",
        description: "Ghi âm trả lời cue card 'Describe a hobby'. 3 peer reviews/submission.",
        orderIndex: 1,
        points: 200,
        missionType: "CUSTOM",
        verifyMode: "PEER_REVIEW",
        submissionDeadline: offset(5),
        peerReviewerCount: 3,
      },
    });
    // Mission 3 — MANUAL_REVIEW needs a backing Assignment.
    const m3 = await prisma.tournamentMission.create({
      data: {
        tournamentId: active.id,
        title: "Mission 3 — Mock IELTS Speaking full (15 phút)",
        description: "Quay video full speaking test, giảng viên chấm theo band 1-9.",
        orderIndex: 2,
        points: 300,
        missionType: "CUSTOM",
        verifyMode: "MANUAL_REVIEW",
        submissionDeadline: offset(9),
      },
    });
    await prisma.assignment.create({
      data: {
        tournamentMissionId: m3.id,
        title: "Mission 3 grading rubric",
        description: "Pronunciation 25, Fluency 25, Vocabulary 25, Grammar 25.",
        maxScore: 100,
      },
    });

    // Registrations: first 6 students.
    const regUserIds = Object.values(studentIds).slice(0, 6);
    for (const userId of regUserIds) {
      await prisma.tournamentRegistration.create({
        data: { tournamentId: active.id, userId },
      });
      await emitEvent(
        userId,
        "tournament.registered",
        { tournamentId: active.id },
        ielts.courseId,
        offset(-2),
        `tournament.registered:${active.id}:${userId}`,
      );
    }

    // Submissions on m2 (peer review) — 4 students submitted.
    for (const [i, userId] of regUserIds.slice(0, 4).entries()) {
      const sub = await prisma.missionSubmission.create({
        data: {
          missionId: m2.id,
          userId,
          payload: {
            audioUrl: `https://drive.example.com/m2-${i}.mp3`,
            transcript: "I'd like to talk about cycling, which I picked up about two years ago...",
          } as Prisma.InputJsonValue,
          submittedAt: offset(-1, -i),
        },
      });
      // Assign 3 reviewers (pick non-self).
      const reviewers = regUserIds.filter((u) => u !== userId).slice(0, 3);
      for (const [j, reviewerId] of reviewers.entries()) {
        await prisma.missionReviewAssignment.create({
          data: {
            submissionId: sub.id,
            reviewerId,
            assignedAt: offset(-1, j),
            dueAt: offset(3, j),
            completedAt: j < 2 ? offset(0, j) : null,
            scores:
              j < 2
                ? ({
                    overall: [4, 5][j]!,
                  } as Prisma.InputJsonValue)
                : Prisma.DbNull,
            comment:
              j < 2
                ? j === 0
                  ? "Good pronunciation, hơi nhanh ở giữa, cần pause hơn."
                  : "Vocabulary phong phú, transitions mượt mà."
                : null,
          },
        });
      }
    }

    // Submission on m1 (auto-check) for 5 students — auto verified.
    for (const userId of regUserIds.slice(0, 5)) {
      await prisma.missionSubmission.create({
        data: {
          missionId: m1.id,
          userId,
          payload: { audioUrl: "https://drive.example.com/m1.mp3" } as Prisma.InputJsonValue,
          verifiedAt: offset(-1),
          submittedAt: offset(-2),
        },
      });
    }

    // Rankings (simulated points = submission count * mission points).
    for (const [i, userId] of regUserIds.entries()) {
      const points = [600, 500, 400, 300, 100, 0][i]!;
      await prisma.tournamentRanking.create({
        data: {
          tournamentId: active.id,
          userId,
          totalPoints: points,
          rank: i + 1,
          updatedAt: new Date(),
        },
      });
    }

    // Sarah is also the judge.
    await prisma.tournamentJudge.create({
      data: { tournamentId: active.id, userId: sarahId },
    });
  }

  // ── Ended: "Writing Challenge — Winter 2025"
  let ended = await prisma.tournament.findFirst({
    where: { title: "Writing Challenge — Winter 2025" },
  });
  if (!ended) {
    ended = await prisma.tournament.create({
      data: {
        courseId: biz.courseId,
        creatorId: jamesId,
        title: "Writing Challenge — Winter 2025",
        description:
          "Viết 5 business emails theo prompt. Đã kết thúc — xem kết quả & top winners.",
        status: "ended",
        startsAt: offset(-45),
        endsAt: offset(-7),
        teamSize: 1,
        prizeXp: 600,
        prizeDistribution: { "1": 50, "2": 30, "3": 20 } as Prisma.InputJsonValue,
        allowLateRegistration: false,
      },
    });
    const m = await prisma.tournamentMission.create({
      data: {
        tournamentId: ended.id,
        title: "Mission — 5 emails portfolio",
        description: "Viết 5 emails business theo brief.",
        orderIndex: 0,
        points: 500,
        missionType: "CUSTOM",
        verifyMode: "MANUAL_REVIEW",
        submissionDeadline: offset(-10),
      },
    });
    await prisma.assignment.create({
      data: {
        tournamentMissionId: m.id,
        title: "Writing rubric",
        description: "Clarity 25, Tone 25, Grammar 25, Structure 25.",
        maxScore: 100,
      },
    });
    const finishers = Object.values(studentIds).slice(0, 5);
    for (const [i, userId] of finishers.entries()) {
      await prisma.tournamentRegistration.create({
        data: { tournamentId: ended.id, userId, registeredAt: offset(-44) },
      });
      await prisma.tournamentRanking.create({
        data: {
          tournamentId: ended.id,
          userId,
          totalPoints: 500 - i * 80,
          rank: i + 1,
          updatedAt: offset(-7),
        },
      });
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// 13. Notes (learner annotations on lessons)
// ────────────────────────────────────────────────────────────────────

async function seedNotes(
  studentIds: Record<string, string>,
  courses: Awaited<ReturnType<typeof seedCourses>>,
) {
  const ielts = courses.find((c) => c.slug === "demo-eng-ielts-speaking-foundation")!;
  const firstLessonId = [...ielts.lessonIds.values()][0]!;
  const minhId = studentIds[`minh@${DOMAIN}`]!;
  const existing = await prisma.note.findFirst({
    where: { userId: minhId, lessonId: firstLessonId },
  });
  if (!existing) {
    await prisma.note.create({
      data: {
        userId: minhId,
        lessonId: firstLessonId,
        body: "TODO: học thuộc 5 signposting phrases trước thứ 6.",
      },
    });
  }
}

// ────────────────────────────────────────────────────────────────────
// 14. Exam (IELTS Mock Test) + QuestionBank
// ────────────────────────────────────────────────────────────────────

async function seedExam(
  instructorIds: Record<string, string>,
  courses: Awaited<ReturnType<typeof seedCourses>>,
  skillsByCode: Map<string, string>,
) {
  const ielts = courses.find((c) => c.slug === "demo-eng-ielts-speaking-foundation")!;
  const sarahId = instructorIds[`sarah@${DOMAIN}`]!;

  const existingBank = await prisma.questionBank.findFirst({
    where: { name: "Demo IELTS Listening Bank" },
  });
  let bankId: string;
  if (existingBank) {
    bankId = existingBank.id;
  } else {
    const bank = await prisma.questionBank.create({
      data: {
        name: "Demo IELTS Listening Bank",
        description: "Ngân hàng câu hỏi nghe IELTS dùng cho mock test.",
        courseId: ielts.courseId,
        ownerUserId: sarahId,
        visibility: "course",
      },
    });
    bankId = bank.id;
    const listeningSkill = skillsByCode.get("demo.eng.listening.b2")!;
    for (let i = 0; i < 5; i++) {
      const bq = await prisma.bankQuestion.create({
        data: {
          bankId,
          type: "mcq",
          prompt: `Listening Q${i + 1}: According to the speaker, what was the main reason?`,
          config: {
            options: [
              { id: "a", label: "Cost", isCorrect: i === 0 },
              { id: "b", label: "Time", isCorrect: i === 1 },
              { id: "c", label: "Quality", isCorrect: i === 2 },
              { id: "d", label: "Convenience", isCorrect: i >= 3 },
            ],
          } as Prisma.InputJsonValue,
          points: 1,
          difficulty: 2 + (i % 3),
          status: "published",
        },
      });
      await prisma.bankQuestionSkillTag.create({
        data: { bankQuestionId: bq.id, skillId: listeningSkill },
      });
    }
  }

  const existingExam = await prisma.exam.findFirst({
    where: { title: "Mock IELTS — Listening + Reading (Demo)" },
  });
  if (existingExam) return;

  await prisma.exam.create({
    data: {
      courseId: ielts.courseId,
      title: "Mock IELTS — Listening + Reading (Demo)",
      description: "Bài kiểm tra mô phỏng IELTS gồm 2 phần Listening + Reading.",
      status: "published",
      durationMin: 90,
      openAt: offset(-1),
      closeAt: offset(30),
      publishedAt: offset(-1),
      sections: {
        create: [
          { title: "Section 1 — Listening", orderIndex: 0 },
          { title: "Section 2 — Reading", orderIndex: 1 },
        ],
      },
    },
  });
  void sarahId; // creator captured in tournament/course context, not exam
}

// ────────────────────────────────────────────────────────────────────
// 15. Feedback templates (idempotent — only add if missing)
// ────────────────────────────────────────────────────────────────────

async function seedFeedbackTemplates(
  skillsByCode: Map<string, string>,
  miscs: Awaited<ReturnType<typeof seedMisconceptions>>,
) {
  const speakingSkill = skillsByCode.get("demo.eng.speaking.b1")!;
  // FeedbackTemplate uses (scope, skillId/misconceptionId, body). No unique
  // natural key → guard with findFirst before create.
  const hasGeneric = await prisma.feedbackTemplate.findFirst({
    where: { scope: "per_skill", skillId: speakingSkill, body: { contains: "Phát âm rõ" } },
  });
  if (!hasGeneric) {
    await prisma.feedbackTemplate.create({
      data: {
        scope: "per_skill",
        skillId: speakingSkill,
        body: "Phát âm rõ ràng, ngữ điệu tự nhiên. Tiếp tục luyện tập đều đặn nhé!",
        priority: 50,
      },
    });
  }
  const hasMisc = await prisma.feedbackTemplate.findFirst({
    where: {
      scope: "per_misconception",
      misconceptionId: miscs.fillerWords.id,
    },
  });
  if (!hasMisc) {
    await prisma.feedbackTemplate.create({
      data: {
        scope: "per_misconception",
        misconceptionId: miscs.fillerWords.id,
        body: "Tốc độ nói còn chậm, có nhiều filler 'um/uh'. Khuyến nghị: ghi âm lại + đếm số filler/phút mỗi tuần.",
        priority: 50,
      },
    });
  }
}

// ────────────────────────────────────────────────────────────────────
// 16. Hackathon vote — show a sample vote on a submission for the
//     showcase feature (used by tournament showcase tab).
// ────────────────────────────────────────────────────────────────────

async function seedHackathonVotes(studentIds: Record<string, string>) {
  const submissions = await prisma.missionSubmission.findMany({
    where: { mission: { verifyMode: "PEER_REVIEW" } },
    take: 3,
  });
  if (submissions.length === 0) return;
  const voters = Object.values(studentIds).slice(0, 4);
  for (const sub of submissions) {
    for (const voterUserId of voters) {
      if (sub.userId === voterUserId) continue;
      const exists = await prisma.hackathonVote.findUnique({
        where: {
          missionId_voterUserId: { missionId: sub.missionId, voterUserId },
        },
      });
      if (!exists) {
        await prisma.hackathonVote.create({
          data: {
            missionId: sub.missionId,
            submissionId: sub.id,
            voterUserId,
          },
        });
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding demo profile: Limio English & Soft Skills Center");
  console.log("    Domain: @" + DOMAIN + "   Password: " + PASSWORD);
  console.log("    Now =", NOW.toISOString());
  console.log("─".repeat(70));

  await ensureRoles();
  console.log("✓ Roles ensured");

  const skillsByCode = await seedSkills();
  console.log(`✓ Seeded ${skillsByCode.size} skills`);

  const miscs = await seedMisconceptions();
  console.log("✓ Seeded misconceptions");

  const { adminId, instructorIds, studentIds } = await seedUsers();
  console.log(
    `✓ Users: 1 admin + ${Object.keys(instructorIds).length} instructors + ${Object.keys(studentIds).length} students`,
  );

  const courses = await seedCourses(instructorIds, skillsByCode);
  console.log(`✓ Courses: ${courses.length} published`);

  const quizzes = await seedQuizzes(courses, skillsByCode, miscs);
  console.log(`✓ Quizzes: ${quizzes.length}`);

  const assignments = await seedAssignments(courses);
  console.log(`✓ Assignments: ${assignments.length}`);

  await seedEnrollments(studentIds, courses);
  console.log(`✓ Enrollments + LearningEvents + progress snapshots`);

  await seedQuizAttempts(studentIds, quizzes);
  console.log("✓ Quiz attempts + answer responses");

  await seedAssignmentSubmissions(studentIds, assignments, instructorIds);
  console.log("✓ Assignment submissions (mix graded/pending)");

  await seedForum(courses, studentIds, instructorIds);
  console.log("✓ Forum thread + 2 replies");

  await seedGamification(studentIds, courses);
  console.log("✓ XP transactions + badges + streaks + leaderboard");

  await seedTournaments(instructorIds, studentIds, courses);
  console.log("✓ Tournaments (1 active + 1 ended) + missions + submissions + rankings");

  await seedHackathonVotes(studentIds);
  console.log("✓ Hackathon votes on peer-review submissions");

  await seedNotes(studentIds, courses);
  console.log("✓ Learner notes");

  await seedExam(instructorIds, courses, skillsByCode);
  console.log("✓ Mock exam + question bank");

  await seedFeedbackTemplates(skillsByCode, miscs);
  console.log("✓ Feedback templates");

  console.log("─".repeat(70));
  console.log("🎉 DONE. Demo accounts (password = " + PASSWORD + "):");
  console.log("   ADMIN     " + ADMIN.email);
  for (const u of INSTRUCTORS) console.log("   INSTR     " + u.email);
  for (const u of STUDENTS.slice(0, 3))
    console.log("   STUDENT   " + u.email + "  (active learner)");
  console.log("   ... +" + (STUDENTS.length - 3) + " more students");
  console.log("\nKey URLs to demo:");
  console.log("   /catalog/demo-eng-ielts-speaking-foundation");
  console.log("   /tournaments   (Arena page — should show 2 demo tournaments)");
  console.log("   /leaderboard");
  console.log("   /instructor/dashboard  (login as sarah@...)");
  console.log("\nCleanup (sau demo):");
  console.log(`   DELETE FROM "User" WHERE email LIKE '%@${DOMAIN}';`);
  console.log("   DELETE FROM \"Course\" WHERE slug LIKE 'demo-eng-%';");
  console.log("   DELETE FROM \"Skill\" WHERE code LIKE 'demo.eng.%' OR code LIKE 'demo.soft.%';");
}

main()
  .catch((e) => {
    console.error("✗ SEED FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
