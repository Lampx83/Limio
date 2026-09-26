/**
 * Seed dữ liệu để thử tab "Gamification" của GV (khoá "Demo Gamification"):
 *   - 1 khoá published, 2 lớp (K65A, K65B) + lớp mặc định
 *   - 8 học viên demo (gami-01..08@feedbackme.dev, password1234): XP/level/streak
 *     khác nhau, 1 người 0 XP, 1 người opt-out leaderboard, 1 người ở lớp mặc định
 *   - badge gắn khoá (context.courseId) + 1 badge của khoá khác + 1 badge không context
 *     để thấy bộ lọc theo khoá hoạt động
 *   - giao dịch XP gần đây cho drill-down
 *
 * Chủ khoá: alice@feedbackme.dev (cần chạy seed-demo-users trước) và, nếu set
 * INSTRUCTOR_EMAIL, thêm tài khoản đó làm owner.
 *
 * Idempotent — chạy lại chỉ upsert. Chỉ chạm khoá slug "demo-gamification".
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/client";
import { RoleName } from "@feedbackme/shared-types";
import { seedDefaultSectionId } from "./seedHelpers";

const prisma = new PrismaClient();
const SLUG = "demo-gamification";
const PASSWORD = "password1234";

const BADGES = [
  { code: "first_step", name: "First Step", emoji: "🎯", description: "Hoàn thành bài học đầu tiên." },
  { code: "quiz_starter", name: "Quiz Starter", emoji: "✍️", description: "Bắt đầu bài kiểm tra đầu tiên." },
  { code: "first_win", name: "First Win", emoji: "✅", description: "Vượt qua bài kiểm tra đầu tiên." },
  { code: "perfect_score", name: "Perfect Score", emoji: "💯", description: "Đạt 100% trong một bài kiểm tra." },
  { code: "course_complete", name: "Course Complete", emoji: "🎓", description: "Hoàn thành toàn bộ một khoá học." },
];

// section: "A" | "B" | "default"; badges = chỉ số vào BADGES (gắn khoá này)
const LEARNERS = [
  { n: 1, name: "Nguyễn Văn An", section: "A", xp: 620, level: 5, streak: 12, longest: 12, badges: [0, 1, 2, 3], optOut: false },
  { n: 2, name: "Trần Thị Bình", section: "A", xp: 480, level: 4, streak: 5, longest: 9, badges: [0, 1, 2], optOut: false },
  { n: 3, name: "Lê Minh Châu", section: "A", xp: 310, level: 3, streak: 0, longest: 4, badges: [0, 1], optOut: true },
  { n: 4, name: "Phạm Quốc Dũng", section: "B", xp: 250, level: 3, streak: 2, longest: 6, badges: [0], optOut: false },
  { n: 5, name: "Hoàng Thu Hà", section: "B", xp: 120, level: 2, streak: 1, longest: 3, badges: [0], optOut: false },
  { n: 6, name: "Vũ Đức Huy", section: "B", xp: 40, level: 1, streak: 0, longest: 1, badges: [], optOut: false },
  { n: 7, name: "Đỗ Khánh Linh", section: "default", xp: 90, level: 2, streak: 3, longest: 3, badges: [0], optOut: false },
  { n: 8, name: "Bùi Gia Minh (chưa học)", section: "A", xp: 0, level: 1, streak: 0, longest: 0, badges: [], optOut: false },
] as const;

const REASONS = ["lesson.completed", "quiz.passed.first_try", "quiz.attempt", "streak.bonus"];

async function upsertUser(email: string, displayName: string, roles: string[], optOut = false) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { leaderboardOptOut: optOut },
    create: { email, displayName, passwordHash, emailVerifiedAt: new Date(), leaderboardOptOut: optOut },
  });
  for (const r of roles) {
    const role = await prisma.role.findUnique({ where: { name: r } });
    if (!role) continue;
    const has = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id, courseId: null },
      select: { id: true },
    });
    if (!has) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  }
  return user;
}

async function main() {
  const owners: string[] = ["alice@feedbackme.dev"];
  if (process.env.INSTRUCTOR_EMAIL) owners.push(process.env.INSTRUCTOR_EMAIL);
  const ownerUsers = [];
  for (const email of owners) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) {
      console.warn(`! Không thấy user ${email} — bỏ qua (chạy seed:demo-users trước?)`);
      continue;
    }
    ownerUsers.push(u);
  }
  if (ownerUsers.length === 0) throw new Error("Không có chủ khoá nào tồn tại.");

  for (const b of BADGES) {
    await prisma.badge.upsert({ where: { code: b.code }, update: {}, create: b });
  }
  const badgeRows = await prisma.badge.findMany({ where: { code: { in: BADGES.map((b) => b.code) } } });
  const badgeByCode = new Map(badgeRows.map((b) => [b.code, b]));

  const course = await prisma.course.upsert({
    where: { slug: SLUG },
    update: { status: "published" },
    create: {
      slug: SLUG,
      title: "Demo Gamification",
      description: "Khoá dữ liệu mẫu để thử thống kê gamification của giảng viên.",
      status: "published",
      publishedAt: new Date(),
    },
  });
  for (const o of ownerUsers) {
    await prisma.courseInstructor.upsert({
      where: { courseId_userId: { courseId: course.id, userId: o.id } },
      update: {},
      create: { courseId: course.id, userId: o.id, role: "owner" },
    });
  }

  const defaultId = await seedDefaultSectionId(course.id, prisma);
  const sec: Record<string, string> = { default: defaultId };
  for (const [key, name] of [["A", "K65A"], ["B", "K65B"]] as const) {
    const s = await prisma.courseSection.upsert({
      where: { courseId_name: { courseId: course.id, name } },
      update: {},
      create: { courseId: course.id, name },
    });
    sec[key] = s.id;
  }

  const otherCourse = await prisma.course.findFirst({
    where: { id: { not: course.id } },
    select: { id: true },
  });

  for (const l of LEARNERS) {
    const u = await upsertUser(`gami-${String(l.n).padStart(2, "0")}@feedbackme.dev`, l.name, [RoleName.Learner], l.optOut);
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: u.id, courseId: course.id } },
      update: { sectionId: sec[l.section]! },
      create: { userId: u.id, courseId: course.id, sectionId: sec[l.section]!, courseVersion: 1 },
    });

    if (l.xp > 0) {
      await prisma.userCourseProgress.upsert({
        where: { userId_courseId: { userId: u.id, courseId: course.id } },
        update: { xp: l.xp, level: l.level },
        create: { userId: u.id, courseId: course.id, xp: l.xp, level: l.level },
      });
      // Chia XP thành ≤6 giao dịch rải trong 10 ngày gần đây.
      const parts = Math.min(6, Math.max(2, Math.ceil(l.xp / 100)));
      const per = Math.floor(l.xp / parts);
      for (let i = 0; i < parts; i++) {
        await prisma.xpTransaction.upsert({
          where: { userId_reason_sourceId: { userId: u.id, reason: REASONS[i % REASONS.length]!, sourceId: `demo-${l.n}-${i}` } },
          update: {},
          create: {
            userId: u.id,
            courseId: course.id,
            amount: i === parts - 1 ? l.xp - per * (parts - 1) : per,
            reason: REASONS[i % REASONS.length]!,
            sourceId: `demo-${l.n}-${i}`,
            occurredAt: new Date(Date.now() - i * 36 * 3600 * 1000),
          },
        });
      }
    }
    if (l.longest > 0) {
      await prisma.streakRecord.upsert({
        where: { userId_courseId: { userId: u.id, courseId: course.id } },
        update: { currentStreak: l.streak, longestStreak: l.longest },
        create: { userId: u.id, courseId: course.id, currentStreak: l.streak, longestStreak: l.longest, lastActiveDate: new Date() },
      });
    }
    for (const bi of l.badges) {
      const badge = badgeByCode.get(BADGES[bi]!.code)!;
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId: u.id, badgeId: badge.id } },
        update: { context: { courseId: course.id } },
        create: { userId: u.id, badgeId: badge.id, context: { courseId: course.id } },
      });
    }
  }

  // Bẫy cho bộ lọc theo khoá: An có thêm badge của khoá khác + badge không context.
  const an = await prisma.user.findUniqueOrThrow({ where: { email: "gami-01@feedbackme.dev" } });
  const extra = [
    { code: "course_complete", context: otherCourse ? { courseId: otherCourse.id } : { courseId: "other-course" } },
  ];
  for (const e of extra) {
    const badge = badgeByCode.get(e.code)!;
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: an.id, badgeId: badge.id } },
      update: {},
      create: { userId: an.id, badgeId: badge.id, context: e.context },
    });
  }

  console.log(`✓ Khoá "Demo Gamification": /instructor/courses/${course.id}?tab=gamification`);
  console.log(`  Chủ khoá: ${ownerUsers.map((u) => u.email).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
