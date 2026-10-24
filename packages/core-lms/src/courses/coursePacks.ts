/**
 * Giáo trình dựng sẵn (CENTER C3 — docs/CENTER-schedule-attendance-AC.md).
 *
 * Mô hình:
 *   - Một GÓI là một khoá do quản trị soạn; mỗi chương có bài = giáo án của một buổi học (Module.sessionNo).
 *   - Trung tâm "dùng giáo trình" = SAO CHÉP cả khoá về tài khoản mình (độc lập hoàn toàn: sửa bản sao không
 *     đụng gói, gói đổi cũng không đụng bản sao đang dạy).
 *   - Gói ra BẢN MỚI (releasePackVersion) thì bản sao chỉ nhận thông báo; giảng viên chủ động cập nhật, và
 *     chỉ các buổi CHƯA dạy và CHƯA có hoạt động của học viên mới bị thay.
 *   - Media dùng chung tham chiếu (payload được sao nguyên văn), không nhân đôi file và không tính dung lượng
 *     cho người sao.
 *   - Ghi chú giảng viên (loại `teacher_note`) được sao nguyên; mọi truy vấn phía học viên đã lọc loại đó.
 */
import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { getUserOrgId, isAdmin, isInstructor } from "../auth/roles";
import { emitEvent } from "../learning/events";
import { assertCanEditCourse, assertCanGradeCourse } from "./authz";
import { cloneCourseUnchecked, cloneModuleTree, MODULE_TREE_INCLUDE } from "./courses";

export class CoursePackError extends Error {
  constructor(
    public readonly code:
      | "forbidden"
      | "validation_failed"
      | "course_not_found"
      | "pack_not_found"
      | "not_published"
      | "no_sessions"
      | "slug_taken"
      | "not_a_pack_copy"
      | "nothing_to_update",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

// ── Kiểu trả về ──────────────────────────────────────────────────────────

export interface PackSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  language: string;
  outcomeLevel: string | null;
  version: number;
  sessionCount: number;
  lessonCount: number;
}

export interface PackLessonKinds {
  vocab: number;
  dialogue: number;
  audio: number;
  teacherNote: number;
  quiz: number;
  assignment: number;
  other: number;
}

export interface PackPreview extends PackSummary {
  sessions: Array<{
    sessionNo: number;
    title: string;
    lessons: Array<{ id: string; title: string; languageSkill: string | null; kinds: PackLessonKinds }>;
  }>;
}

export interface CoursePlan {
  sessions: Array<{ sessionNo: number; moduleId: string; title: string; lessons: Array<{ id: string; title: string }> }>;
  /** Có khi khoá là bản sao của một gói còn tồn tại. */
  pack: {
    id: string;
    title: string;
    copiedVersion: number;
    currentVersion: number;
    hasUpdate: boolean;
  } | null;
}

export type SkipReason = "taught" | "has_activity";

export interface PackUpdateResult {
  updatedSessions: number[];
  skipped: Array<{ sessionNo: number; reason: SkipReason }>;
}

// ── Kiểm tra đầu vào ─────────────────────────────────────────────────────

const PublishInput = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(1).max(80),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2000),
  language: z.string().trim().min(2).max(10),
  outcomeLevel: z.string().trim().max(40).nullish().transform((v) => (v ? v : null)),
});

function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new CoursePackError("validation_failed", r.error.flatten());
  return r.data;
}

async function requireAdmin(userId: string, db: DbClient) {
  if (!(await isAdmin(userId, db))) throw new CoursePackError("forbidden");
}

async function requireInstructor(userId: string, db: DbClient) {
  if (!(await isInstructor(userId, db))) throw new CoursePackError("forbidden");
}

async function loadPack(packId: string, db: DbClient) {
  const pack = await db.coursePack.findUnique({ where: { id: packId } });
  if (!pack) throw new CoursePackError("pack_not_found");
  return pack;
}

// ── Quản trị: phát hành gói ──────────────────────────────────────────────

