import { prisma } from "@feedbackme/db";
import {
  buildFeed,
  classifyFeedEvent,
  FEED_EVENT_TYPES,
  learnerFeedName,
  type FeedInput,
  type FeedItem,
} from "./classFeed";

const WINDOW_DAYS = 7;
/** Đọc dư để sau khi gộp và lọc vẫn còn đủ dòng; dòng tin chỉ cần vài dòng mới nhất. */
const SCAN = 300;

/**
 * Dòng tin lớp học cho trang chủ giảng viên: hoạt động tích cực của học viên đã ghi danh ở các khoá
 * mà người này dạy, 7 ngày gần nhất. Không trả payload thô, không trả điểm số.
 */
export async function getClassFeed(instructorId: string, limit = 4): Promise<FeedItem[]> {
  const courses = await prisma.course.findMany({
    where: { instructors: { some: { userId: instructorId } } },
    select: { id: true, title: true },
  });
  if (courses.length === 0) return [];
  const courseIds = courses.map((c) => c.id);
  const titleOfCourse = new Map(courses.map((c) => [c.id, c.title]));

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: { in: courseIds } },
    select: { userId: true, courseId: true },
  });
  if (enrollments.length === 0) return [];
  const enrolledPair = new Set(enrollments.map((e) => `${e.courseId}:${e.userId}`));
  const enrolledUsers = Array.from(new Set(enrollments.map((e) => e.userId)));

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const events = await prisma.learningEvent.findMany({
    where: {
      occurredAt: { gte: since },
      eventType: { in: [...FEED_EVENT_TYPES] },
      userId: { in: enrolledUsers },
      // Huy hiệu thường không gắn khoá: vẫn lấy, miễn người nhận đang học một khoá của giảng viên.
      OR: [{ courseId: { in: courseIds } }, { courseId: null, eventType: "badge.earned" }],
    },
    orderBy: { occurredAt: "desc" },
    take: SCAN,
    select: {
      id: true,
      userId: true,
      courseId: true,
      eventType: true,
      payload: true,
      occurredAt: true,
      user: { select: { displayName: true, avatarUrl: true, leaderboardOptOut: true } },
    },
  });

  const classified = events.flatMap((e) => {
    if (!e.userId || !e.user) return [];
    if (e.courseId && !enrolledPair.has(`${e.courseId}:${e.userId}`)) return [];
    const cls = classifyFeedEvent(e.eventType, e.payload);
    return cls ? [{ e, cls }] : [];
  });

  const ids = (kind: "lesson" | "quiz" | "assignment") =>
    Array.from(new Set(classified.filter((c) => c.cls.targetKind === kind && c.cls.targetId).map((c) => c.cls.targetId!)));
  const [lessons, quizzes, assignments] = await Promise.all([
    prisma.lesson.findMany({ where: { id: { in: ids("lesson") } }, select: { id: true, title: true } }),
    prisma.quiz.findMany({ where: { id: { in: ids("quiz") } }, select: { id: true, title: true } }),
    prisma.assignment.findMany({ where: { id: { in: ids("assignment") } }, select: { id: true, title: true } }),
  ]);
  const titles = {
    lesson: new Map(lessons.map((x) => [x.id, x.title])),
    quiz: new Map(quizzes.map((x) => [x.id, x.title])),
    assignment: new Map(assignments.map((x) => [x.id, x.title])),
  };

  const inputs: FeedInput[] = classified.map(({ e, cls }) => ({
    id: e.id.toString(),
    occurredAt: e.occurredAt,
    userId: e.userId!,
    name: learnerFeedName(e.user!),
    avatarUrl: e.user!.leaderboardOptOut ? null : e.user!.avatarUrl,
    courseId: e.courseId,
    courseTitle: e.courseId ? (titleOfCourse.get(e.courseId) ?? null) : null,
    cls,
    targetTitle: cls.targetKind && cls.targetId ? (titles[cls.targetKind].get(cls.targetId) ?? null) : null,
  }));

  return buildFeed(inputs, limit);
}
