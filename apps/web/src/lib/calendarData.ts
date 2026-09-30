import { prisma } from "@feedbackme/db";
import { toDayKey, formatTime } from "@/lib/datetime";
import type { CalendarAssignment } from "@/components/calendar/WorkspaceCalendar";

// Cửa sổ dữ liệu đưa xuống lịch: đủ để lật ngược/xuôi vài tháng mà không phải
// gọi lại server, và chặn số dòng cho học viên ghi danh rất nhiều khoá.
const PAST_DAYS = 120;
const FUTURE_DAYS = 400;
const MAX_ITEMS = 600;

/**
 * Bài tập có hạn nộp của các khoá học viên đang học, cho lịch trên dashboard.
 *
 * Chỉ lấy bài GV chưa ẩn (Assignment.isHidden / Lesson.isHidden — "ẩn với mọi học
 * viên") và khoá còn truy cập (active/completed; dropped/refunded/expired thì
 * không còn thấy bài). Bài tập đứng riêng (nhiệm vụ giải đấu, không thuộc lesson)
 * không có `lesson` nên tự loại. Cộng thêm quiz có hạn đóng (loadLearnerQuizDeadlines).
 */
export async function loadLearnerCalendarAssignments(
  userId: string,
  now: Date = new Date(),
): Promise<CalendarAssignment[]> {
  const from = new Date(now.getTime() - PAST_DAYS * 86_400_000);
  const to = new Date(now.getTime() + FUTURE_DAYS * 86_400_000);

  const rows = await prisma.assignment.findMany({
    where: {
      isHidden: false,
      dueAt: { gte: from, lte: to },
      lesson: {
        isHidden: false,
        module: {
          course: { enrollments: { some: { userId, status: { in: ["active", "completed"] } } } },
        },
      },
    },
    orderBy: { dueAt: "asc" },
    take: MAX_ITEMS,
    select: {
      id: true,
      title: true,
      dueAt: true,
      maxScore: true,
      lessonId: true,
      submissions: { where: { userId }, select: { status: true, score: true }, take: 1 },
      lesson: { select: { module: { select: { course: { select: { slug: true, title: true } } } } } },
    },
  });

  const items: CalendarAssignment[] = [];
  for (const a of rows) {
    if (!a.dueAt || !a.lesson || !a.lessonId) continue;
    const sub = a.submissions[0];
    const state: CalendarAssignment["state"] = !sub
      ? a.dueAt.getTime() < now.getTime()
        ? "overdue"
        : "todo"
      : sub.status === "graded"
        ? "graded"
        : "submitted";
    const course = a.lesson.module.course;
    items.push({
      id: a.id,
      title: a.title,
      courseTitle: course.title,
      dueDay: toDayKey(a.dueAt),
      dueTime: formatTime(a.dueAt),
      state,
      scoreLabel: sub?.status === "graded" && sub.score !== null ? `${sub.score}/${a.maxScore}` : undefined,
      href: `/learn/${course.slug}/lessons/${a.lessonId}`,
    });
  }
  const quizzes = await loadLearnerQuizDeadlines(userId, now, from, to);
  return [...items, ...quizzes];
}

/**
 * Quiz có "Hạn đóng" (Quiz.dueAt) của các khoá học viên đang học, trong [from, to].
 *
 * Bỏ quiz GV ẩn, quiz cuepoint trong video (không phải việc để "làm"), quiz nền của
 * nhiệm vụ giải đấu, và quiz nằm trong bài học đã ẩn. Quiz gắn bài học lẫn quiz đứng
 * riêng trong khoá (courseId) đều được tính.
 *
 * Trạng thái: đã có lượt nộp → "graded" kèm điểm cao nhất; chưa nộp mà quá hạn đóng →
 * "overdue" (không bắt đầu lượt mới được nữa); còn lại "todo" ("Đang làm" nếu có lượt dang dở).
 */