/**
 * Đưa một khoá thành gói (hoặc cập nhật thông tin gói đã có). Chương nào có bài được đánh số buổi 1..N theo
 * thứ tự; chương trống không thuộc buổi nào. Phát hành lại cùng khoá thì giữ nguyên phiên bản.
 */
export async function publishCoursePack(
  adminUserId: string,
  courseId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ packId: string; sessionCount: number }> {
  await requireAdmin(adminUserId, db);
  const input = parse(PublishInput, rawInput);
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, modules: { orderBy: { orderIndex: "asc" }, select: { id: true, _count: { select: { lessons: true } } } } },
  });
  if (!course) throw new CoursePackError("course_not_found");
  const sessionModules = course.modules.filter((m) => m._count.lessons > 0);
  if (sessionModules.length === 0) throw new CoursePackError("no_sessions");

  const clash = await db.coursePack.findUnique({ where: { slug: input.slug }, select: { courseId: true } });
  if (clash && clash.courseId !== courseId) throw new CoursePackError("slug_taken");

  return db.$transaction(async (tx) => {
    const numbered = new Map(sessionModules.map((m, i) => [m.id, i + 1]));
    for (const m of course.modules) {
      await tx.module.update({ where: { id: m.id }, data: { sessionNo: numbered.get(m.id) ?? null } });
    }
    const existing = await tx.coursePack.findUnique({ where: { courseId }, select: { id: true } });
    const data = {
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      language: input.language,
      outcomeLevel: input.outcomeLevel,
      isPublished: true,
    };
    const pack = existing
      ? await tx.coursePack.update({ where: { id: existing.id }, data })
      : await tx.coursePack.create({ data: { ...data, courseId, publishedAt: new Date(), createdById: adminUserId } });
    return { packId: pack.id, sessionCount: sessionModules.length };
  });
}

/** Phát hành bản mới của gói: bản sao đang dùng bản cũ sẽ thấy "có bản mới". */
export async function releasePackVersion(
  adminUserId: string,
  packId: string,
  db: PrismaClient = prisma,
): Promise<{ version: number }> {
  await requireAdmin(adminUserId, db);
  await loadPack(packId, db);
  const pack = await db.coursePack.update({ where: { id: packId }, data: { version: { increment: 1 } }, select: { version: true } });
  return { version: pack.version };
}

export async function unpublishCoursePack(adminUserId: string, packId: string, db: PrismaClient = prisma): Promise<void> {
  await requireAdmin(adminUserId, db);
  await loadPack(packId, db);
  await db.coursePack.update({ where: { id: packId }, data: { isPublished: false } });
}

// ── Giảng viên: thư viện, xem trước, dùng ────────────────────────────────

export async function listPublishedPacks(actorUserId: string, db: PrismaClient = prisma): Promise<PackSummary[]> {
  await requireInstructor(actorUserId, db);
  const packs = await db.coursePack.findMany({
    where: { isPublished: true },
    orderBy: { title: "asc" },
    include: {
      course: {
        select: {
          modules: { where: { sessionNo: { not: null } }, select: { _count: { select: { lessons: true } } } },
        },
      },
    },
  });
  return packs.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    language: p.language,
    outcomeLevel: p.outcomeLevel,
    version: p.version,
    sessionCount: p.course.modules.length,
    lessonCount: p.course.modules.reduce((n, m) => n + m._count.lessons, 0),
  }));
}

