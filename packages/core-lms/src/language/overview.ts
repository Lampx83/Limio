import { prisma, type PrismaClient } from "@feedbackme/db";

/**
 * LANG L3 — số liệu cho trang tổng quan Limio Language (vỏ ngoại ngữ). Chỉ ĐỌC dữ liệu của chính người xem:
 * giảng viên chỉ thấy khoá mình dạy, học viên chỉ thấy khoá mình đang học (L3.3).
 */

export type PendingSkill = "writing" | "speaking";
const PENDING_SKILLS: PendingSkill[] = ["writing", "speaking"];
const PENDING_LIST_LIMIT = 5;

export interface LanguageTeacherCourse {
  id: string;
  slug: string;
  title: string;
  status: string;
  /** standard | practice_bank (khoá luyện đề). */
  kind: string;
  studentCount: number;
  examCount: number;
  pendingGrade: number;
}

export interface LanguagePendingGradeItem {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  skill: PendingSkill;
  submittedAt: Date;
}

export interface LanguageTeacherOverview {
  courses: LanguageTeacherCourse[];
  /** Bài Viết/Nói đã nộp, chưa chấm — tổng và 5 bài cũ nhất. */
  pendingGradeTotal: number;
  pendingGrade: LanguagePendingGradeItem[];
  exams: { draft: number; published: number };
}

export async function getLanguageTeacherOverview(
  userId: string,
  db: PrismaClient = prisma,
): Promise<LanguageTeacherOverview> {
  const rows = await db.courseInstructor.findMany({
    where: { userId, course: { languageMode: true } },
    select: { course: { select: { id: true, slug: true, title: true, status: true, kind: true, createdAt: true } } },
  });
  const courses = rows.map((r) => r.course).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const ids = courses.map((c) => c.id);
  if (ids.length === 0) {
    return { courses: [], pendingGradeTotal: 0, pendingGrade: [], exams: { draft: 0, published: 0 } };
  }

  const pendingWhere = {
    status: "submitted" as const,
    assignment: { lesson: { languageSkill: { in: PENDING_SKILLS }, module: { courseId: { in: ids } } } },
  };
  const [enrolled, examsByCourse, examStatus, pendingTotal, pendingRows, pendingPerCourse] = await Promise.all([
    db.enrollment.groupBy({ by: ["courseId"], where: { courseId: { in: ids }, status: "active" }, _count: { _all: true } }),
    db.exam.groupBy({ by: ["courseId"], where: { courseId: { in: ids }, mockMode: true }, _count: { _all: true } }),
    db.exam.groupBy({
      by: ["status"],
      where: { courseId: { in: ids }, mockMode: true, status: { in: ["draft", "published"] } },
      _count: { _all: true },
    }),
    db.assignmentSubmission.count({ where: pendingWhere }),
    db.assignmentSubmission.findMany({
      where: pendingWhere,
      orderBy: { submittedAt: "asc" },
      take: PENDING_LIST_LIMIT,
      select: {
        id: true,
        submittedAt: true,
        user: { select: { displayName: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            lesson: { select: { languageSkill: true, module: { select: { course: { select: { id: true, title: true } } } } } },
          },
        },
      },
    }),
    db.assignmentSubmission.findMany({
      where: pendingWhere,
      select: { assignment: { select: { lesson: { select: { module: { select: { courseId: true } } } } } } },
    }),
  ]);

  const students = new Map(enrolled.map((e) => [e.courseId, e._count._all]));
  const examCount = new Map(examsByCourse.map((e) => [e.courseId as string, e._count._all]));
  const pendingBy = new Map<string, number>();
  for (const p of pendingPerCourse) {
    const cid = p.assignment.lesson?.module.courseId;
    if (cid) pendingBy.set(cid, (pendingBy.get(cid) ?? 0) + 1);
  }
  const statusCount = (s: string) => examStatus.find((e) => e.status === s)?._count._all ?? 0;

  return {
    courses: courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      status: c.status,
      kind: c.kind,
      studentCount: students.get(c.id) ?? 0,
      examCount: examCount.get(c.id) ?? 0,
      pendingGrade: pendingBy.get(c.id) ?? 0,
    })),
    pendingGradeTotal: pendingTotal,
    pendingGrade: pendingRows.map((r) => ({
      submissionId: r.id,
      assignmentId: r.assignment.id,
      assignmentTitle: r.assignment.title,
      courseId: r.assignment.lesson!.module.course.id,
      courseTitle: r.assignment.lesson!.module.course.title,
      studentName: r.user.displayName,
      skill: r.assignment.lesson!.languageSkill as PendingSkill,
      submittedAt: r.submittedAt,
    })),
    exams: { draft: statusCount("draft"), published: statusCount("published") },
  };
}

export interface LanguageLearnerCourse {
  id: string;
  slug: string;
  title: string;
  kind: string;
  lastLessonId: string | null;
  openExamCount: number;
}

export interface LanguageLearnerOverview {
  courses: LanguageLearnerCourse[];
  openExamTotal: number;
  /** Bài học gần nhất của khoá ngoại ngữ gần nhất — null nếu chưa học bài nào. */
  continue: { courseSlug: string; courseTitle: string; lessonId: string } | null;
}

export async function getLanguageLearnerOverview(
  userId: string,
  db: PrismaClient = prisma,
): Promise<LanguageLearnerOverview> {
  const enr = await db.enrollment.findMany({
    where: { userId, status: "active", course: { languageMode: true } },
    orderBy: { enrolledAt: "desc" },
    select: { lastLessonId: true, course: { select: { id: true, slug: true, title: true, kind: true } } },
  });
  if (enr.length === 0) return { courses: [], openExamTotal: 0, continue: null };
  const ids = enr.map((e) => e.course.id);
  const open = await db.exam.groupBy({
    by: ["courseId"],
    where: {
      courseId: { in: ids },
      mockMode: true,
      status: "published",
      kind: "written",
      OR: [{ allowMock: true }, { allowPractice: true }],
    },
    _count: { _all: true },
  });
  const openBy = new Map(open.map((o) => [o.courseId as string, o._count._all]));
  const courses = enr.map((e) => ({
    id: e.course.id,
    slug: e.course.slug,
    title: e.course.title,
    kind: e.course.kind,
    lastLessonId: e.lastLessonId,
    openExamCount: openBy.get(e.course.id) ?? 0,
  }));
  const withLesson = enr.find((e) => e.lastLessonId);
  return {
    courses,
    openExamTotal: courses.reduce((a, c) => a + c.openExamCount, 0),
    continue: withLesson
      ? { courseSlug: withLesson.course.slug, courseTitle: withLesson.course.title, lessonId: withLesson.lastLessonId! }
      : null,
  };
}

/** Có khoá ngoại ngữ nào tôi dạy hoặc đang học không — quyết định có hiện lối "Sang Limio Language" ở vỏ thường. */
export async function userHasLanguageCourses(userId: string, db: PrismaClient = prisma): Promise<boolean> {
  const [teaching, learning] = await Promise.all([
    db.courseInstructor.findFirst({ where: { userId, course: { languageMode: true } }, select: { id: true } }),
    db.enrollment.findFirst({ where: { userId, status: "active", course: { languageMode: true } }, select: { id: true } }),
  ]);
  return !!teaching || !!learning;
}
