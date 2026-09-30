import { prisma } from "@feedbackme/db";
import { effectiveAssignmentDues, effectiveQuizSchedules } from "@feedbackme/core-lms";
import { formatTime, toDayKey } from "@/lib/datetime";
import type { TodoItem } from "@/lib/learnerTodoPlan";

// Việc quá hạn quá lâu là rác — chỉ giữ trong khoảng này để danh sách không phình mãi.
const OVERDUE_LOOKBACK_DAYS = 180;
const MAX_PER_KIND = 200;

/**
 * Bài tập + quiz học viên CÒN PHẢI LÀM: chưa nộp, có hạn lẫn không hạn.
 *
 * Cùng luật hiển thị với lịch (calendarData.ts): khoá còn truy cập (active/completed), bỏ mục
 * GV ẩn, bài học ẩn, quiz cuepoint trong video, quiz nền của nhiệm vụ giải đấu.
 * Thêm hai luật riêng cho quiz:
 * - "đã làm" = có ít nhất một lượt đã nộp (quiz cho làm lại thì vẫn coi là xong việc);
 * - quiz chưa đến giờ mở (opensAt) chưa làm được nên chưa xếp vào việc cần làm.
 *
 * Hạn/giờ mở là giá trị HIỆU LỰC của học viên: hạn riêng của lớp họ (nếu GV đặt) hoặc hạn chung.
 */
export async function loadLearnerTodo(userId: string, now: Date = new Date()): Promise<TodoItem[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, status: { in: ["active", "completed"] } },
    select: { courseId: true, sectionId: true, course: { select: { slug: true, title: true } } },
  });
  if (enrollments.length === 0) return [];
  const courseById = new Map(enrollments.map((e) => [e.courseId, e.course]));
  const courseIds = [...courseById.keys()];
  const sectionIds = [...new Set(enrollments.map((e) => e.sectionId))];
  const oldest = new Date(now.getTime() - OVERDUE_LOOKBACK_DAYS * 86_400_000);
  // Ứng viên ở tầng DB dựa trên hạn CHUNG; lớp của học viên có hạn riêng thì luôn là ứng viên
  // (hạn riêng có thể khác hẳn hạn chung). Hạn hiệu lực được lọc lại bằng JS bên dưới.
  const assignmentDueOk = {
    OR: [
      { dueAt: null },
      { dueAt: { gte: oldest } },
      { sectionDues: { some: { sectionId: { in: sectionIds } } } },
    ],
  };
  const quizDueOk = {
    OR: [
      { dueAt: null },
      { dueAt: { gte: oldest } },
      { sectionSchedules: { some: { sectionId: { in: sectionIds } } } },
    ],
  };
  const stillRelevant = (dueAt: Date | null) => dueAt === null || dueAt >= oldest;

  const [assignments, quizzes] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        isHidden: false,
        submissions: { none: { userId } },
        lesson: { isHidden: false, module: { courseId: { in: courseIds } } },
        ...assignmentDueOk,
      },
      take: MAX_PER_KIND,
      orderBy: { dueAt: { sort: "asc", nulls: "last" } },
      select: {
        id: true,
        title: true,
        dueAt: true,
        lessonId: true,
        lesson: { select: { module: { select: { courseId: true } } } },
      },
    }),
    prisma.quiz.findMany({
      where: {
        isHidden: false,
        cuepointOnly: false,
        tournamentMissionId: null,
        attempts: { none: { userId, status: "submitted" } },
        AND: [
          { OR: [{ courseId: { in: courseIds } }, { lesson: { module: { courseId: { in: courseIds } } } }] },
          { OR: [{ lessonId: null }, { lesson: { isHidden: false } }] },
          // opensAt chung có thể đã qua/chưa tới khác với lịch riêng của lớp → lọc theo lịch hiệu lực bên dưới.
          { OR: [{ opensAt: null }, { opensAt: { lte: now } }, { sectionSchedules: { some: { sectionId: { in: sectionIds } } } }] },
          quizDueOk,
        ],
      },
      take: MAX_PER_KIND,
      orderBy: { dueAt: { sort: "asc", nulls: "last" } },
      select: {
        id: true,
        title: true,
        dueAt: true,
        opensAt: true,
        courseId: true,
        lesson: { select: { module: { select: { courseId: true } } } },
        attempts: { where: { userId, status: "in_progress" }, select: { id: true }, take: 1 },
      },
    }),
  ]);

  const assignmentDues = await effectiveAssignmentDues(
    userId,
    assignments.map((a) => ({ id: a.id, courseId: a.lesson?.module.courseId ?? null, dueAt: a.dueAt })),
  );
  const quizSchedules = await effectiveQuizSchedules(
    userId,
    quizzes.map((q) => ({
      id: q.id,
      courseId: q.courseId ?? q.lesson?.module.courseId ?? null,
      opensAt: q.opensAt,
      dueAt: q.dueAt,
    })),
  );

  const items: TodoItem[] = [];
  for (const a of assignments) {
    const course = courseById.get(a.lesson?.module.courseId ?? "");
    if (!course || !a.lessonId) continue;
    const dueAt = assignmentDues.get(a.id) ?? null;
    if (!stillRelevant(dueAt)) continue;
    items.push({
      id: `assignment:${a.id}`,
      kind: "assignment",
      title: a.title,
      courseTitle: course.title,
      href: `/learn/${course.slug}/lessons/${a.lessonId}`,
      dueDay: dueAt ? toDayKey(dueAt) : null,
      dueTime: dueAt ? formatTime(dueAt) : null,
      overdue: dueAt ? dueAt.getTime() < now.getTime() : false,
    });
  }
  for (const q of quizzes) {
    const course = courseById.get(q.courseId ?? q.lesson?.module.courseId ?? "");
    if (!course) continue;
    const schedule = quizSchedules.get(q.id) ?? { opensAt: q.opensAt, dueAt: q.dueAt };
    // Chưa tới giờ mở (theo lịch của LỚP học viên) thì chưa làm được → chưa là việc cần làm.
    if (schedule.opensAt && schedule.opensAt > now) continue;
    if (!stillRelevant(schedule.dueAt)) continue;
    const inProgress = q.attempts.length > 0;
    // Quá hạn đóng mà không có lượt dở thì không bắt đầu được nữa nhưng vẫn là việc "chưa làm" → vẫn liệt kê
    // (học viên cần thấy để ẩn); có lượt dở thì vẫn nộp được.
    items.push({
      id: `quiz:${q.id}`,
      kind: "quiz",
      title: q.title,
      courseTitle: course.title,
      href: `/learn/${course.slug}/quizzes/${q.id}`,
      dueDay: schedule.dueAt ? toDayKey(schedule.dueAt) : null,
      dueTime: schedule.dueAt ? formatTime(schedule.dueAt) : null,
      overdue: schedule.dueAt ? schedule.dueAt.getTime() < now.getTime() : false,
      inProgress,
    });
  }
  return items;
}