export async function loadLearnerQuizDeadlines(
  userId: string,
  now: Date,
  from: Date,
  to: Date,
): Promise<CalendarAssignment[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, status: { in: ["active", "completed"] } },
    select: { courseId: true, course: { select: { slug: true, title: true } } },
  });
  if (enrollments.length === 0) return [];
  const courseById = new Map(enrollments.map((e) => [e.courseId, e.course]));
  const courseIds = [...courseById.keys()];

  const quizzes = await prisma.quiz.findMany({
    where: {
      isHidden: false,
      cuepointOnly: false,
      tournamentMissionId: null,
      dueAt: { gte: from, lte: to },
      AND: [
        { OR: [{ courseId: { in: courseIds } }, { lesson: { module: { courseId: { in: courseIds } } } }] },
        { OR: [{ lessonId: null }, { lesson: { isHidden: false } }] },
      ],
    },
    orderBy: { dueAt: "asc" },
    take: MAX_ITEMS,
    select: {
      id: true,
      title: true,
      dueAt: true,
      courseId: true,
      lesson: { select: { module: { select: { courseId: true } } } },
      attempts: { where: { userId }, select: { status: true, scorePct: true } },
    },
  });

  const items: CalendarAssignment[] = [];
  for (const q of quizzes) {
    if (!q.dueAt) continue;
    const course = courseById.get(q.courseId ?? q.lesson?.module.courseId ?? "");
    if (!course) continue;
    const submitted = q.attempts.filter((a) => a.status === "submitted");
    const inProgress = q.attempts.some((a) => a.status === "in_progress");
    const best = submitted.reduce<number | null>(
      (m, a) => (a.scorePct === null ? m : m === null ? a.scorePct : Math.max(m, a.scorePct)),
      null,
    );
    const base = {
      id: `quiz:${q.id}`,
      title: q.title,
      courseTitle: course.title,
      dueDay: toDayKey(q.dueAt),
      dueTime: formatTime(q.dueAt),
      kind: "quiz" as const,
      href: `/learn/${course.slug}/quizzes/${q.id}`,
    };
    if (submitted.length > 0) {
      items.push({
        ...base,
        state: "graded",
        scoreLabel: best !== null ? `${Math.round(best)}%` : undefined,
        stateLabel: "Đã làm",
      });
    } else if (q.dueAt.getTime() < now.getTime() && !inProgress) {
      items.push({ ...base, state: "overdue" });
    } else {
      items.push({ ...base, state: "todo", stateLabel: inProgress ? "Đang làm" : "Chưa làm" });
    }
  }
  return items;
}

/**
 * Hạn nộp bài tập của các khoá giáo viên đang dạy (mọi vai trò trong CourseInstructor),
 * cho lịch ở workspace giáo viên. Bài đang ẩn với học viên không có hạn hiệu lực
 * nên không hiện. `detail` cho biết đã có bao nhiêu bài nộp và bao nhiêu chờ chấm.
 */
export async function loadInstructorCalendarAssignments(
  userId: string,
  now: Date = new Date(),
): Promise<CalendarAssignment[]> {
  const from = new Date(now.getTime() - PAST_DAYS * 86_400_000);
  const to = new Date(now.getTime() + FUTURE_DAYS * 86_400_000);

  const rows = await prisma.assignment.findMany({
    where: {
      isHidden: false,
      dueAt: { gte: from, lte: to },
      lesson: { module: { course: { instructors: { some: { userId } } } } },
    },
    orderBy: { dueAt: "asc" },
    take: MAX_ITEMS,
    select: {
      id: true,
      title: true,
      dueAt: true,
      lesson: { select: { module: { select: { course: { select: { title: true } } } } } },
    },
  });
  if (rows.length === 0) return [];

  const counts = await prisma.assignmentSubmission.groupBy({
    by: ["assignmentId", "status"],
    where: { assignmentId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  });
  const submitted = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const c of counts) {
    submitted.set(c.assignmentId, (submitted.get(c.assignmentId) ?? 0) + c._count._all);
    if (c.status === "submitted") pending.set(c.assignmentId, c._count._all);
  }

  const items: CalendarAssignment[] = [];
  for (const a of rows) {
    if (!a.dueAt || !a.lesson) continue;
    const total = submitted.get(a.id) ?? 0;
    const waiting = pending.get(a.id) ?? 0;
    items.push({
      id: a.id,
      title: a.title,
      courseTitle: a.lesson.module.course.title,
      dueDay: toDayKey(a.dueAt),
      dueTime: formatTime(a.dueAt),
      state: a.dueAt.getTime() < now.getTime() ? "closed" : "upcoming",
      detail: total === 0 ? "chưa có bài nộp" : `${total} bài nộp${waiting > 0 ? ` · ${waiting} chờ chấm` : ""}`,
      href: `/instructor/assignments/${a.id}/submissions`,
    });
  }
  return items;
}
