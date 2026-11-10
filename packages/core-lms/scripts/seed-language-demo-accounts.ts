/**
 * Hai tài khoản đăng nhập SẴN cho dev DB để thử Limio Language, kèm dữ liệu học (khoá "Tiếng Trung cơ bản (demo ngoại
 * ngữ)"): một học viên (mục tiêu, một câu luyện làm sai, lịch ôn thẻ) và một giảng viên (đồng chủ khoá demo, để thử mục
 * "Thư viện giáo trình" và khối "Bài luyện").
 *
 * Hai tài khoản dùng MẬT KHẨU DEMO CHUNG của dev (hằng DEMO_PASSWORD ở
 * apps/web/src/app/(auth)/signin/SignInForm.tsx) và hiện trong khung "Tài khoản demo (dev only)" cạnh ô đăng nhập, có nút
 * "Điền" / "Vào". Khung đó chỉ hiện khi NODE_ENV khác production. Chạy lại luôn đặt lại mật khẩu về giá trị chung. Chỉ
 * dùng cho dev DB.
 *
 *   node --env-file=../db/.env --import tsx scripts/seed-language-demo-accounts.ts
 *
 * Chạy sau scripts/seed-language-demo.ts và scripts/seed-language-demo-dot4.ts.
 */

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@feedbackme/db";
import type { FlashcardRating } from "@feedbackme/shared-types";
import { enrollInCourse } from "../src/learning/enroll";
import { setGoal } from "../src/courses/learnerGoals";
import { checkPracticeAnswer, completePracticeSession, getPracticeSession, savePracticeAnswer, startPracticeSession } from "../src/exam";
import { reviewFlashcard } from "../../core-feedback/src/flashcards";

const COURSE_SLUG = "demo-ngoai-ngu-tieng-trung";
const EXAM_TITLE = "Thi thử HSK 3 (demo)";
const LEARNER = { email: "lang.hocvien@feedbackme.dev", name: "Học viên Language" };
const TEACHER = { email: "lang.giangvien@feedbackme.dev", name: "Giảng viên Language" };
/** Phải khớp DEMO_PASSWORD ở SignInForm.tsx (mật khẩu demo chung của dev, không phải bí mật). */
const DEMO_PASSWORD = "password1234";
const DAY = 24 * 60 * 60 * 1000;
const log = (m: string) => console.log("•", m);

async function ensureUser(email: string, name: string, roleNames: string[]) {
  let user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    const seen = new Date().toISOString();
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
        displayName: name,
        emailVerifiedAt: new Date(),
        // Đã xem hướng dẫn lần đầu để cửa sổ tour không che màn hình.
        helpTourCompletedByRole: { learner: seen, instructor: seen },
      },
      select: { id: true },
    });
    await prisma.authProvider.create({ data: { userId: user.id, provider: "password", providerUserId: email } });
    log(`đã tạo tài khoản ${email}`);
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) } });
    log(`đã đặt mật khẩu demo chung cho ${email}`);
  }
  for (const r of roleNames) {
    const role = await prisma.role.upsert({ where: { name: r }, update: {}, create: { name: r } });
    // courseId có thể null nên không dùng được khoá duy nhất ghép để upsert.
    const has = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id, courseId: null }, select: { id: true } });
    if (!has) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, grantedBy: user.id } });
  }
  return user.id;
}

async function main() {
  const learnerId = await ensureUser(LEARNER.email, LEARNER.name, ["learner"]);
  const teacherId = await ensureUser(TEACHER.email, TEACHER.name, ["learner", "instructor"]);

  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG }, select: { id: true } });
  if (!course) throw new Error(`Chưa có khoá ${COURSE_SLUG}: chạy scripts/seed-language-demo.ts trước.`);

  // Giảng viên: đồng chủ khoá demo (chủ khoá mới được đổi thông tin thư viện).
  await prisma.courseInstructor.upsert({
    where: { courseId_userId: { courseId: course.id, userId: teacherId } },
    update: { role: "owner" },
    create: { courseId: course.id, userId: teacherId, role: "owner" },
  });

  // Học viên: ghi danh, mục tiêu, thẻ ôn, một câu luyện sai.
  await enrollInCourse(learnerId, course.id).catch(() => undefined);
  if (!(await prisma.learnerGoal.findFirst({ where: { userId: learnerId, courseId: course.id, status: "active" } }))) {
    const day = new Date(Date.now() + 75 * DAY).toISOString().slice(0, 10);
    await setGoal(learnerId, { courseId: course.id, framework: "HSK", targetLevel: "HSK 3", targetDate: day, hoursPerWeek: 4 });
    log("đã đặt mục tiêu HSK 3");
  }

  if ((await prisma.flashcardState.count({ where: { userId: learnerId, courseId: course.id } })) === 0) {
    const blocks = await prisma.contentItem.findMany({ where: { type: "vocab_list", lesson: { module: { courseId: course.id }, isHidden: false } }, select: { payload: true } });
    const idOf = new Map<string, string>();
    for (const b of blocks) for (const it of (b.payload as { items?: Array<{ id: string; term: string }> }).items ?? []) if (!idOf.has(it.term)) idOf.set(it.term, it.id);
    const plans: Array<[string, number, FlashcardRating[]]> = [
      ["你好", 40, ["good", "good", "easy"]],
      ["谢谢", 15, ["good", "good"]],
      ["再见", 4, ["good"]], // đến hạn
      ["老师", 3, ["hard"]], // đến hạn
      ["学生", 8, ["good", "good"]], // đến hạn
      ["中国", 1, ["easy"]],
    ];
    for (const [term, startDaysAgo, ratings] of plans) {
      const itemId = idOf.get(term);
      if (!itemId) continue;
      let when = new Date(Date.now() - startDaysAgo * DAY);
      for (const rating of ratings) {
        const res = await reviewFlashcard(learnerId, course.id, { itemId, rating, mode: "term_to_meaning", reviewId: randomUUID() }, when);
        when = new Date(Math.min(res.state.dueAt.getTime() + 9 * 3_600_000, Date.now() - 3_600_000));
      }
    }
    log("đã tạo lịch ôn thẻ từ vựng");
  }

  const exam = await prisma.exam.findFirst({ where: { courseId: course.id, title: EXAM_TITLE, mockMode: true, status: "published" }, select: { id: true } });
  if (exam && (await prisma.examPracticeAnswer.count({ where: { session: { userId: learnerId, examId: exam.id }, isCorrect: false } })) === 0) {
    const { sessionId } = await startPracticeSession(learnerId, exam.id, { all: true });
    const s = await getPracticeSession(learnerId, sessionId);
    const q = s.questions.find((x) => x.type === "mcq");
    const wrong = (q?.config as { options?: Array<{ id: string }> } | undefined)?.options?.[1]?.id;
    if (q && wrong) {
      await savePracticeAnswer(learnerId, sessionId, q.id, { optionIds: [wrong] });
      await checkPracticeAnswer(learnerId, sessionId, q.id);
    }
    await completePracticeSession(learnerId, sessionId);
    log('đã tạo một câu luyện làm sai ("Câu luyện nên làm lại")');
  }
  console.log("Xong. Rerun an toàn.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
