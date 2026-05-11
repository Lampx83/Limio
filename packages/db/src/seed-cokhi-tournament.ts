/**
 * Seed: Tournament "Nhập môn Từ vựng Cơ khí"
 *
 * Creates end-to-end demo data for testing the self-service tournament builder:
 *   - Instructor user:  instructor.cokhi@feedbackme.dev / password1234
 *   - Learner user:     learner.cokhi@feedbackme.dev   / password1234
 *   - 7 skills (zh_cokhi.* prefix, 5 in zh_cokhi.vocab group)
 *   - Course: "Từ vựng Kỹ thuật Cơ khí Tiếng Trung" (published)
 *     ├─ Module 1: Linh kiện & Vật liệu  (3 lessons + 1 quiz)
 *     ├─ Module 2: Dụng cụ & Quy trình   (2 lessons + 1 quiz)
 *     └─ Module 3: An toàn & Bản vẽ      (2 lessons)
 *   - Tournament: "Nhập môn Từ vựng Cơ khí" (draft, starts tomorrow)
 *     ├─ M1: Khởi động — hoàn thành 3 bài học
 *     ├─ M2: Vượt vũ môn — vượt 2 quiz (prereq: M1)
 *     ├─ M3: Chuyên cần — học 3 ngày liên tiếp
 *     └─ M4: Thuộc lòng từ vựng — master 3 skill trong nhóm zh_cokhi.vocab (prereq: M2)
 *
 * Idempotent: safe to run multiple times. Skips existing data by slug/email/code.
 *
 * Run:
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5434/feedbackme" \
 *     node --loader ts-node/esm packages/db/src/seed-cokhi-tournament.ts
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient();

// ── Constants ──────────────────────────────────────────────────────────────────

const INSTRUCTOR_EMAIL = "instructor.cokhi@feedbackme.dev";
const LEARNER_EMAIL    = "learner.cokhi@feedbackme.dev";
const PASSWORD         = "password1234";
const COURSE_SLUG      = "zh-cokhi-vocab";

// ── Skill catalog ──────────────────────────────────────────────────────────────

const SKILLS = [
  // zh_cokhi.vocab group — 5 skills, all tagged into lessons/questions
  { code: "zh_cokhi.vocab.parts",        name: "Linh kiện cơ khí (零部件)",      description: "Từ vựng mô tả các linh kiện cơ bản: 螺栓 (bulông), 齿轮 (bánh răng), 轴承 (ổ lăn), 弹簧 (lò xo), 螺母 (đai ốc)." },
  { code: "zh_cokhi.vocab.tools",        name: "Dụng cụ cơ khí (工具)",          description: "Từ vựng dụng cụ: 扳手 (cờ lê), 钻头 (mũi khoan), 锉刀 (giũa), 螺丝刀 (tua vít), 锤子 (búa)." },
  { code: "zh_cokhi.vocab.materials",    name: "Vật liệu cơ khí (材料)",         description: "Từ vựng vật liệu: 钢铁 (thép), 铝合金 (nhôm hợp kim), 铸铁 (gang đúc), 铜 (đồng), 塑料 (nhựa)." },
  { code: "zh_cokhi.vocab.processes",    name: "Quy trình gia công (加工工艺)",  description: "Từ vựng quy trình: 切削 (cắt gọt), 焊接 (hàn), 铸造 (đúc), 锻造 (rèn), 磨削 (mài)." },
  { code: "zh_cokhi.vocab.measurements", name: "Đo lường kỹ thuật (量测)",       description: "Từ vựng đo lường: 量规 (calip), 游标卡尺 (thước kẹp), 千分尺 (micrometer), 百分表 (đồng hồ so)." },
  // Other groups
  { code: "zh_cokhi.drawing",            name: "Bản vẽ kỹ thuật (工程图纸)",    description: "Kỹ năng đọc hiểu bản vẽ: ký hiệu vật liệu, dung sai, hình chiếu, mặt cắt." },
  { code: "zh_cokhi.safety",             name: "An toàn lao động (安全生产)",    description: "Quy định an toàn trong xưởng cơ khí: trang bị bảo hộ, nhận diện rủi ro, biển báo." },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function ensureRole(name: string) {
  return prisma.role.upsert({ where: { name }, update: {}, create: { name } });
}

async function ensureUser(email: string, displayName: string, roleNames: string[]) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  ↳ User already exists: ${email}`);
    return existing.id;
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const roles = await Promise.all(roleNames.map((n) => prisma.role.findUniqueOrThrow({ where: { name: n } })));
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      emailVerifiedAt: new Date(),
      authProviders: { create: { provider: "password", providerUserId: email } },
      userRoles: { create: roles.map((r) => ({ roleId: r.id })) },
    },
  });
  console.log(`  ↳ Created user: ${email} / ${PASSWORD}`);
  return user.id;
}

async function ensureSkill(code: string, name: string, description?: string) {
  return prisma.skill.upsert({
    where: { code },
    update: {},
    create: { code, name, description },
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀  Seeding: Nhập môn Từ vựng Cơ khí");

  // ── 1. Roles & users ────────────────────────────────────────────────────────
  console.log("\n1. Roles & users");
  for (const r of ["admin", "instructor", "learner"]) {
    await ensureRole(r);
  }
  const instructorId = await ensureUser(INSTRUCTOR_EMAIL, "Nguyễn Demo (Cơ khí)", ["learner", "instructor"]);
  const _learnerId   = await ensureUser(LEARNER_EMAIL,    "Trần Học Viên",         ["learner"]);

  // ── 2. Skills ───────────────────────────────────────────────────────────────
  console.log("\n2. Skills");
  const skillMap = new Map<string, string>(); // code → id
  for (const s of SKILLS) {
    const skill = await ensureSkill(s.code, s.name, s.description);
    skillMap.set(s.code, skill.id);
    console.log(`  ↳ ${s.code}`);
  }

  // Skill prerequisites (DAG):
  //   tools → parts  (cần biết linh kiện trước khi học dụng cụ)
  //   materials → parts
  //   processes → tools + materials
  //   measurements → tools
  const prereqEdges: [string, string][] = [
    ["zh_cokhi.vocab.tools",        "zh_cokhi.vocab.parts"],
    ["zh_cokhi.vocab.materials",    "zh_cokhi.vocab.parts"],
    ["zh_cokhi.vocab.processes",    "zh_cokhi.vocab.tools"],
    ["zh_cokhi.vocab.processes",    "zh_cokhi.vocab.materials"],
    ["zh_cokhi.vocab.measurements", "zh_cokhi.vocab.tools"],
  ];
  for (const [skill, prereq] of prereqEdges) {
    await prisma.skillPrerequisite.upsert({
      where: { skillId_prerequisiteSkillId: { skillId: skillMap.get(skill)!, prerequisiteSkillId: skillMap.get(prereq)! } },
      update: {},
      create: { skillId: skillMap.get(skill)!, prerequisiteSkillId: skillMap.get(prereq)! },
    });
  }
  console.log("  ↳ DAG edges created");

  // ── 3. Course (skip if already exists) ──────────────────────────────────────
  console.log("\n3. Course");
  const existingCourse = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (existingCourse) {
    console.log(`  ↳ Course "${COURSE_SLUG}" already exists — skipping course + tournament creation.`);
    console.log("\n✅  Seed complete (skills upserted, course skipped).");
    return;
  }

  const course = await prisma.course.create({
    data: {
      slug:        COURSE_SLUG,
      title:       "Từ vựng Kỹ thuật Cơ khí Tiếng Trung",
      description: "Khoá học xây dựng vốn từ vựng tiếng Trung chuyên ngành cơ khí: linh kiện, dụng cụ, vật liệu, quy trình gia công và an toàn lao động. Phù hợp kỹ thuật viên muốn làm việc với tài liệu kỹ thuật Trung Quốc.",
      language:    "zh",
      level:       "beginner",
      category:    "engineering",
      status:      "published",
      publishedAt: new Date(),
      instructors: { create: { userId: instructorId, role: "owner" } },

      modules: {
        create: [

          // ── Module 1: Linh kiện & Vật liệu ───────────────────────────────
          {
            orderIndex: 0,
            title: "Module 1 — Linh kiện & Vật liệu",
            lessons: {
              create: [
                {
                  orderIndex: 0,
                  title: "螺栓与螺母 — Bulông và Đai ốc",
                  contentItems: {
                    create: [{
                      orderIndex: 0,
                      type: "markdown",
                      payload: {
                        body: [
                          "# 螺栓与螺母 — Bulông và Đai ốc",
                          "",
                          "## Từ vựng chính",
                          "| Tiếng Trung | Pinyin | Nghĩa |",
                          "|---|---|---|",
                          "| 螺栓 | luóshuān | Bulông |",
                          "| 螺母 | luómǔ | Đai ốc |",
                          "| 螺纹 | luówén | Ren vít |",
                          "| 紧固件 | jǐngùjiàn | Chi tiết kẹp chặt |",
                          "| 六角头 | liùjiǎotóu | Đầu lục giác |",
                          "",
                          "## Câu mẫu",
                          "- 用螺栓连接两个零件。(Dùng bulông kết nối hai chi tiết.)",
                          "- 螺母需要拧紧。(Đai ốc cần được siết chặt.)",
                          "",
                          "## Ghi nhớ",
                          "螺 (ốc vít) + 栓 (chốt) → **螺栓** (bulông có ren). Phân biệt với 钉子 (đinh) không có ren.",
                        ].join("\n"),
                      },
                    }],
                  },
                },
                {
                  orderIndex: 1,
                  title: "齿轮与轴承 — Bánh răng và Ổ lăn",
                  contentItems: {
                    create: [{
                      orderIndex: 0,
                      type: "markdown",
                      payload: {
                        body: [
                          "# 齿轮与轴承 — Bánh răng và Ổ lăn",
                          "",
                          "| Tiếng Trung | Pinyin | Nghĩa |",
                          "|---|---|---|",
                          "| 齿轮 | chǐlún | Bánh răng |",
                          "| 轴承 | zhóuchéng | Ổ lăn / Ổ đỡ |",
                          "| 弹簧 | tánhuáng | Lò xo |",
                          "| 轴 | zhóu | Trục |",
                          "| 键 | jiàn | Then |",
                          "",
                          "## Câu mẫu",
                          "- 齿轮将旋转运动传递到轴上。(Bánh răng truyền chuyển động quay lên trục.)",
                          "- 轴承减少摩擦力。(Ổ lăn giảm ma sát.)",
                        ].join("\n"),
                      },
                    }],
                  },
                },
                {
                  orderIndex: 2,
                  title: "钢铁与铝合金 — Vật liệu thông dụng",
                  contentItems: {
                    create: [{
                      orderIndex: 0,
                      type: "markdown",
                      payload: {
                        body: [
                          "# 钢铁与铝合金 — Vật liệu thông dụng",
                          "",
                          "| Tiếng Trung | Pinyin | Nghĩa |",
                          "|---|---|---|",
                          "| 钢铁 | gāntiě | Thép |",
                          "| 铝合金 | lǚhéjīn | Nhôm hợp kim |",
                          "| 铸铁 | zhùtiě | Gang đúc |",
                          "| 铜 | tóng | Đồng |",
                          "| 硬度 | yìngdù | Độ cứng |",
                          "",
                          "## Đặc điểm",
                          "- **钢铁**: chịu lực tốt, dùng cho kết cấu chính.",
                          "- **铝合金**: nhẹ, chống ăn mòn, dùng trong hàng không và ô tô.",
                          "- **铸铁**: dễ đúc, dùng cho thân máy (机身).",
                        ].join("\n"),
                      },
                    }],
                  },
                },
              ],
            },
          },

          // ── Module 2: Dụng cụ & Quy trình ────────────────────────────────
          {
            orderIndex: 1,
            title: "Module 2 — Dụng cụ & Quy trình",
            lessons: {
              create: [
                {
                  orderIndex: 0,
                  title: "扳手与钻头 — Dụng cụ cầm tay",
                  contentItems: {
                    create: [{
                      orderIndex: 0,
                      type: "markdown",
                      payload: {
                        body: [
                          "# 扳手与钻头 — Dụng cụ cầm tay",
                          "",
                          "| Tiếng Trung | Pinyin | Nghĩa |",
                          "|---|---|---|",
                          "| 扳手 | bānshǒu | Cờ lê |",
                          "| 钻头 | zuāntóu | Mũi khoan |",
                          "| 锉刀 | cuòdāo | Giũa |",
                          "| 螺丝刀 | luósīdāo | Tua vít |",
                          "| 锤子 | chuízi | Búa |",
                          "| 游标卡尺 | yóubiāo kǎchǐ | Thước kẹp |",
                          "",
                          "## Câu mẫu",
                          "- 用扳手拧紧螺栓。(Dùng cờ lê siết chặt bulông.)",
                          "- 游标卡尺用于精密测量。(Thước kẹp dùng để đo chính xác.)",
                        ].join("\n"),
                      },
                    }],
                  },
                },
                {
                  orderIndex: 1,
                  title: "切削与焊接 — Quy trình gia công cơ bản",
                  contentItems: {
                    create: [{
                      orderIndex: 0,
                      type: "markdown",
                      payload: {
                        body: [
                          "# 切削与焊接 — Quy trình gia công",
                          "",
                          "| Tiếng Trung | Pinyin | Nghĩa |",
                          "|---|---|---|",
                          "| 切削 | qiēxuē | Cắt gọt |",
                          "| 焊接 | hànjié | Hàn |",
                          "| 铸造 | zhùzào | Đúc |",
                          "| 锻造 | duànzào | Rèn |",
                          "| 磨削 | mòxuē | Mài |",
                          "| 加工精度 | jiāgōng jīngdù | Độ chính xác gia công |",
                          "",
                          "## Quy trình điển hình",
                          "铸造 → 锻造 → 切削 → 磨削: từ phôi thô đến chi tiết hoàn chỉnh.",
                        ].join("\n"),
                      },
                    }],
                  },
                },
              ],
            },
          },

          // ── Module 3: An toàn & Bản vẽ ───────────────────────────────────
          {
            orderIndex: 2,
            title: "Module 3 — An toàn & Bản vẽ kỹ thuật",
            lessons: {
              create: [
                {
                  orderIndex: 0,
                  title: "安全生产 — An toàn trong xưởng cơ khí",
                  contentItems: {
                    create: [{
                      orderIndex: 0,
                      type: "markdown",
                      payload: {
                        body: [
                          "# 安全生产 — An toàn lao động",
                          "",
                          "| Tiếng Trung | Pinyin | Nghĩa |",
                          "|---|---|---|",
                          "| 安全帽 | ānquánmào | Mũ bảo hộ |",
                          "| 护目镜 | hùmùjìng | Kính bảo hộ |",
                          "| 防护手套 | fánghù shǒutào | Găng tay bảo hộ |",
                          "| 警告标志 | jǐnggào biāozhì | Biển cảnh báo |",
                          "| 急救箱 | jíjiùxiāng | Hộp sơ cứu |",
                          "",
                          "## Nguyên tắc cơ bản",
                          "1. 进入车间必须佩戴安全帽。(Vào xưởng bắt buộc đội mũ bảo hộ.)",
                          "2. 操作旋转设备时禁止戴手套。(Khi vận hành thiết bị quay, cấm đeo găng tay.)",
                        ].join("\n"),
                      },
                    }],
                  },
                },
                {
                  orderIndex: 1,
                  title: "工程图纸 — Đọc bản vẽ kỹ thuật",
                  contentItems: {
                    create: [{
                      orderIndex: 0,
                      type: "markdown",
                      payload: {
                        body: [
                          "# 工程图纸 — Bản vẽ kỹ thuật",
                          "",
                          "| Tiếng Trung | Pinyin | Nghĩa |",
                          "|---|---|---|",
                          "| 主视图 | zhǔshìtú | Hình chiếu đứng |",
                          "| 俯视图 | fǔshìtú | Hình chiếu bằng |",
                          "| 剖视图 | pōushìtú | Hình cắt |",
                          "| 尺寸标注 | chǐcùn biāozhù | Ghi kích thước |",
                          "| 公差 | gōngchā | Dung sai |",
                          "",
                          "## Đọc bản vẽ 3 bước",
                          "1. Xác định hình chiếu chính (主视图).",
                          "2. Đọc kích thước (尺寸) và dung sai (公差).",
                          "3. Tra ký hiệu vật liệu và gia công bề mặt.",
                        ].join("\n"),
                      },
                    }],
                  },
                },
              ],
            },
          },

        ],
      },
    },
    include: {
      modules: {
        include: {
          lessons: { select: { id: true, title: true } },
        },
      },
    },
  });

  console.log(`  ↳ Course created: /catalog/${COURSE_SLUG} (id: ${course.id})`);

  // ── 4. Skill → Lesson tags (ContentSkillMapping) ─────────────────────────────
  console.log("\n4. Lesson skill tags");

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const lessonByTitle = new Map(allLessons.map((l) => [l.title, l.id]));

  const lessonTags: Array<{ title: string; skills: string[] }> = [
    { title: "螺栓与螺母 — Bulông và Đai ốc",            skills: ["zh_cokhi.vocab.parts"] },
    { title: "齿轮与轴承 — Bánh răng và Ổ lăn",          skills: ["zh_cokhi.vocab.parts"] },
    { title: "钢铁与铝合金 — Vật liệu thông dụng",        skills: ["zh_cokhi.vocab.materials"] },
    { title: "扳手与钻头 — Dụng cụ cầm tay",              skills: ["zh_cokhi.vocab.tools", "zh_cokhi.vocab.measurements"] },
    { title: "切削与焊接 — Quy trình gia công cơ bản",    skills: ["zh_cokhi.vocab.processes"] },
    { title: "安全生产 — An toàn trong xưởng cơ khí",     skills: ["zh_cokhi.safety"] },
    { title: "工程图纸 — Đọc bản vẽ kỹ thuật",           skills: ["zh_cokhi.drawing"] },
  ];

  for (const { title, skills } of lessonTags) {
    const lessonId = lessonByTitle.get(title);
    if (!lessonId) { console.warn(`  ⚠  Lesson not found: ${title}`); continue; }
    for (const code of skills) {
      const skillId = skillMap.get(code);
      if (!skillId) { console.warn(`  ⚠  Skill not found: ${code}`); continue; }
      await prisma.contentSkillMapping.upsert({
        where: { contentType_contentId_skillId: { contentType: "lesson", contentId: lessonId, skillId } },
        update: {},
        create: { contentType: "lesson", contentId: lessonId, skillId },
      });
      console.log(`  ↳ ${title}  →  ${code}`);
    }
  }

  // ── 5. Quizzes ───────────────────────────────────────────────────────────────
  console.log("\n5. Quizzes");

  // Quiz 1: Linh kiện — on lesson "螺栓与螺母"
  const lessonBulongId = lessonByTitle.get("螺栓与螺母 — Bulông và Đai ốc")!;
  const quiz1 = await prisma.quiz.create({
    data: {
      courseId:         course.id,
      lessonId:         lessonBulongId,
      title:            "Quiz 1: Từ vựng Linh kiện",
      description:      "Kiểm tra nhanh từ vựng về bulông, đai ốc, bánh răng và ổ lăn.",
      difficulty:       1,
      passThresholdPct: 70,
      timeLimitSec:     300,
      maxAttempts:      5,
      questions: {
        create: [
          {
            type: "mcq",
            prompt: "螺栓 trong tiếng Việt có nghĩa là gì?",
            explanation: "螺栓 (luóshuān) = Bulông — chi tiết có ren ngoài, dùng kèm với đai ốc (螺母) để kẹp chặt.",
            points: 2,
            orderIndex: 0,
            options: { create: [
              { label: "Bulông",  isCorrect: true,  orderIndex: 0 },
              { label: "Đai ốc",  isCorrect: false, orderIndex: 1 },
              { label: "Ổ lăn",   isCorrect: false, orderIndex: 2 },
              { label: "Bánh răng", isCorrect: false, orderIndex: 3 },
            ]},
          },
          {
            type: "true_false",
            prompt: "齿轮 có nghĩa là 'Ổ lăn'.",
            explanation: "Sai. 齿轮 (chǐlún) = Bánh răng. Ổ lăn là 轴承 (zhóuchéng).",
            points: 1,
            orderIndex: 1,
            options: { create: [
              { label: "Đúng", isCorrect: false, orderIndex: 0 },
              { label: "Sai",  isCorrect: true,  orderIndex: 1 },
            ]},
          },
          {
            type: "mcq",
            prompt: "Chi tiết nào dùng để giảm ma sát giữa trục và vỏ máy?",
            explanation: "轴承 (ổ lăn/ổ đỡ) có chức năng giảm ma sát và đỡ trục quay.",
            points: 2,
            orderIndex: 2,
            options: { create: [
              { label: "弹簧 (Lò xo)",      isCorrect: false, orderIndex: 0 },
              { label: "轴承 (Ổ lăn)",       isCorrect: true,  orderIndex: 1 },
              { label: "螺栓 (Bulông)",      isCorrect: false, orderIndex: 2 },
              { label: "键 (Then)",          isCorrect: false, orderIndex: 3 },
            ]},
          },
          {
            type: "fill_in",
            prompt: "Điền từ tiếng Trung: _____ là 'lò xo' trong cơ khí.",
            explanation: "弹簧 (tánhuáng) = lò xo — chi tiết đàn hồi dùng để tích trữ và giải phóng năng lượng.",
            points: 2,
            orderIndex: 3,
            options: { create: [
              { label: "弹簧",   isCorrect: true, orderIndex: 0 },
              { label: "tánhuáng", isCorrect: true, orderIndex: 1 },
            ]},
          },
          {
            type: "mcq",
            prompt: "螺纹 là gì?",
            explanation: "螺纹 (luówén) = Ren vít — đường xoắn ốc trên bề mặt bulông hoặc lỗ.",
            points: 2,
            orderIndex: 4,
            options: { create: [
              { label: "Ren vít",   isCorrect: true,  orderIndex: 0 },
              { label: "Chốt",     isCorrect: false, orderIndex: 1 },
              { label: "Bánh vít", isCorrect: false, orderIndex: 2 },
              { label: "Vòng bi",  isCorrect: false, orderIndex: 3 },
            ]},
          },
        ],
      },
    },
    include: { questions: { select: { id: true } } },
  });
  const partsSkillId = skillMap.get("zh_cokhi.vocab.parts")!;
  await prisma.questionSkillTag.createMany({
    data: quiz1.questions.map((q) => ({ questionId: q.id, skillId: partsSkillId })),
    skipDuplicates: true,
  });
  console.log(`  ↳ Quiz 1 created (${quiz1.questions.length} questions) → zh_cokhi.vocab.parts`);

  // Quiz 2: Dụng cụ — on lesson "扳手与钻头"
  const lessonToolsId = lessonByTitle.get("扳手与钻头 — Dụng cụ cầm tay")!;
  const quiz2 = await prisma.quiz.create({
    data: {
      courseId:         course.id,
      lessonId:         lessonToolsId,
      title:            "Quiz 2: Từ vựng Dụng cụ",
      description:      "Kiểm tra từ vựng dụng cụ cơ khí: cờ lê, mũi khoan, giũa, thước kẹp.",
      difficulty:       1,
      passThresholdPct: 70,
      timeLimitSec:     300,
      maxAttempts:      5,
      questions: {
        create: [
          {
            type: "mcq",
            prompt: "扳手 trong tiếng Việt là gì?",
            explanation: "扳手 (bānshǒu) = Cờ lê — dụng cụ vặn bulông và đai ốc.",
            points: 2,
            orderIndex: 0,
            options: { create: [
              { label: "Mũi khoan", isCorrect: false, orderIndex: 0 },
              { label: "Cờ lê",    isCorrect: true,  orderIndex: 1 },
              { label: "Giũa",     isCorrect: false, orderIndex: 2 },
              { label: "Búa",      isCorrect: false, orderIndex: 3 },
            ]},
          },
          {
            type: "true_false",
            prompt: "游标卡尺 là dụng cụ đo kích thước chính xác.",
            explanation: "Đúng. 游标卡尺 (thước kẹp / vernier caliper) đo được đường kính ngoài, đường kính trong và chiều sâu.",
            points: 1,
            orderIndex: 1,
            options: { create: [
              { label: "Đúng", isCorrect: true,  orderIndex: 0 },
              { label: "Sai",  isCorrect: false, orderIndex: 1 },
            ]},
          },
          {
            type: "mcq",
            prompt: "Dụng cụ nào dùng để làm phẳng bề mặt kim loại bằng cách mài thủ công?",
            explanation: "锉刀 (cuòdāo) = Giũa — dụng cụ mài tay, có bề mặt nhám.",
            points: 2,
            orderIndex: 2,
            options: { create: [
              { label: "螺丝刀 (Tua vít)", isCorrect: false, orderIndex: 0 },
              { label: "锤子 (Búa)",       isCorrect: false, orderIndex: 1 },
              { label: "锉刀 (Giũa)",      isCorrect: true,  orderIndex: 2 },
              { label: "钻头 (Mũi khoan)", isCorrect: false, orderIndex: 3 },
            ]},
          },
          {
            type: "fill_in",
            prompt: "_____ là 'mũi khoan' (phụ kiện gắn vào máy khoan để tạo lỗ).",
            explanation: "钻头 (zuāntóu) = mũi khoan.",
            points: 2,
            orderIndex: 3,
            options: { create: [
              { label: "钻头",   isCorrect: true, orderIndex: 0 },
              { label: "zuāntóu", isCorrect: true, orderIndex: 1 },
            ]},
          },
        ],
      },
    },
    include: { questions: { select: { id: true } } },
  });
  const toolsSkillId = skillMap.get("zh_cokhi.vocab.tools")!;
  const measurementsSkillId = skillMap.get("zh_cokhi.vocab.measurements")!;
  await prisma.questionSkillTag.createMany({
    data: [
      ...quiz2.questions.map((q) => ({ questionId: q.id, skillId: toolsSkillId })),
      // câu hỏi về thước kẹp (index 1) cũng tag measurements
      { questionId: quiz2.questions[1]!.id, skillId: measurementsSkillId },
    ],
    skipDuplicates: true,
  });
  console.log(`  ↳ Quiz 2 created (${quiz2.questions.length} questions) → zh_cokhi.vocab.tools + measurements`);

  // ── 6. Tournament + Missions ─────────────────────────────────────────────────
  console.log("\n6. Tournament");

  const now = new Date();
  const startsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);      // tomorrow
  const endsAt   = new Date(now.getTime() + 8  * 24 * 60 * 60 * 1000); // +8 days

  const tournament = await prisma.tournament.create({
    data: {
      title:       "Nhập môn Từ vựng Cơ khí",
      description: "Tournament khai mạc cho học viên bắt đầu học tiếng Trung kỹ thuật ngành cơ khí. Hoàn thành 4 nhiệm vụ để nhận XP và lên bảng xếp hạng.",
      status:      "draft",
      courseId:    course.id,
      creatorId:   instructorId,
      startsAt,
      endsAt,
      prizeXp:     5000,
      prizeDistribution: { "1": 50, "2": 30, "3": 20 },
    },
  });
  console.log(`  ↳ Tournament created: id=${tournament.id}`);

  // Missions (created sequentially to get IDs for prereq chain)
  const m1 = await prisma.tournamentMission.create({
    data: {
      tournamentId:   tournament.id,
      orderIndex:     1,
      title:          "Khởi động: Học 3 bài đầu tiên",
      description:    "Hoàn thành ít nhất 3 bài học bất kỳ trong khoá học. Đây là bước đặt nền tảng từ vựng trước khi thử thách quiz.",
      points:         200,
      conditionType:  "lesson_completed_count",
      conditionValue: 3,
      conditionScope: "course",
    },
  });

  const m2 = await prisma.tournamentMission.create({
    data: {
      tournamentId:   tournament.id,
      orderIndex:     2,
      title:          "Vượt vũ môn: Qua 2 bài kiểm tra",
      description:    "Vượt qua ít nhất 2 quiz trong khoá học với điểm đạt yêu cầu (≥ 70%). Áp dụng từ vựng đã học vào bài thi.",
      points:         300,
      conditionType:  "quiz_passed_count",
      conditionValue: 2,
      conditionScope: "course",
      prerequisiteId: m1.id,  // phải hoàn thành M1 trước
    },
  });

  await prisma.tournamentMission.create({
    data: {
      tournamentId:   tournament.id,
      orderIndex:     3,
      title:          "Chuyên cần: Học 3 ngày liên tiếp",
      description:    "Đăng nhập và học ít nhất 1 bài mỗi ngày trong 3 ngày liên tiếp. Rèn thói quen học đều đặn — chìa khoá ghi nhớ từ vựng dài hạn.",
      points:         400,
      conditionType:  "streak_days",
      conditionValue: 3,
      conditionScope: "course",
      // song song với M1, không cần prereq
    },
  });

  await prisma.tournamentMission.create({
    data: {
      tournamentId:      tournament.id,
      orderIndex:        4,
      title:             "Thuộc lòng: Master 3 từ vựng nhóm cơ khí",
      description:       "Đạt ngưỡng thành thạo (mastery ≥ 90%) cho ít nhất 3 skill trong nhóm từ vựng zh_cokhi.vocab. Hệ thống đo qua kết quả quiz và độ chắc chắn khi trả lời.",
      points:            800,
      conditionType:     "skill_mastered_in_group",
      conditionValue:    3,
      conditionScope:    "course",
      conditionSkillCode: "zh_cokhi.vocab",
      prerequisiteId:    m2.id,  // phải vượt M2 trước
    },
  });

  console.log("  ↳ 4 missions created (M1 → M2 → M4, M3 solo)");

  // ── Done ─────────────────────────────────────────────────────────────────────
  console.log("\n✅  Seed complete!\n");
  console.log("  Instructor:  ", INSTRUCTOR_EMAIL, "/", PASSWORD);
  console.log("  Learner:     ", LEARNER_EMAIL,    "/", PASSWORD);
  console.log("  Course:       /catalog/" + COURSE_SLUG);
  console.log("  Tournament:   /instructor/tournaments/" + tournament.id);
  console.log("\n  Missions:");
  console.log("    M1 (id:", m1.id, ") — lesson_completed_count × 3");
  console.log("    M2 (id:", m2.id, ") — quiz_passed_count × 2  [prereq: M1]");
  console.log("    M3                  — streak_days × 3");
  console.log("    M4                  — skill_mastered_in_group zh_cokhi.vocab × 3  [prereq: M2]");
  console.log("\n  Next: /instructor/tournaments/" + tournament.id + " → Validate → Publish");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
