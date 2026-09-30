/**
 * Hạn nộp / lịch quiz THEO LỚP (CourseSection).
 *
 * Mô hình: bài tập và quiz vẫn có một hạn chung (Assignment.dueAt, Quiz.opensAt/dueAt).
 * Mỗi lớp có thể có một dòng ghi đè (AssignmentSectionDue / QuizSectionSchedule):
 *   - không có dòng          → lớp theo hạn chung;
 *   - có dòng, mốc = ngày    → lớp dùng ngày đó;
 *   - có dòng, mốc = null    → lớp KHÔNG có mốc đó (kể cả khi hạn chung có).
 * Một dòng quiz là lịch ĐẦY ĐỦ của lớp (cả hạn mở lẫn hạn đóng), không trộn từng mốc.
 *
 * Lớp của học viên là `Enrollment.sectionId` (nguồn duy nhất, đổi lớp là đổi hạn ngay).
 * Học viên ở lớp mặc định ("chưa gán lớp") luôn theo hạn chung — lớp mặc định không có dòng riêng.
 * Lớp tạo SAU khi đã đặt hạn không có dòng nào nên cũng theo hạn chung.
 */
import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse } from "./authz";

export class SectionDeadlineError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "validation_failed"
      | "section_not_in_course"
      | "invalid_window"
      | "not_course_item",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

// ── Hạn hiệu lực cho một học viên ─────────────────────────────────────────

/** Map courseId → sectionId hiện tại của user (chỉ các khoá được hỏi mà user có ghi danh). */
export async function getUserSectionsByCourse(
  userId: string,
  courseIds: readonly string[],
  db: PrismaClient = prisma,
): Promise<Map<string, string>> {
  if (courseIds.length === 0) return new Map();
  const rows = await db.enrollment.findMany({
    where: { userId, courseId: { in: [...courseIds] } },
    select: { courseId: true, sectionId: true },
  });
  return new Map(rows.map((r) => [r.courseId, r.sectionId]));
}

/**
 * Hạn nộp hiệu lực của user cho từng bài tập: hạn của lớp (nếu lớp có dòng ghi đè) hoặc hạn chung.
 * `items` cần courseId để biết lớp của user trong khoá đó.
 */
export async function effectiveAssignmentDues(
  userId: string,
  items: ReadonlyArray<{ id: string; courseId: string | null; dueAt: Date | null }>,
  db: PrismaClient = prisma,
): Promise<Map<string, Date | null>> {
  const result = new Map<string, Date | null>(items.map((i) => [i.id, i.dueAt]));
  const courseIds = [...new Set(items.map((i) => i.courseId).filter((c): c is string => c !== null))];
  const sectionByCourse = await getUserSectionsByCourse(userId, courseIds, db);
  const sectionIds = [...new Set(sectionByCourse.values())];
  if (sectionIds.length === 0) return result;
  const overrides = await db.assignmentSectionDue.findMany({
    where: { assignmentId: { in: items.map((i) => i.id) }, sectionId: { in: sectionIds } },
    select: { assignmentId: true, sectionId: true, dueAt: true },
  });
  const courseOf = new Map(items.map((i) => [i.id, i.courseId]));
  for (const o of overrides) {
    const course = courseOf.get(o.assignmentId);
    // Chỉ áp dòng ghi đè của ĐÚNG lớp user đang học trong khoá của bài đó.
    if (course && sectionByCourse.get(course) === o.sectionId) result.set(o.assignmentId, o.dueAt);
  }
  return result;
}

export interface EffectiveQuizSchedule {
  opensAt: Date | null;
  dueAt: Date | null;
}

/** Lịch quiz hiệu lực của user cho nhiều quiz cùng lúc (cùng luật với effectiveQuizSchedule). */
export async function effectiveQuizSchedules(
  userId: string,
  quizzes: ReadonlyArray<{ id: string; courseId: string | null; opensAt: Date | null; dueAt: Date | null }>,
  db: PrismaClient = prisma,
): Promise<Map<string, EffectiveQuizSchedule>> {
  const result = new Map<string, EffectiveQuizSchedule>(
    quizzes.map((q) => [q.id, { opensAt: q.opensAt, dueAt: q.dueAt }]),
  );
  const courseIds = [...new Set(quizzes.map((q) => q.courseId).filter((c): c is string => c !== null))];
  const sectionByCourse = await getUserSectionsByCourse(userId, courseIds, db);
  const sectionIds = [...new Set(sectionByCourse.values())];
  if (sectionIds.length === 0) return result;
  const rows = await db.quizSectionSchedule.findMany({
    where: { quizId: { in: quizzes.map((q) => q.id) }, sectionId: { in: sectionIds } },
    select: { quizId: true, sectionId: true, opensAt: true, dueAt: true },
  });
  const courseOf = new Map(quizzes.map((q) => [q.id, q.courseId]));
  for (const r of rows) {
    const course = courseOf.get(r.quizId);
    if (course && sectionByCourse.get(course) === r.sectionId) {
      result.set(r.quizId, { opensAt: r.opensAt, dueAt: r.dueAt });
    }
  }
  return result;
}