export async function getPackPreview(actorUserId: string, packId: string, db: PrismaClient = prisma): Promise<PackPreview> {
  await requireInstructor(actorUserId, db);
  const pack = await loadPack(packId, db);
  if (!pack.isPublished) throw new CoursePackError("not_published");

  const modules = await db.module.findMany({
    where: { courseId: pack.courseId, sessionNo: { not: null } },
    orderBy: { sessionNo: "asc" },
    select: {
      sessionNo: true,
      title: true,
      lessons: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          title: true,
          languageSkill: true,
          contentItems: { select: { type: true } },
          _count: { select: { quizzes: true, assignments: true } },
        },
      },
    },
  });

  const sessions = modules.map((m) => ({
    sessionNo: m.sessionNo!,
    title: m.title,
    lessons: m.lessons.map((l) => {
      const kinds: PackLessonKinds = { vocab: 0, dialogue: 0, audio: 0, teacherNote: 0, quiz: l._count.quizzes, assignment: l._count.assignments, other: 0 };
      for (const c of l.contentItems) {
        if (c.type === "vocab_list") kinds.vocab++;
        else if (c.type === "dialogue") kinds.dialogue++;
        else if (c.type === "audio") kinds.audio++;
        else if (c.type === "teacher_note") kinds.teacherNote++;
        else kinds.other++;
      }
      return { id: l.id, title: l.title, languageSkill: l.languageSkill, kinds };
    }),
  }));
  return {
    id: pack.id,
    slug: pack.slug,
    title: pack.title,
    summary: pack.summary,
    language: pack.language,
    outcomeLevel: pack.outcomeLevel,
    version: pack.version,
    sessionCount: sessions.length,
    lessonCount: sessions.reduce((n, s) => n + s.lessons.length, 0),
    sessions,
  };
}

/** Sao chép gói về tài khoản giảng viên thành một khoá nháp mới (người gọi là chủ khoá). */
export async function usePack(actorUserId: string, packId: string, db: PrismaClient = prisma): Promise<{ courseId: string }> {
  await requireInstructor(actorUserId, db);
  const pack = await loadPack(packId, db);
  if (!pack.isPublished) throw new CoursePackError("not_published");
  const organizationId = await getUserOrgId(actorUserId, db);
  const { courseId } = await cloneCourseUnchecked(actorUserId, pack.courseId, db, {
    title: pack.title,
    slugBase: pack.slug,
    sourcePack: { id: pack.id, version: pack.version },
    asOwnCopyOfOrg: { organizationId },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.CoursePackUsed,
    { packId: pack.id, packVersion: pack.version, courseId },
    { courseId },
    db,
  );
  return { courseId };
}

// ── Giáo án của khoá và cập nhật theo bản mới ────────────────────────────

export async function getCoursePlan(actorUserId: string, courseId: string, db: PrismaClient = prisma): Promise<CoursePlan> {
  await assertCanGradeCourse(actorUserId, courseId, db);
  const [modules, course] = await Promise.all([
    db.module.findMany({
      where: { courseId, sessionNo: { not: null } },
      orderBy: { sessionNo: "asc" },
      select: { id: true, title: true, sessionNo: true, lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true } } },
    }),
    db.course.findUnique({
      where: { id: courseId },
      select: { sourcePackVersion: true, fromPack: { select: { id: true, title: true, version: true, isPublished: true } } },
    }),
  ]);
  const p = course?.fromPack;
  const copied = course?.sourcePackVersion ?? 0;
  return {
    sessions: modules.map((m) => ({ sessionNo: m.sessionNo!, moduleId: m.id, title: m.title, lessons: m.lessons })),
    pack: p ? { id: p.id, title: p.title, copiedVersion: copied, currentVersion: p.version, hasUpdate: p.isPublished && p.version > copied } : null,
  };
}

/**
 * Cập nhật khoá (bản sao) lên phiên bản mới nhất của gói: thay chương của những buổi CHƯA dạy và CHƯA có
 * hoạt động của học viên bằng bản mới. Buổi đã dạy (có buổi học số đó đã đóng hoặc đã bắt đầu) hay đã có học
 * viên xem/làm bài thì giữ nguyên và được báo lại. Sau khi chạy, khoá được coi là đã theo phiên bản mới nhất.
 */
