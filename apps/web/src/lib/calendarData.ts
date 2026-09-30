import { prisma } from "@feedbackme/db";
import { effectiveAssignmentDues, effectiveQuizSchedules } from "@feedbackme/core-lms";
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
 *
 * Hạn là hạn HIỆU LỰC của học viên: hạn riêng của lớp họ (nếu GV đặt) hoặc hạn chung.
 */
export async function loadLearnerCalendarAssignments(
  userId: string,
  now: Date = new Date(),
): Promise<CalendarAssignment[]> {
  const from = new Date(now.getTime() - PAST_DAYS * 86_400_000);
  const to = new Date(now.getTime() + FUTURE_DAYS * 86_400_000);
  const inWindow = (d: Date | null) => d !== null && d >= from && d <= to;

  const userSections = await getUserSectionIds(userId);

  const rows = await prisma.assignment.findMany({
    where: {
      isHidden: false,
      // Ứng viên: hạn chung trong cửa sổ, HOẶC lớp của học viên có hạn riêng (có thể rơi vào cửa sổ
      // dù hạn chung thì không). Lọc lại theo hạn hiệu lực ngay bên dưới.
      OR: [
        { dueAt: { gte: from, lte: to } },
        ...(userSections.length > 0 ? [{ sectionDues: { some: { sectionId: { in: userSections } } } }] : []),
      ],
      lesson: {
        isHidden: false,
        module: {
          course: { enrollments: { some: { userId, status: { in: ["active", "completed"] } } } },
        },
      },
    },
    take: MAX_ITEMS,
    select: {
      id: true,
      title: true,
      dueAt: true,
      maxScore: true,
      lessonId: true,
      submissions: { where: { userId }, select: { status: true, score: true }, take: 1 },
      lesson: {
        select: { module: { select: { courseId: true, course: { select: { slug: true, title: true } } } } },
      },
    },
  });

  const dues = await effectiveAssignmentDues(
    userId,
    rows.map((a) => ({ id: a.id, courseId: a.lesson?.module.courseId ?? null, dueAt: a.dueAt })),
  );

  const items: CalendarAssignment[] = [];
  for (const a of rows) {
    const dueAt = dues.get(a.id) ?? null;
    if (!dueAt || !inWindow(dueAt) || !a.lesson || !a.lessonId) continue;
    const sub = a.submissions[0];
    const state: CalendarAssignment["state"] = !sub
      ? dueAt.getTime() < now.getTime()
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
      dueDay: toDayKey(dueAt),
      dueTime: formatTime(dueAt),
      state,
      scoreLabel: sub?.status === "graded" && sub.score !== null ? `${sub.score}/${a.maxScore}` : undefined,
      href: `/learn/${course.slug}/lessons/${a.lessonId}`,
    });
  }
  items.sort((x, y) => `${x.dueDay}T${x.dueTime}`.localeCompare(`${y.dueDay}T${y.dueTime}`));
  const quizzes = await loadLearnerQuizDeadlines(userId, now, from, to);
  return [...items, ...quizzes];
}

/** Các lớp hiện tại của học viên (mỗi khoá một lớp) — để tìm hạn riêng của lớp. */
async function getUserSectionIds(userId: string): Promise<string[]> {
  const rows = await prisma.enrollment.findMany({
    where: { userId, status: { in: ["active", "completed"] } },
    select: { sectionId: true },
  });
  return [...new Set(rows.map((r) => r.sectionId))];
}