/** Lịch quiz hiệu lực của user: lịch của lớp (nếu có dòng ghi đè) hoặc lịch chung của quiz. */
export async function effectiveQuizSchedule(
  userId: string,
  quiz: { id: string; courseId: string | null; opensAt: Date | null; dueAt: Date | null },
  db: PrismaClient = prisma,
): Promise<EffectiveQuizSchedule> {
  return (await effectiveQuizSchedules(userId, [quiz], db)).get(quiz.id)!;
}

// ── Giáo viên đọc / đặt ───────────────────────────────────────────────────

export interface SectionDeadlineRow {
  sectionId: string;
  name: string;
  enrolledCount: number;
  /** inherit = theo hạn chung; custom = có hạn riêng (các mốc bên dưới, null = không có mốc đó). */
  mode: "inherit" | "custom";
  opensAt: string | null;
  dueAt: string | null;
}

export interface ItemDeadlines {
  courseId: string;
  base: { opensAt: string | null; dueAt: string | null };
  sections: SectionDeadlineRow[];
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function loadAssignmentCourseId(assignmentId: string, db: PrismaClient): Promise<string> {
  const a = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: { lesson: { select: { module: { select: { courseId: true } } } } },
  });
  if (!a) throw new SectionDeadlineError("not_found");
  const courseId = a.lesson?.module.courseId;
  // Bài tập của nhiệm vụ giải đấu không thuộc lớp nào → không có hạn theo lớp.
  if (!courseId) throw new SectionDeadlineError("not_course_item");
  return courseId;
}

async function loadQuizCourseId(quizId: string, db: PrismaClient): Promise<string> {
  const q = await db.quiz.findUnique({
    where: { id: quizId },
    select: { courseId: true, lesson: { select: { module: { select: { courseId: true } } } } },
  });
  if (!q) throw new SectionDeadlineError("not_found");
  const courseId = q.courseId ?? q.lesson?.module.courseId;
  if (!courseId) throw new SectionDeadlineError("not_course_item");
  return courseId;
}

/** Các lớp thật của khoá (bỏ lớp mặc định "chưa gán lớp"), kèm sĩ số. */
async function listRealSections(courseId: string, db: PrismaClient) {
  const rows = await db.courseSection.findMany({
    where: { courseId, isDefault: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, _count: { select: { enrollments: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, enrolledCount: r._count.enrollments }));
}

export async function getAssignmentDeadlines(
  actorUserId: string,
  assignmentId: string,
  db: PrismaClient = prisma,
): Promise<ItemDeadlines> {
  const courseId = await loadAssignmentCourseId(assignmentId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  const [a, sections, overrides] = await Promise.all([
    db.assignment.findUniqueOrThrow({ where: { id: assignmentId }, select: { dueAt: true } }),
    listRealSections(courseId, db),
    db.assignmentSectionDue.findMany({ where: { assignmentId }, select: { sectionId: true, dueAt: true } }),
  ]);
  const byId = new Map(overrides.map((o) => [o.sectionId, o]));
  return {
    courseId,
    base: { opensAt: null, dueAt: iso(a.dueAt) },
    sections: sections.map((s) => {
      const o = byId.get(s.id);
      return {
        sectionId: s.id,
        name: s.name,
        enrolledCount: s.enrolledCount,
        mode: o ? "custom" : "inherit",
        opensAt: null,
        dueAt: o ? iso(o.dueAt) : null,
      };
    }),
  };
}

export async function getQuizDeadlines(
  actorUserId: string,
  quizId: string,
  db: PrismaClient = prisma,
): Promise<ItemDeadlines> {
  const courseId = await loadQuizCourseId(quizId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  const [q, sections, overrides] = await Promise.all([
    db.quiz.findUniqueOrThrow({ where: { id: quizId }, select: { opensAt: true, dueAt: true } }),
    listRealSections(courseId, db),
    db.quizSectionSchedule.findMany({ where: { quizId }, select: { sectionId: true, opensAt: true, dueAt: true } }),
  ]);
  const byId = new Map(overrides.map((o) => [o.sectionId, o]));
  return {
    courseId,
    base: { opensAt: iso(q.opensAt), dueAt: iso(q.dueAt) },
    sections: sections.map((s) => {
      const o = byId.get(s.id);
      return {
        sectionId: s.id,
        name: s.name,
        enrolledCount: s.enrolledCount,
        mode: o ? "custom" : "inherit",
        opensAt: o ? iso(o.opensAt) : null,
        dueAt: o ? iso(o.dueAt) : null,
      };
    }),
  };
}

const DateOrNull = z.string().datetime().nullable();

const SectionIds = z.array(z.string().min(1)).min(1).max(200);

const AssignmentChange = z.object({
  sectionIds: SectionIds,
  change: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("inherit") }),
    z.object({ mode: z.literal("custom"), dueAt: DateOrNull }),
  ]),
});