export async function updateCourseFromPack(
  actorUserId: string,
  courseId: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<PackUpdateResult> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { sourcePackId: true, sourcePackVersion: true },
  });
  if (!course?.sourcePackId) throw new CoursePackError("not_a_pack_copy");
  const pack = await db.coursePack.findUnique({ where: { id: course.sourcePackId } });
  if (!pack || !pack.isPublished) throw new CoursePackError("pack_not_found");
  const copied = course.sourcePackVersion ?? 0;
  if (pack.version <= copied) throw new CoursePackError("nothing_to_update");

  const [packModules, ownModules, meetings] = await Promise.all([
    db.module.findMany({
      where: { courseId: pack.courseId, sessionNo: { not: null } },
      orderBy: { sessionNo: "asc" },
      include: MODULE_TREE_INCLUDE,
    }),
    db.module.findMany({ where: { courseId, sessionNo: { not: null } }, select: { id: true, sessionNo: true, orderIndex: true, lessons: { select: { id: true } } } }),
    db.classMeeting.findMany({
      where: { section: { courseId }, seq: { not: null }, OR: [{ status: "held" }, { startsAt: { lte: now } }] },
      select: { seq: true },
    }),
  ]);
  const taught = new Set(meetings.map((m) => m.seq!));
  const ownBySession = new Map(ownModules.map((m) => [m.sessionNo!, m]));

  const updatedSessions: number[] = [];
  const skipped: PackUpdateResult["skipped"] = [];
  const toApply: Array<{ src: (typeof packModules)[number]; own: (typeof ownModules)[number] | undefined }> = [];

  for (const src of packModules) {
    const no = src.sessionNo!;
    const own = ownBySession.get(no);
    if (taught.has(no)) {
      skipped.push({ sessionNo: no, reason: "taught" });
      continue;
    }
    if (own && (await moduleHasLearnerActivity(own.lessons.map((l) => l.id), db))) {
      skipped.push({ sessionNo: no, reason: "has_activity" });
      continue;
    }
    toApply.push({ src, own });
  }

  await db.$transaction(
    async (tx) => {
      const last = await tx.module.aggregate({ where: { courseId }, _max: { orderIndex: true } });
      let nextIndex = (last._max.orderIndex ?? -1) + 1;
      for (const { src, own } of toApply) {
        if (own) {
          const lessonIds = own.lessons.map((l) => l.id);
          // Quiz gắn bài chỉ bị SetNull khi xoá bài, nên xoá tường minh để không để lại quiz mồ côi.
          await tx.quiz.deleteMany({ where: { lessonId: { in: lessonIds } } });
          await tx.assignment.deleteMany({ where: { lessonId: { in: lessonIds } } });
          await tx.module.delete({ where: { id: own.id } });
        }
        await cloneModuleTree(tx, src, courseId, own?.orderIndex ?? nextIndex++);
        updatedSessions.push(src.sessionNo!);
      }
      await tx.course.update({ where: { id: courseId }, data: { sourcePackVersion: pack.version } });
      await emitEvent(
        actorUserId,
        LearningEventType.CoursePackUpdated,
        {
          packId: pack.id,
          fromVersion: course.sourcePackVersion,
          toVersion: pack.version,
          courseId,
          updatedSessions,
          skippedSessions: skipped.map((s) => s.sessionNo),
        },
        { courseId },
        tx,
      );
    },
    { timeout: 60_000 },
  );

  return { updatedSessions, skipped };
}

/** Có học viên nào đã xem, làm quiz hoặc nộp bài trong các bài này chưa. */
async function moduleHasLearnerActivity(lessonIds: readonly string[], db: DbClient): Promise<boolean> {
  if (lessonIds.length === 0) return false;
  const ids = [...lessonIds];
  const [views, attempts, submissions] = await Promise.all([
    db.lessonEngagement.count({ where: { lessonId: { in: ids } } }),
    db.quizAttempt.count({ where: { quiz: { lessonId: { in: ids } } } }),
    db.assignmentSubmission.count({ where: { assignment: { lessonId: { in: ids } } } }),
  ]);
  return views + attempts + submissions > 0;
}
