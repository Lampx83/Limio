/**
 * Seed dữ liệu để thử lịch + kỳ học (dashboard học viên / workspace giáo viên):
 *
 *   Trường  : dùng org BKHN nếu có, không thì tạo (code BKHN)
 *   Kỳ học  : "Học kỳ 20261" (tuần 1 bắt đầu 07/09/2026, 15 tuần) + "Học kỳ 20262" (08/02/2027, 15 tuần)
 *   Tài khoản (password1234 — demo công khai, không đặc quyền như alice/bob/charlie):
 *     lich.gv@feedbackme.dev       Giảng viên, thuộc BKHN, dạy khoá demo
 *     lich.sv@feedbackme.dev       Học viên, thuộc BKHN → thấy nhãn tuần + tên trường
 *     lich.tudo@feedbackme.dev     Học viên KHÔNG thuộc trường → lịch trơn, không nhãn
 *     lich.orgadmin@feedbackme.dev OrgAdmin của BKHN → /org-admin/settings
 *   Lớp     : khoá demo có 2 lớp — K65A (lich.sv) và K65B (lich.tudo); alice chưa gán lớp. Có sẵn hạn riêng theo
 *             lớp cho Bài tập 3, Bài tập 6 (đặt chung 2 lớp) và Quiz 1.
 *   Khoá    : "demo-lich-hoc" với các bài tập + quiz có hạn tính TƯƠNG ĐỐI so với hôm nay
 *             (quá hạn, hôm nay, sắp tới, đã nộp/đã làm, đã chấm, mỗi loại 1 mục ẩn).
 *
 * Idempotent: chạy lại sẽ dời các hạn nộp về đúng vị trí so với hôm nay.
 * Không xoá gì. alice chỉ được ghi danh vào khoá demo (không sửa gì khác của alice).
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/client";
import { RoleName } from "@feedbackme/shared-types";
import { seedDefaultSectionId } from "./seedHelpers";

const prisma = new PrismaClient();
const PASSWORD = "password1234";
const COURSE_SLUG = "demo-lich-hoc";

/** Ngày lịch VN hôm nay + offset, dạng YYYY-MM-DD. */
function vnDayKey(offsetDays: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const t = new Date(`${parts}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + offsetDays);
  return t.toISOString().slice(0, 10);
}

/** Giờ VN → Date (VN không có giờ mùa hè, luôn +07:00). */
function due(offsetDays: number, hhmm: string): Date {
  return new Date(`${vnDayKey(offsetDays)}T${hhmm}:00+07:00`);
}

async function ensureUser(email: string, displayName: string, roles: string[], organizationId: string | null) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, emailVerifiedAt: new Date(), organizationId, displayName },
    create: { email, passwordHash, displayName, emailVerifiedAt: new Date(), organizationId },
  });
  const hasProvider = await prisma.authProvider.findFirst({ where: { userId: user.id, provider: "password" } });
  if (!hasProvider) {
    await prisma.authProvider.create({ data: { userId: user.id, provider: "password", providerUserId: email } });
  }
  for (const name of roles) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name } });
    const has = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id } });
    if (!has) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, grantedBy: user.id } });
  }
  return user.id;
}

async function ensureSection(courseId: string, name: string): Promise<string> {
  const existing = await prisma.courseSection.findFirst({ where: { courseId, name }, select: { id: true } });
  if (existing) return existing.id;
  return (await prisma.courseSection.create({ data: { courseId, name }, select: { id: true } })).id;
}

async function main() {
  // ── Trường + kỳ học ───────────────────────────────────────────────
  const org =
    (await prisma.organization.findUnique({ where: { code: "BKHN" } })) ??
    (await prisma.organization.create({ data: { code: "BKHN", name: "Đại học Bách khoa Hà Nội" } }));

  const terms = [
    { name: "Học kỳ 20261", startDate: "2026-09-07", weekCount: 15 },
    { name: "Học kỳ 20262", startDate: "2027-02-08", weekCount: 15 },
  ];
  for (const t of terms) {
    const existing = await prisma.academicTerm.findFirst({ where: { organizationId: org.id, name: t.name } });
    const data = { name: t.name, startDate: new Date(`${t.startDate}T00:00:00.000Z`), weekCount: t.weekCount };
    if (existing) await prisma.academicTerm.update({ where: { id: existing.id }, data });
    else await prisma.academicTerm.create({ data: { organizationId: org.id, ...data } });
  }

  // ── Tài khoản ─────────────────────────────────────────────────────
  const teacherId = await ensureUser("lich.gv@feedbackme.dev", "GV Lịch (Demo)", [RoleName.Learner, RoleName.Instructor], org.id);
  const studentId = await ensureUser("lich.sv@feedbackme.dev", "SV Lịch — thuộc BKHN (Demo)", [RoleName.Learner], org.id);
  const freeStudentId = await ensureUser("lich.tudo@feedbackme.dev", "SV Lịch — không trường (Demo)", [RoleName.Learner], null);
  const orgAdminId = await ensureUser(
    "lich.orgadmin@feedbackme.dev",
    "OrgAdmin BKHN (Demo)",
    [RoleName.Learner, RoleName.Instructor],
    org.id,
  );
  await prisma.organizationAdmin.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: orgAdminId } },
    update: {},
    create: { organizationId: org.id, userId: orgAdminId },
  });

  // ── Khoá + bài học ────────────────────────────────────────────────
  let course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        slug: COURSE_SLUG,
        title: "Demo lịch & hạn nộp",
        description: "Khoá dữ liệu mẫu để thử lịch tuần/tháng và nhãn kỳ học.",
        organizationId: org.id,
        status: "published",
        publishedAt: new Date(),
        instructors: { create: { userId: teacherId, role: "owner" } },
        modules: { create: [{ orderIndex: 0, title: "Module 1 — Bài tập có hạn" }] },
      },
    });
  }
  const mod = await prisma.module.findFirstOrThrow({ where: { courseId: course.id }, orderBy: { orderIndex: "asc" } });

  const specs: Array<{
    title: string;
    dueAt: Date | null;
    isHidden?: boolean;
    submission?: "submitted" | "graded";
  }> = [
    { title: "Bài tập 1 — Phỏng vấn người dùng", dueAt: due(-3, "23:59") }, // quá hạn, chưa nộp
    { title: "Bài tập 2 — Persona", dueAt: due(-1, "23:59"), submission: "graded" },
    { title: "Bài tập 3 — Wireframe", dueAt: due(0, "23:59") }, // hôm nay
    { title: "Bài tập 4 — Phản hồi đồng đẳng", dueAt: due(0, "17:00") }, // hôm nay (ngày có 2 bài)
    { title: "Bài tập 5 — Prototype", dueAt: due(2, "12:00"), submission: "submitted" },
    { title: "Bài tập 6 — Kiểm thử khả dụng", dueAt: due(5, "23:59") },
    { title: "Bài tập 7 — Báo cáo tuần sau", dueAt: due(9, "08:00") },
    { title: "Bài tập 8 — Đồ án giữa kỳ", dueAt: due(35, "23:59") }, // tháng sau
    { title: "Bài tập ẨN — không được hiện cho SV", dueAt: due(1, "10:00"), isHidden: true },
    { title: "Bài tập 11 — Nộp bài cũ (quá hạn 9 ngày)", dueAt: due(-9, "23:59") }, // > 1 tuần: tự ẩn khỏi top 5
    { title: "Bài tập 9 — Đọc thêm (không hạn)", dueAt: null }, // khu "Không có thời hạn"
    { title: "Bài tập 10 — Nhật ký học tập (không hạn)", dueAt: null },
  ];

  for (const [i, spec] of specs.entries()) {
    const lesson =
      (await prisma.lesson.findFirst({ where: { moduleId: mod.id, orderIndex: i } })) ??
      (await prisma.lesson.create({
        data: {
          moduleId: mod.id,
          orderIndex: i,
          title: `Bài ${i + 1} — ${spec.title.split("— ")[1] ?? spec.title}`,
          contentItems: { create: [{ orderIndex: 0, type: "markdown", payload: { body: `Nội dung ${spec.title}.` } }] },
        },
      }));
    const existing = await prisma.assignment.findFirst({ where: { lessonId: lesson.id } });
    const data = {
      title: spec.title,
      description: "Bài tập mẫu để thử lịch.",
      dueAt: spec.dueAt,
      isHidden: spec.isHidden ?? false,
    };
    const assignment = existing
      ? await prisma.assignment.update({ where: { id: existing.id }, data })
      : await prisma.assignment.create({ data: { lessonId: lesson.id, ...data } });

    if (spec.submission) {
      await prisma.assignmentSubmission.upsert({
        where: { assignmentId_userId: { assignmentId: assignment.id, userId: studentId } },
        update: {},
        create: {
          assignmentId: assignment.id,
          userId: studentId,
          body: "Bài nộp mẫu.",
          status: spec.submission,
          ...(spec.submission === "graded"
            ? { score: 85, feedback: "Làm tốt.", graderId: teacherId, gradedAt: new Date() }
            : {}),
        },
      });
    }
  }

  // ── Quiz có "Hạn đóng" (đứng riêng trong khoá, không gắn bài học) ──────
  const quizSpecs: Array<{ title: string; dueAt: Date | null; isHidden?: boolean; attempt?: { scorePct: number } }> = [
    { title: "Quiz 1 — Nguyên tắc thiết kế", dueAt: due(0, "20:00") }, // hôm nay, chưa làm
    { title: "Quiz 2 — Màu sắc", dueAt: due(3, "12:00"), attempt: { scorePct: 85 } }, // đã làm
    { title: "Quiz 3 — Typography", dueAt: due(-2, "18:00") }, // quá hạn, chưa làm
    { title: "Quiz ẨN — không được hiện cho SV", dueAt: due(1, "09:00"), isHidden: true },
    { title: "Quiz 4 — Ôn tập tự do (không hạn)", dueAt: null },
  ];
  for (const spec of quizSpecs) {
    const existing = await prisma.quiz.findFirst({ where: { courseId: course.id, title: spec.title } });
    const data = { title: spec.title, dueAt: spec.dueAt, isHidden: spec.isHidden ?? false };
    const quiz = existing
      ? await prisma.quiz.update({ where: { id: existing.id }, data })
      : await prisma.quiz.create({ data: { courseId: course.id, ...data } });
    if (spec.attempt) {
      const done = await prisma.quizAttempt.findFirst({ where: { quizId: quiz.id, userId: studentId, status: "submitted" } });
      if (!done) {
        await prisma.quizAttempt.create({
          data: {
            quizId: quiz.id,
            userId: studentId,
            status: "submitted",
            submittedAt: new Date(),
            scorePct: spec.attempt.scorePct,
            passed: spec.attempt.scorePct >= 70,
          },
        });
      }
    }
  }

  // ── Ghi danh ──────────────────────────────────────────────────────
  const sectionId = await seedDefaultSectionId(course.id, prisma);
  // alice (giảng viên demo có sẵn) cũng học khoá này để xem /me/dashboard ở vai học viên.
  // Chỉ ghi danh, không sửa gì khác của alice; DB mới chưa có alice thì bỏ qua.
  const alice = await prisma.user.findUnique({ where: { email: "alice@feedbackme.dev" }, select: { id: true } });
  for (const userId of [studentId, freeStudentId, ...(alice ? [alice.id] : [])]) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId: course.id } },
      update: { status: "active" },
      create: { userId, courseId: course.id, sectionId, courseVersion: course.version, status: "active" },
    });
  }

  // ── Hạn theo lớp ──────────────────────────────────────────────────
  // lich.sv → K65A, lich.tudo → K65B, alice để "chưa gán lớp" (luôn theo hạn chung).
  const sectionA = await ensureSection(course.id, "Lớp K65A");
  const sectionB = await ensureSection(course.id, "Lớp K65B");
  await prisma.enrollment.update({ where: { userId_courseId: { userId: studentId, courseId: course.id } }, data: { sectionId: sectionA } });
  await prisma.enrollment.update({ where: { userId_courseId: { userId: freeStudentId, courseId: course.id } }, data: { sectionId: sectionB } });

  const assignmentByTitle = async (t: string) => prisma.assignment.findFirstOrThrow({ where: { title: t, lesson: { module: { courseId: course.id } } } });
  const quizByTitle = async (t: string) => prisma.quiz.findFirstOrThrow({ where: { title: t, courseId: course.id } });

  // Bài 3: hạn chung hôm nay 23:59; K65A được lùi 3 ngày, K65B theo hạn chung.
  const bt3 = await assignmentByTitle("Bài tập 3 — Wireframe");
  await prisma.assignmentSectionDue.upsert({
    where: { assignmentId_sectionId: { assignmentId: bt3.id, sectionId: sectionA } },
    update: { dueAt: due(3, "23:59") },
    create: { assignmentId: bt3.id, sectionId: sectionA, dueAt: due(3, "23:59") },
  });
  await prisma.assignmentSectionDue.deleteMany({ where: { assignmentId: bt3.id, sectionId: sectionB } });
  // Bài 6: đặt CHUNG một hạn cho cả hai lớp (khác hạn chung).
  const bt6 = await assignmentByTitle("Bài tập 6 — Kiểm thử khả dụng");
  for (const sectionId of [sectionA, sectionB]) {
    await prisma.assignmentSectionDue.upsert({
      where: { assignmentId_sectionId: { assignmentId: bt6.id, sectionId } },
      update: { dueAt: due(8, "12:00") },
      create: { assignmentId: bt6.id, sectionId, dueAt: due(8, "12:00") },
    });
  }
  // Quiz 1: hạn chung hôm nay 20:00; K65B được gia hạn thêm 2 ngày.
  const q1 = await quizByTitle("Quiz 1 — Nguyên tắc thiết kế");
  await prisma.quizSectionSchedule.upsert({
    where: { quizId_sectionId: { quizId: q1.id, sectionId: sectionB } },
    update: { opensAt: null, dueAt: due(2, "20:00") },
    create: { quizId: q1.id, sectionId: sectionB, opensAt: null, dueAt: due(2, "20:00") },
  });
  await prisma.quizSectionSchedule.deleteMany({ where: { quizId: q1.id, sectionId: sectionA } });

  console.log(`Seed lịch xong. Org=${org.code}, khoá=/learn/${COURSE_SLUG}, password chung: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