const QuizChange = z.object({
  sectionIds: SectionIds,
  change: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("inherit") }),
    z.object({ mode: z.literal("custom"), opensAt: DateOrNull, dueAt: DateOrNull }),
  ]),
});

/** Mọi id phải là lớp THẬT của đúng khoá này (không lớp khoá khác, không lớp mặc định). */
async function assertSectionsBelong(courseId: string, sectionIds: string[], db: PrismaClient): Promise<string[]> {
  const unique = [...new Set(sectionIds)];
  const found = await db.courseSection.count({
    where: { id: { in: unique }, courseId, isDefault: false },
  });
  if (found !== unique.length) throw new SectionDeadlineError("section_not_in_course");
  return unique;
}

/**
 * Đặt HOẶC bỏ hạn riêng cho một hay nhiều lớp trong MỘT lần lưu (đặt chung cho nhiều lớp = truyền nhiều
 * sectionIds cùng một mốc). Chỉ tác động đúng các lớp được truyền; lớp khác và lớp tạo sau không đổi.
 */
export async function setAssignmentSectionDeadlines(
  actorUserId: string,
  assignmentId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const courseId = await loadAssignmentCourseId(assignmentId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = AssignmentChange.safeParse(rawInput);
  if (!parsed.success) throw new SectionDeadlineError("validation_failed", parsed.error.flatten());
  const sectionIds = await assertSectionsBelong(courseId, parsed.data.sectionIds, db);

  if (parsed.data.change.mode === "inherit") {
    await db.assignmentSectionDue.deleteMany({ where: { assignmentId, sectionId: { in: sectionIds } } });
    return;
  }
  const dueAt = parsed.data.change.dueAt ? new Date(parsed.data.change.dueAt) : null;
  await db.$transaction(
    sectionIds.map((sectionId) =>
      db.assignmentSectionDue.upsert({
        where: { assignmentId_sectionId: { assignmentId, sectionId } },
        update: { dueAt },
        create: { assignmentId, sectionId, dueAt },
      }),
    ),
  );
}

export async function setQuizSectionSchedules(
  actorUserId: string,
  quizId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const courseId = await loadQuizCourseId(quizId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = QuizChange.safeParse(rawInput);
  if (!parsed.success) throw new SectionDeadlineError("validation_failed", parsed.error.flatten());
  const sectionIds = await assertSectionsBelong(courseId, parsed.data.sectionIds, db);

  if (parsed.data.change.mode === "inherit") {
    await db.quizSectionSchedule.deleteMany({ where: { quizId, sectionId: { in: sectionIds } } });
    return;
  }
  const opensAt = parsed.data.change.opensAt ? new Date(parsed.data.change.opensAt) : null;
  const dueAt = parsed.data.change.dueAt ? new Date(parsed.data.change.dueAt) : null;
  // Cùng luật với hạn chung của quiz: mở phải trước đóng.
  if (opensAt && dueAt && opensAt.getTime() >= dueAt.getTime()) {
    throw new SectionDeadlineError("invalid_window");
  }
  await db.$transaction(
    sectionIds.map((sectionId) =>
      db.quizSectionSchedule.upsert({
        where: { quizId_sectionId: { quizId, sectionId } },
        update: { opensAt, dueAt },
        create: { quizId, sectionId, opensAt, dueAt },
      }),
    ),
  );
}
