/**
 * Dữ liệu MẪU cho dev DB để thử lịch dạy của trung tâm (CENTER C1): một giảng viên, khoá
 * "Tiếng Trung sơ cấp (demo trung tâm)", hai lớp có lịch (cố ý trùng giáo viên/phòng ở một buổi
 * để thấy cảnh báo), một buổi đã huỷ, một buổi dạy bù, và một học viên ghi danh vào lớp A.
 *
 * Mọi thứ đi qua hàm dịch vụ thật (createCourse, setClassSchedule, cancelMeeting…), không INSERT tay.
 * Rerun-safe: tìm-hoặc-tạo, không xoá gì. Mật khẩu lấy từ env DEMO_PASSWORD (≥ 12 ký tự), không ghi vào repo.
 *
 *   DEMO_PASSWORD='...' node --env-file=../db/.env --import tsx scripts/seed-center-demo.ts
 *
 * Chỉ dùng cho dev DB.
 */

import bcrypt from "bcryptjs";
import { prisma } from "@feedbackme/db";
import { addDays, isoWeekday, vnDateTime, vnDayKey } from "../src/courses/classScheduleCalc";
import { addMakeupMeeting, cancelMeeting, setClassSchedule } from "../src/courses/classSchedule";
import { createCourse, publishCourse } from "../src/courses/courses";
import { createModule } from "../src/courses/modules";
import { createLesson } from "../src/courses/lessons";
import { createCourseSection } from "../src/courses/sections";
import { enrollBySectionCode } from "../src/learning/enroll";

const TEACHER_EMAIL = "giangvien.trungtam@feedbackme.dev";
const LEARNER_EMAIL = "hocvien.trungtam@feedbackme.dev";
const COURSE_SLUG = "demo-trung-tam-tieng-trung-so-cap";

const log = (s: string) => console.log(s);

async function ensureUser(email: string, displayName: string, roles: string[], password: string) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return existing.id;
  const seen = new Date().toISOString();
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      displayName,
      emailVerifiedAt: new Date(),
      // Đã xem hướng dẫn lần đầu để cửa sổ tour không che màn hình.
      helpTourCompletedByRole: { learner: seen, instructor: seen },
    },
    select: { id: true },
  });
  await prisma.authProvider.create({ data: { userId: user.id, provider: "password", providerUserId: email } });
  for (const name of roles) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, grantedBy: user.id } });
  }
  return user.id;
}

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error("DEMO_PASSWORD chưa set hoặc ngắn hơn 12 ký tự.");

  const teacherId = await ensureUser(TEACHER_EMAIL, "Cô Lan (demo trung tâm)", ["learner", "instructor"], password);
  const learnerId = await ensureUser(LEARNER_EMAIL, "Học viên demo trung tâm", ["learner"], password);

  let course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG }, select: { id: true } });
  if (!course) {
    const c = await createCourse(teacherId, {
      title: "Tiếng Trung sơ cấp (demo trung tâm)",
      description: "Khoá mẫu để thử lịch dạy, điểm danh và nhận xét sau buổi của trung tâm ngoại ngữ.",
      slug: COURSE_SLUG,
    });
    const m = await createModule(teacherId, c.courseId, { title: "Bài 1", orderIndex: 0 });
    await createLesson(teacherId, m.moduleId, { title: "Chào hỏi", orderIndex: 0 });
    await publishCourse(teacherId, c.courseId).catch(() => log("(bỏ qua publish: khoá chưa đủ điều kiện)"));
    course = { id: c.courseId };
  }
  const courseId = course.id;

  const sections = await prisma.courseSection.findMany({ where: { courseId, isDefault: false }, select: { id: true, name: true, inviteCode: true } });
  const find = async (name: string) => {
    const hit = sections.find((s) => s.name === name);
    if (hit) return hit;
    const s = await createCourseSection(teacherId, courseId, { name, termLabel: "Khoá tháng 11" });
    return { id: s.id, name: s.name, inviteCode: s.inviteCode };
  };
  const classA = await find("Lớp A · T3 T5 tối");
  const classB = await find("Lớp B · T3 tối");

  // Khoá học bắt đầu từ thứ hai của tuần này để tuần hiện tại có buổi ngay.
  const today = vnDayKey(new Date());
  const monday = addDays(today, 1 - isoWeekday(today));

  const planA = {
    startDate: monday,
    totalMeetings: 24,
    slots: [
      { weekday: 2, startTime: "18:30", durationMin: 120, room: "B2", plannedTeacherId: teacherId },
      { weekday: 4, startTime: "18:30", durationMin: 120, room: "B2", plannedTeacherId: teacherId },
    ],
  };
  // Lớp B cố ý chồng giờ với lớp A vào thứ ba (cùng giáo viên, cùng phòng) để thấy cảnh báo.
  const planB = {
    startDate: monday,
    totalMeetings: 12,
    slots: [{ weekday: 2, startTime: "19:00", durationMin: 90, room: "B2", plannedTeacherId: teacherId }],
  };

  const existingA = await prisma.classMeeting.count({ where: { sectionId: classA.id } });
  const resA = await setClassSchedule(teacherId, classA.id, planA);
  const resB = await setClassSchedule(teacherId, classB.id, planB);
  log(`Lớp A: +${resA.created} buổi · Lớp B: +${resB.created} buổi · cảnh báo trùng ở B: ${resB.conflicts.length}`);

  // Lần đầu: huỷ buổi thứ năm đầu tiên của lớp A và thêm một buổi dạy bù vào thứ bảy.
  if (existingA === 0) {
    const second = await prisma.classMeeting.findFirstOrThrow({ where: { sectionId: classA.id }, orderBy: { startsAt: "asc" }, skip: 1 });
    await cancelMeeting(teacherId, second.id, { reason: "Giáo viên bận việc đột xuất" });
    const saturday = addDays(monday, 5);
    await addMakeupMeeting(teacherId, classA.id, {
      startsAt: vnDateTime(saturday, "09:00").toISOString(),
      durationMin: 120,
      room: "B2",
      plannedTeacherId: teacherId,
      makeupOfId: second.id,
    });
    log("Đã huỷ 1 buổi và thêm 1 buổi dạy bù ở lớp A.");
  }

  // Thêm vài học viên nữa để danh sách điểm danh đủ dài mà thử.
  const extra = [
    ["sv.trungtam.02@feedbackme.dev", "Nguyễn Minh Anh"],
    ["sv.trungtam.03@feedbackme.dev", "Trần Quốc Bảo"],
    ["sv.trungtam.04@feedbackme.dev", "Lê Thuỳ Chi"],
    ["sv.trungtam.05@feedbackme.dev", "Phạm Gia Hân"],
  ] as const;
  const learnerIds = [learnerId];
  for (const [email, name] of extra) learnerIds.push(await ensureUser(email, name, ["learner"], password));
  if (classA.inviteCode) {
    for (const userId of learnerIds) {
      const enrolled = await prisma.enrollment.findFirst({ where: { userId, courseId }, select: { id: true } });
      if (!enrolled) await enrollBySectionCode(userId, classA.inviteCode, prisma, { skipPaymentCheck: true });
    }
  }

  log(`Xong. Giảng viên: ${TEACHER_EMAIL} · học viên: ${LEARNER_EMAIL}`);
  log(`Trang lớp A: /instructor/courses/${courseId}/sections/${classA.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