/**
 * Quiz có "Hạn đóng" của các khoá học viên đang học, trong [from, to].
 *
 * Bỏ quiz GV ẩn, quiz cuepoint trong video (không phải việc để "làm"), quiz nền của
 * nhiệm vụ giải đấu, và quiz nằm trong bài học đã ẩn. Quiz gắn bài học lẫn quiz đứng
 * riêng trong khoá (courseId) đều được tính. Hạn là hạn hiệu lực theo lớp của học viên.
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
    select: { courseId: true, sectionId: true, course: { select: { slug: true, title: true } } },
  });
  if (enrollments.length === 0) return [];
  const courseById = new Map(enrollments.map((e) => [e.courseId, e.course]));
  const courseIds = [...courseById.keys()];
  const sectionIds = [...new Set(enrollments.map((e) => e.sectionId))];

  const quizzes = await prisma.quiz.findMany({
    where: {
      isHidden: false,
      cuepointOnly: false,
      tournamentMissionId: null,
      AND: [
        { OR: [{ courseId: { in: courseIds } }, { lesson: { module: { courseId: { in: courseIds } } } }] },
        { OR: [{ lessonId: null }, { lesson: { isHidden: false } }] },
        // Ứng viên: hạn chung trong cửa sổ, hoặc lớp của học viên có lịch riêng. Lọc lại theo hạn hiệu lực bên dưới.
        { OR: [{ dueAt: { gte: from, lte: to } }, { sectionSchedules: { some: { sectionId: { in: sectionIds } } } }] },
      ],
    },
    take: MAX_ITEMS,
    select: {
      id: true,
      title: true,
      dueAt: true,
      opensAt: true,
      courseId: true,
      lesson: { select: { module: { select: { courseId: true } } } },
      attempts: { where: { userId }, select: { status: true, scorePct: true } },
    },
  });

  const schedules = await effectiveQuizSchedules(
    userId,
    quizzes.map((q) => ({
      id: q.id,
      courseId: q.courseId ?? q.lesson?.module.courseId ?? null,
      opensAt: q.opensAt,
      dueAt: q.dueAt,
    })),
  );

  const items: CalendarAssignment[] = [];
  for (const q of quizzes) {
    const dueAt = schedules.get(q.id)?.dueAt ?? null;
    if (!dueAt || dueAt < from || dueAt > to) continue;
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
      dueDay: toDayKey(dueAt),
      dueTime: formatTime(dueAt),
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
    } else if (dueAt.getTime() < now.getTime() && !inProgress) {
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
 *
 * Bài có hạn theo lớp: mỗi MỐC HẠN KHÁC NHAU là một mục riêng, ghi tên các lớp dùng mốc đó
 * ("Lớp A, Lớp B") và số bài nộp/chờ chấm của riêng nhóm lớp đó; các lớp không có hạn riêng
 * (kể cả học viên chưa gán lớp) gộp thành nhóm "Các lớp còn lại" với hạn chung. Lớp được đặt
 * "không hạn" không có mục trên lịch.
 */
