import { prisma } from "@feedbackme/db";
import { setClassSchedule } from "../classSchedule";
import { createCourse } from "../courses";
import { createCourseSection } from "../sections";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createContentItem } from "../contents";
import { createAssignment } from "../assignments";
import { registerUser } from "../../auth/register";

/** Dữ liệu dựng sẵn cho test tổng kết và nhận xét sau buổi (CENTER C4). */
export const BASE = "http://localhost:3000";
export const BEFORE = new Date("2026-10-23T03:00:00.000Z");
// Sau buổi 1 (thứ ba 03/11/2026 18:30–20:30 giờ VN = 11:30–13:30 UTC), trước buổi 2.
export const AFTER_M1 = new Date("2026-11-03T14:00:00.000Z");

export async function makeUser(email: string, roles: string[] = []) {
  const r = await registerUser({ email, password: "password1234", displayName: email.split("@")[0]! }, BASE);
  for (const name of roles) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    await prisma.userRole.create({ data: { userId: r.userId, roleId: role.id, grantedBy: r.userId } });
  }
  return r.userId;
}

export interface Setup {
  teacher: string;
  courseId: string;
  sectionId: string;
  learners: string[];
  meetings: Array<{ id: string; seq: number | null }>;
  lessons: string[];
  assignmentId: string;
}

/** Khoá 3 chương gắn buổi 1..3; chương 1 có từ vựng + bài tập; lớp 3 học viên, lịch 3 buổi thứ ba hằng tuần. */
export async function setup(tag: string, opts: { withPlan?: boolean } = {}): Promise<Setup> {
  const withPlan = opts.withPlan ?? true;
  const teacher = await makeUser(`ms-${tag}-t@e.com`, ["instructor"]);
  const { courseId } = await createCourse(teacher, {
    title: `Tiếng Trung ${tag}`,
    description: "d",
    slug: `ms-${tag}`,
    personalizationEnabled: false,
  });
  const lessons: string[] = [];
  let assignmentId = "";
  if (withPlan) {
    for (let i = 1; i <= 3; i++) {
      const m = await createModule(teacher, courseId, { title: `Buổi ${i}: Chủ đề ${i}`, orderIndex: i - 1 });
      await prisma.module.update({ where: { id: m.moduleId }, data: { sessionNo: i } });
      const l1 = await createLesson(teacher, m.moduleId, { title: `Từ vựng ${i}`, orderIndex: 0 });
      const l2 = await createLesson(teacher, m.moduleId, { title: `Hội thoại ${i}`, orderIndex: 1 });
      lessons.push(l1.lessonId, l2.lessonId);
      if (i === 1) {
        await createContentItem(teacher, l1.lessonId, {
          type: "vocab_list",
          orderIndex: 0,
          payload: { items: [{ term: "你好", reading: "nǐ hǎo", meaning: "xin chào" }, { term: "谢谢", reading: "xièxie", meaning: "cảm ơn" }] },
        });
        const a = await createAssignment(teacher, l1.lessonId, {
          title: "Viết 5 câu chào hỏi",
          description: "Viết 5 câu",
          dueAt: "2026-11-08T16:59:00.000Z",
        });
        assignmentId = a.assignmentId;
      }
    }
  }
  const section = await createCourseSection(teacher, courseId, { name: "Lớp A" });
  await setClassSchedule(
    teacher,
    section.id,
    { startDate: "2026-11-03", totalMeetings: 3, slots: [{ weekday: 2, startTime: "18:30", durationMin: 120, room: "B2" }] },
    prisma,
    BEFORE,
  );
  const learners: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const u = await makeUser(`ms-${tag}-l${i}@e.com`);
    await prisma.enrollment.create({ data: { userId: u, courseId, sectionId: section.id, courseVersion: 1 } });
    learners.push(u);
  }
  const meetings = await prisma.classMeeting.findMany({ where: { sectionId: section.id }, orderBy: { startsAt: "asc" }, select: { id: true, seq: true } });
  return { teacher, courseId, sectionId: section.id, learners, meetings, lessons, assignmentId };
}