export async function loadInstructorCalendarAssignments(
  userId: string,
  now: Date = new Date(),
): Promise<CalendarAssignment[]> {
  const from = new Date(now.getTime() - PAST_DAYS * 86_400_000);
  const to = new Date(now.getTime() + FUTURE_DAYS * 86_400_000);
  const inWindow = (d: Date) => d >= from && d <= to;

  const rows = await prisma.assignment.findMany({
    where: {
      isHidden: false,
      // Ứng viên: hạn chung trong cửa sổ HOẶC có lớp đặt hạn riêng (lọc lại theo từng mốc bên dưới).
      OR: [{ dueAt: { gte: from, lte: to } }, { sectionDues: { some: {} } }],
      lesson: { module: { course: { instructors: { some: { userId } } } } },
    },
    orderBy: { dueAt: "asc" },
    take: MAX_ITEMS,
    select: {
      id: true,
      title: true,
      dueAt: true,
      lesson: { select: { module: { select: { courseId: true, course: { select: { title: true } } } } } },
      sectionDues: { select: { sectionId: true, dueAt: true, section: { select: { name: true } } } },
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

  // Bài có hạn theo lớp cần đếm bài nộp THEO NHÓM LỚP → cần biết lớp của từng người nộp.
  const overriddenIds = rows.filter((r) => r.sectionDues.length > 0).map((r) => r.id);
  const sectionOfUser = new Map<string, string>(); // `${userId}:${courseId}` → sectionId
  const subsByAssignment = new Map<string, Array<{ userId: string; status: string }>>();
  if (overriddenIds.length > 0) {
    const subs = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: { in: overriddenIds } },
      select: { assignmentId: true, userId: true, status: true },
    });
    for (const s of subs) {
      const list = subsByAssignment.get(s.assignmentId) ?? [];
      list.push({ userId: s.userId, status: s.status });
      subsByAssignment.set(s.assignmentId, list);
    }
    const enrolls = await prisma.enrollment.findMany({
      where: {
        userId: { in: [...new Set(subs.map((s) => s.userId))] },
        courseId: { in: [...new Set(rows.map((r) => r.lesson?.module.courseId).filter((c): c is string => !!c))] },
      },
      select: { userId: true, courseId: true, sectionId: true },
    });
    for (const e of enrolls) sectionOfUser.set(`${e.userId}:${e.courseId}`, e.sectionId);
  }

  const summarize = (total: number, waiting: number) =>
    total === 0 ? "chưa có bài nộp" : `${total} bài nộp${waiting > 0 ? ` · ${waiting} chờ chấm` : ""}`;

  const items: CalendarAssignment[] = [];
  for (const a of rows) {
    if (!a.lesson) continue;
    const courseTitle = a.lesson.module.course.title;
    const courseId = a.lesson.module.courseId;
    const href = `/instructor/assignments/${a.id}/submissions`;

    if (a.sectionDues.length === 0) {
      if (!a.dueAt || !inWindow(a.dueAt)) continue;
      items.push({
        id: a.id,
        title: a.title,
        courseTitle,
        dueDay: toDayKey(a.dueAt),
        dueTime: formatTime(a.dueAt),
        state: a.dueAt.getTime() < now.getTime() ? "closed" : "upcoming",
        detail: summarize(submitted.get(a.id) ?? 0, pending.get(a.id) ?? 0),
        href,
      });
      continue;
    }

    // Gộp các lớp theo mốc hạn hiệu lực; khoá nhóm = ISO hoặc "none" (không hạn).
    type Group = { dueAt: Date | null; names: string[]; sectionIds: Set<string>; total: number; waiting: number };
    const groups = new Map<string, Group>();
    const overriddenSectionIds = new Set(a.sectionDues.map((d) => d.sectionId));
    for (const d of a.sectionDues) {
      const key = d.dueAt ? d.dueAt.toISOString() : "none";
      const g = groups.get(key) ?? { dueAt: d.dueAt, names: [], sectionIds: new Set(), total: 0, waiting: 0 };
      g.names.push(d.section.name);
      g.sectionIds.add(d.sectionId);
      groups.set(key, g);
    }
    const baseKey = a.dueAt ? a.dueAt.toISOString() : "none";
    const rest: Group = groups.get(baseKey) ?? { dueAt: a.dueAt, names: [], sectionIds: new Set(), total: 0, waiting: 0 };
    // Nhóm "còn lại": trùng mốc với một nhóm riêng thì hợp nhất (cùng một mục, cùng một hạn).
    rest.names.push("Các lớp còn lại");
    groups.set(baseKey, rest);

    for (const s of subsByAssignment.get(a.id) ?? []) {
      const sectionId = sectionOfUser.get(`${s.userId}:${courseId}`);
      const key =
        sectionId && overriddenSectionIds.has(sectionId)
          ? (() => {
              const d = a.sectionDues.find((x) => x.sectionId === sectionId)!;
              return d.dueAt ? d.dueAt.toISOString() : "none";
            })()
          : baseKey;
      const g = groups.get(key)!;
      g.total++;
      if (s.status === "submitted") g.waiting++;
    }

    for (const [key, g] of groups) {
      if (!g.dueAt || !inWindow(g.dueAt)) continue;
      items.push({
        id: `${a.id}:${key}`,
        title: a.title,
        courseTitle,
        dueDay: toDayKey(g.dueAt),
        dueTime: formatTime(g.dueAt),
        state: g.dueAt.getTime() < now.getTime() ? "closed" : "upcoming",
        detail: `${g.names.join(", ")} · ${summarize(g.total, g.waiting)}`,
        href,
      });
    }
  }
  return items;
}
