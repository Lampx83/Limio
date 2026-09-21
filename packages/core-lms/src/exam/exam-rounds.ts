/**
 * A5.3 — Đợt thi (ExamRound) services. CRUD + bridge management for courses
 * and round admins. Cross-course by design: 1 đợt có thể bao nhiều môn, 1 đợt
 * có thể nhiều trưởng đợt.
 *
 * Authz model:
 *  - Platform admin: full access to every round.
 *  - ExamRoundAdmin (bridge): full management of the round it admins,
 *    including adding/removing courses + sessions.
 *  - CourseInstructor: may view a round that includes one of their courses;
 *    may create new rounds attached to their courses. Cannot edit a round
 *    they don't admin (read-only otherwise).
 *
 * UI/API consumers land in PR2.2+.
 */

import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { isAdmin } from "../auth/roles";
import { canEditCourse } from "../courses/authz";
import { ensureDefaultRoomForSession } from "./exam-rooms";
import { ExamError } from "./types";

// ============================================================================
// Schemas
// ============================================================================

export const ExamRoundCodeSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[A-Z0-9._-]+$/, "code must be uppercase alphanumeric with . _ -");

export const CreateExamRoundInput = z
  .object({
    code: ExamRoundCodeSchema,
    title: z.string().min(1).max(200).trim(),
    description: z.string().max(2000).optional().nullable(),
    // DI SẢN — khung giờ của ĐỢT chưa bao giờ được dùng để chặn ai, và cũng
    // không ràng buộc các ca bên trong: tạo đợt 8h–10h rồi nhét ca 14h–15h thì
    // hệ thống không cản, ca vẫn chạy. Trên production 4/6 đợt đã trôi lệch
    // khỏi các ca của chính mình mà không ai nhận ra.
    //
    // Giữ lại vì cột còn NOT NULL; giá trị hiển thị nay suy từ các ca
    // (roundDisplayWindow). Sẽ xoá ở đợt migration riêng.
    opensAt: z.coerce.date().optional(),
    closesAt: z.coerce.date().optional(),
    // PR2.11 — Mỗi đợt thi gắn với 1 học phần duy nhất.
    courseId: z.string().uuid(),
    // PR2.17 — Optional: pick template + dates → auto sinh ExamSession instances.
    // templateIds = ExamSessionTemplate.id list từ org của course.
    // dates = "YYYY-MM-DD" list. Cross-product tạo N×M sessions.
    templateIds: z.array(z.string().uuid()).optional(),
    dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  })
  .refine((d) => !d.opensAt || !d.closesAt || d.opensAt < d.closesAt, {
    message: "opensAt must be before closesAt",
  });

export const UpdateExamRoundInput = z
  .object({
    code: ExamRoundCodeSchema.optional(),
    title: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(2000).optional().nullable(),
    opensAt: z.coerce.date().optional(),
    closesAt: z.coerce.date().optional(),
    status: z.enum(["draft", "open", "closed", "archived"]).optional(),
  })
  .refine(
    (d) => !(d.opensAt && d.closesAt) || d.opensAt < d.closesAt,
    { message: "opensAt must be before closesAt" },
  );

// ============================================================================
// Types
// ============================================================================

export interface ExamRoundCourseInfo {
  courseId: string | null;
  courseTitle: string | null;
  courseSlug: string | null;
}

export interface ExamRoundAdminInfo {
  userId: string;
  displayName: string;
  email: string;
  grantedAt: string;
}

export interface ExamRoundListItem {
  id: string;
  code: string;
  title: string;
  status: "draft" | "open" | "closed" | "archived";
  opensAt: string;
  closesAt: string;
  course: ExamRoundCourseInfo;
  sessionCount: number;
  createdAt: string;
}

export interface ExamRoundDetail extends ExamRoundListItem {
  description: string | null;
  admins: ExamRoundAdminInfo[];
  updatedAt: string;
}

// ============================================================================
// Authz
// ============================================================================

/**
 * True if user can view a given round: platform admin, round admin, or
 * instructor on any of the round's courses.
 */
export async function canViewExamRound(
  userId: string,
  roundId: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  if (await isAdmin(userId, db)) return true;
  const round = await db.examRound.findUnique({
    where: { id: roundId },
    select: {
      courseId: true,
      admins: { where: { userId }, select: { userId: true } },
      // Đợt tự sinh (ensureDefaultRound) cho đề độc lập không có course —
      // luôn đúng 1 exam/session, dùng để xác định người tạo đề làm chủ.
      sessions: { take: 1, select: { exam: { select: { createdById: true } } } },
    },
  });
  if (!round) return false;
  if (round.admins.length > 0) return true;
  if (round.courseId) return canEditCourse(userId, round.courseId, db);
  return round.sessions[0]?.exam.createdById === userId;
}

/**
 * True if user can edit a round: platform admin or round admin.
 * Course instructors get read access only — they must be promoted to round
 * admin to make changes.
 */
export async function canEditExamRound(
  userId: string,
  roundId: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  if (await isAdmin(userId, db)) return true;
  const adm = await db.examRoundAdmin.findUnique({
    where: { roundId_userId: { roundId, userId } },
    select: { userId: true },
  });
  return adm !== null;
}

async function assertCanView(
  userId: string,
  roundId: string,
  db: PrismaClient,
): Promise<void> {
  if (!(await canViewExamRound(userId, roundId, db)))
    throw new ExamError("forbidden");
}

async function assertCanEdit(
  userId: string,
  roundId: string,
  db: PrismaClient,
): Promise<void> {
  if (!(await canEditExamRound(userId, roundId, db)))
    throw new ExamError("forbidden");
}

// ============================================================================
// CRUD
// ============================================================================

export async function createExamRound(
  actorUserId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string }> {
  const parsed = CreateExamRoundInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;

  // Caller must be able to edit the course they're attaching.
  const platformAdmin = await isAdmin(actorUserId, db);
  if (!platformAdmin) {
    if (!(await canEditCourse(actorUserId, d.courseId, db)))
      throw new ExamError("forbidden");
  }

  const course = await db.course.findUnique({
    where: { id: d.courseId },
    select: { id: true },
  });
  if (!course)
    throw new ExamError("validation_failed", { reason: "course_not_found" });

  try {
    const round = await db.examRound.create({
      data: {
        courseId: d.courseId,
        code: d.code,
        title: d.title,
        description: d.description ?? null,
        opensAt: d.opensAt ?? new Date(),
        closesAt: d.closesAt ?? new Date(Date.now() + 365 * 24 * 60 * 60_000),
        // Creator becomes the first admin automatically.
        admins: { create: [{ userId: actorUserId, grantedBy: actorUserId }] },
      },
      select: { id: true },
    });

    // PR2.17 — Auto-instantiate sessions from templates × dates if provided.
    if (
      d.templateIds &&
      d.templateIds.length > 0 &&
      d.dates &&
      d.dates.length > 0
    ) {
      const courseRow = await db.course.findUnique({
        where: { id: d.courseId },
        select: {
          organization: { select: { timezone: true } },
          exams: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true } },
        },
      });
      if (courseRow?.exams[0]?.id) {
        const { instantiateSessionsFromTemplates } = await import(
          "../org/session-templates"
        );
        await instantiateSessionsFromTemplates(
          round.id,
          d.courseId,
          courseRow.exams[0].id,
          d.templateIds,
          d.dates,
          courseRow.organization?.timezone ?? "Asia/Ho_Chi_Minh",
          db,
        );
      }
    }
    return round;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new ExamError("round_code_taken");
    throw e;
  }
}

export async function listExamRounds(
  actorUserId: string,
  options: { courseId?: string; status?: "draft" | "open" | "closed" | "archived" } = {},
  db: PrismaClient = prisma,
): Promise<ExamRoundListItem[]> {
  const platformAdmin = await isAdmin(actorUserId, db);

  // Build base where: scoped to rounds the user can see.
  let where: Prisma.ExamRoundWhereInput;
  if (platformAdmin) {
    where = {};
  } else {
    const instructed = await db.courseInstructor.findMany({
      where: { userId: actorUserId },
      select: { courseId: true },
    });
    const instructedIds = instructed.map((c) => c.courseId);
    where = {
      OR: [
        { admins: { some: { userId: actorUserId } } },
        instructedIds.length > 0
          ? { courseId: { in: instructedIds } }
          : { id: "__never__" },
      ],
    };
  }
  if (options.courseId)
    where = { AND: [where, { courseId: options.courseId }] };
  if (options.status) where = { AND: [where, { status: options.status }] };

  const rows = await db.examRound.findMany({
    where,
    orderBy: [{ opensAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      opensAt: true,
      closesAt: true,
      createdAt: true,
      course: { select: { id: true, title: true, slug: true } },
      _count: { select: { sessions: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    status: r.status,
    opensAt: r.opensAt.toISOString(),
    closesAt: r.closesAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    course: {
      courseId: r.course?.id ?? null,
      courseTitle: r.course?.title ?? null,
      courseSlug: r.course?.slug ?? null,
    },
    sessionCount: r._count.sessions,
  }));
}

export async function getExamRound(
  actorUserId: string,
  roundId: string,
  db: PrismaClient = prisma,
): Promise<ExamRoundDetail> {
  // Distinguish not-found from forbidden: check existence first so the API
  // can return 404 cleanly even if the caller doesn't have view rights.
  const exists = await db.examRound.findUnique({
    where: { id: roundId },
    select: { id: true },
  });
  if (!exists) throw new ExamError("round_not_found");
  await assertCanView(actorUserId, roundId, db);
  const r = await db.examRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      status: true,
      opensAt: true,
      closesAt: true,
      createdAt: true,
      updatedAt: true,
      course: { select: { id: true, title: true, slug: true } },
      admins: {
        select: {
          userId: true,
          grantedAt: true,
          user: { select: { displayName: true, email: true } },
        },
      },
      _count: { select: { sessions: true } },
    },
  });
  if (!r) throw new ExamError("round_not_found");
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    status: r.status,
    opensAt: r.opensAt.toISOString(),
    closesAt: r.closesAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    course: {
      courseId: r.course?.id ?? null,
      courseTitle: r.course?.title ?? null,
      courseSlug: r.course?.slug ?? null,
    },
    admins: r.admins.map((a) => ({
      userId: a.userId,
      displayName: a.user.displayName,
      email: a.user.email,
      grantedAt: a.grantedAt.toISOString(),
    })),
    sessionCount: r._count.sessions,
  };
}

export async function updateExamRound(
  actorUserId: string,
  roundId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEdit(actorUserId, roundId, db);
  const parsed = UpdateExamRoundInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  if (Object.keys(d).length === 0) return;

  // If only one of opensAt/closesAt is supplied, validate against the existing
  // counterpart so we don't end up with a flipped window.
  if (d.opensAt && !d.closesAt) {
    const r = await db.examRound.findUniqueOrThrow({
      where: { id: roundId },
      select: { closesAt: true },
    });
    if (!(d.opensAt < r.closesAt))
      throw new ExamError("round_invalid_window");
  } else if (d.closesAt && !d.opensAt) {
    const r = await db.examRound.findUniqueOrThrow({
      where: { id: roundId },
      select: { opensAt: true },
    });
    if (!(r.opensAt < d.closesAt))
      throw new ExamError("round_invalid_window");
  }

  try {
    await db.examRound.update({
      where: { id: roundId },
      data: {
        ...(d.code !== undefined ? { code: d.code } : {}),
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.description !== undefined
          ? { description: d.description }
          : {}),
        ...(d.opensAt !== undefined ? { opensAt: d.opensAt } : {}),
        ...(d.closesAt !== undefined ? { closesAt: d.closesAt } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new ExamError("round_code_taken");
    if ((e as { code?: string }).code === "P2025")
      throw new ExamError("round_not_found");
    throw e;
  }
}

export interface ExamRoundSessionItem {
  id: string;
  code: string | null;
  title: string | null;
  status: "draft" | "open" | "closed" | "archived";
  opensAt: string;
  /** Null khi ca chạy chế độ thủ công — không có giờ đóng. */
  closesAt: string | null;
  examId: string;
  examTitle: string;
  examAccessMode: string;
  openCode: string | null;
  courseId: string | null;
  courseTitle: string | null;
  roomCount: number;
}

export interface ExamSessionDetail {
  id: string;
  roundId: string;
  roundCode: string;
  roundTitle: string;
  examId: string;
  examTitle: string;
  examAccessMode: string;
  examStatus: string;
  examOpenCode: string | null;
  examAssignedCodeSource: "random" | "student_code";
  courseId: string | null;
  courseTitle: string | null;
  code: string | null;
  title: string | null;
  status: "draft" | "open" | "closed" | "archived";
  opensAt: string;
  /** Null khi ca chạy chế độ thủ công — không có giờ đóng. */
  closesAt: string | null;
  durationOverrideMin: number | null;
  ipAllowlist: string[];
  createdAt: string;
  updatedAt: string;
  roomCount: number;
}

export const CreateExamSessionInRoundInput = z
  .object({
    examId: z.string().uuid(),
    code: z.string().min(1).max(60).optional().nullable(),
    title: z.string().min(1).max(200).trim().optional().nullable(),
    opensAt: z.coerce.date(),
    closesAt: z.coerce.date(),
    durationOverrideMin: z
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .optional()
      .nullable(),
    ipAllowlist: z.array(z.string().min(3).max(43)).max(50).optional(),
  })
  .refine((d) => d.opensAt < d.closesAt, {
    message: "opensAt must be before closesAt",
  });

/**
 * Create a session directly under a round (PR2.4c). Differs from the legacy
 * exam-scoped `createExamSession` (cohorts.ts) which auto-attaches to the
 * exam's default round — this one lets the caller pick which round.
 *
 * Validation:
 *  - Caller must be able to edit the round.
 *  - Exam.courseId must match round.courseId (round = 1 course in PR2.11).
 *  - Optional code is unique-per-round.
 */
export async function createExamSessionInRound(
  actorUserId: string,
  roundId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string }> {
  await assertCanEdit(actorUserId, roundId, db);

  const parsed = CreateExamSessionInRoundInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;

  const exam = await db.exam.findUnique({
    where: { id: d.examId },
    select: { id: true, courseId: true },
  });
  if (!exam) throw new ExamError("exam_not_found");

  const round = await db.examRound.findUniqueOrThrow({
    where: { id: roundId },
    select: { courseId: true },
  });
  if (exam.courseId !== round.courseId)
    throw new ExamError("validation_failed", {
      reason: "exam_course_not_in_round",
    });

  try {
    const s = await db.examSession.create({
      data: {
        examId: d.examId,
        roundId,
        code: d.code ?? null,
        title: d.title ?? null,
        opensAt: d.opensAt,
        closesAt: d.closesAt,
        durationOverrideMin: d.durationOverrideMin ?? null,
        ipAllowlist: d.ipAllowlist ?? [],
      },
      select: { id: true },
    });
    // Seed a default room (see ensureDefaultRoomForSession docstring for why).
    await ensureDefaultRoomForSession(actorUserId, s.id, db);
    return s;
  } catch (e) {
    // No DB-level unique on (roundId, code) yet — P2002 only fires from
    // some other unique (e.g. examId+accessCode on candidates, unrelated).
    // Still surface duplicates as a clean error for the future when we add it.
    if ((e as { code?: string }).code === "P2002")
      throw new ExamError("validation_failed", { reason: "code_taken" });
    throw e;
  }
}

// A5.3 PR2.7 — Bulk-create N sessions under a round with placeholder titles
// "Ca 1", "Ca 2"… so the instructor can scaffold a session schedule and then
// fine-tune time/duration/code per row afterwards. All N sessions share the
// same opensAt/closesAt window initially; the instructor adjusts each in the
// session detail page if needed.
export const BulkCreateExamSessionsInput = z
  .object({
    // examId BẮT BUỘC — instructor phải chọn đề (không auto-lấy đề đầu tiên).
    // Đổi đề từng ca sau khi tạo qua inline edit trên bảng.
    examId: z.string().uuid(),
    count: z.number().int().min(1).max(50),
    namePrefix: z.string().min(1).max(40).optional(),
    // Times also optional. Defaults to now+1h / now+2h so the rows show up
    // with a valid window the instructor can refine inline.
    opensAt: z.coerce.date().optional(),
    closesAt: z.coerce.date().optional(),
    // PR2.11 Phase B — set the exam's access mode at bulk-create time. The
    // exam.accessMode is patched after sessions are created. Per-exam still
    // (not per-session) — flipping mode here affects ALL other sessions of
    // the same exam.
    accessMode: z.enum(["assigned_code", "open_code"]).optional(),
    // Áp cho MỌI ca tạo trong lượt này. Bỏ trống = theo gói đề.
    // Sửa lại từng ca sau bằng setSessionRevealPolicy.
    revealAnswers: z
      .enum(["immediately", "never", "after_close", "score_only"])
      .optional()
      .nullable(),
  })
  .refine(
    (d) => !(d.opensAt && d.closesAt) || d.opensAt < d.closesAt,
    { message: "opensAt must be before closesAt" },
  );

export async function bulkCreateExamSessionsInRound(
  actorUserId: string,
  roundId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ created: number; sessionIds: string[] }> {
  await assertCanEdit(actorUserId, roundId, db);

  const parsed = BulkCreateExamSessionsInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const { count, namePrefix } = parsed.data;
  const prefix = namePrefix?.trim() || "Ca";

  // examId bắt buộc (schema) — không còn auto-lấy đề đầu tiên của khoá.
  const round = await db.examRound.findUniqueOrThrow({
    where: { id: roundId },
    select: { courseId: true },
  });
  const examId = parsed.data.examId;

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, kind: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.courseId !== round.courseId)
    throw new ExamError("validation_failed", {
      reason: "exam_course_not_in_round",
    });
  // A6.5 — "Tổ chức thi chính thức" (đợt/ca/phòng/mã dự thi) là hạ tầng cho
  // thi viết multi-phòng; vấn đáp AI chưa có khái niệm phòng/giám thị nhiều
  // người (còn nằm trong phạm vi A6.5 phần "chịu tải" chưa làm). Đề vấn đáp
  // chỉ mở ca qua "Link thi nhanh" (xem shareExamLink) — chặn ở đây để không
  // kéo theo ExamRoom/candidate CSV import và các màn kết quả/live của thi
  // viết chưa từng biết tới exam.kind.
  if (exam.kind === "oral") {
    throw new ExamError("exam_not_written", {
      reason: "oral_uses_quick_share",
      message:
        "Đề vấn đáp AI chưa hỗ trợ tổ chức thi nhiều phòng — dùng \"Tổ chức thi → Link thi nhanh\" để mở ca.",
    });
  }

  const now = new Date();
  const opensAt =
    parsed.data.opensAt ?? new Date(now.getTime() + 60 * 60_000);
  const closesAt =
    parsed.data.closesAt ?? new Date(opensAt.getTime() + 60 * 60_000);

  // Skip titles that already exist in this round so re-runs don't collide.
  const existing = await db.examSession.findMany({
    where: { roundId, title: { startsWith: prefix } },
    select: { title: true },
  });
  const taken = new Set(
    existing.map((s) => s.title).filter((t): t is string => t !== null),
  );

  // PR2.12 — per-session accessMode + openCode. Pre-load openCodes in use
  // for this round to avoid collision.
  const mode = parsed.data.accessMode ?? "authenticated";
  const usedOpenCodes = new Set<string>(
    mode === "open_code"
      ? (
          await db.examSession.findMany({
            where: { roundId, openCode: { not: null } },
            select: { openCode: true },
          })
        )
          .map((r) => r.openCode)
          .filter((c): c is string => !!c)
      : [],
  );

  const created: string[] = [];
  let nextNum = 1;
  for (let i = 0; i < count; i++) {
    while (taken.has(`${prefix} ${nextNum}`)) nextNum++;
    let openCode: string | null = null;
    if (mode === "open_code") {
      do {
        openCode = randomOpenCode(6);
      } while (usedOpenCodes.has(openCode));
      usedOpenCodes.add(openCode);
    }
    const s = await db.examSession.create({
      data: {
        examId,
        roundId,
        title: `${prefix} ${nextNum}`,
        code: null,
        opensAt,
        closesAt,
        accessMode: mode,
        openCode,
        revealAnswers: parsed.data.revealAnswers ?? null,
      },
      select: { id: true },
    });
    // Seed a default room so open_code candidates without a room code get
    // assigned somewhere — otherwise results disappear from the session
    // results tab. See ensureDefaultRoomForSession docstring.
    await ensureDefaultRoomForSession(actorUserId, s.id, db);
    created.push(s.id);
    taken.add(`${prefix} ${nextNum}`);
    nextNum++;
  }

  return { created: created.length, sessionIds: created };
}

// PR2.12 — 6 ký tự alphanumeric, viết hoa, loại bỏ ký tự dễ nhầm (0/O/1/I/L).
function randomOpenCode(len: number): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const UpdateExamSessionInput = z
  .object({
    examId: z.string().uuid().optional(),
    code: z.string().max(60).nullable().optional(),
    title: z.string().max(200).nullable().optional(),
    opensAt: z.coerce.date().optional(),
    closesAt: z.coerce.date().optional(),
    durationOverrideMin: z
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .nullable()
      .optional(),
    status: z.enum(["draft", "open", "closed", "archived"]).optional(),
    // PR2.12 — Per-session mode. Khi đổi sang open_code, service tự sinh
    // openCode mới nếu chưa có.
    accessMode: z
      .enum(["authenticated", "open_code", "assigned_code"])
      .optional(),
  })
  .refine(
    (d) => !(d.opensAt && d.closesAt) || d.opensAt < d.closesAt,
    { message: "opensAt must be before closesAt" },
  );

/** Update session meta. Authz: must be able to edit the round. */
export async function updateExamSession(
  actorUserId: string,
  sessionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const s = await db.examSession.findUnique({
    where: { id: sessionId },
    select: { roundId: true },
  });
  if (!s) throw new ExamError("schedule_not_found");
  await assertCanEdit(actorUserId, s.roundId, db);

  const parsed = UpdateExamSessionInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  if (Object.keys(d).length === 0) return;

  // If switching exam, validate the new exam's course matches the round's course.
  if (d.examId !== undefined) {
    const newExam = await db.exam.findUnique({
      where: { id: d.examId },
      select: { courseId: true },
    });
    if (!newExam) throw new ExamError("exam_not_found");
    const round = await db.examRound.findUniqueOrThrow({
      where: { id: s.roundId },
      select: { courseId: true },
    });
    if (newExam.courseId !== round.courseId)
      throw new ExamError("validation_failed", {
        reason: "exam_course_not_in_round",
      });
  }

  // PR2.12 — Khi switching INTO open_code, đảm bảo có openCode duy nhất
  // trong round. Khi switching OUT, clear openCode.
  let openCodePatch: { openCode?: string | null } = {};
  if (d.accessMode !== undefined) {
    if (d.accessMode === "open_code") {
      const current = await db.examSession.findUniqueOrThrow({
        where: { id: sessionId },
        select: { openCode: true, roundId: true },
      });
      if (!current.openCode) {
        const usedRows = await db.examSession.findMany({
          where: {
            roundId: current.roundId,
            openCode: { not: null },
            NOT: { id: sessionId },
          },
          select: { openCode: true },
        });
        const used = new Set(
          usedRows
            .map((r) => r.openCode)
            .filter((c): c is string => !!c),
        );
        let next = "";
        for (let i = 0; i < 50; i++) {
          next = randomOpenCode(6);
          if (!used.has(next)) break;
        }
        if (!next || used.has(next))
          throw new ExamError("validation_failed", {
            reason: "openCode_collision",
          });
        openCodePatch = { openCode: next };
      }
    } else {
      openCodePatch = { openCode: null };
    }
  }

  try {
    await db.examSession.update({
      where: { id: sessionId },
      data: {
        ...(d.examId !== undefined ? { examId: d.examId } : {}),
        ...(d.code !== undefined ? { code: d.code } : {}),
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.opensAt !== undefined ? { opensAt: d.opensAt } : {}),
        ...(d.closesAt !== undefined ? { closesAt: d.closesAt } : {}),
        ...(d.durationOverrideMin !== undefined
          ? { durationOverrideMin: d.durationOverrideMin }
          : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.accessMode !== undefined ? { accessMode: d.accessMode } : {}),
        ...openCodePatch,
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025")
      throw new ExamError("schedule_not_found");
    if ((e as { code?: string }).code === "P2002")
      throw new ExamError("validation_failed", { reason: "code_taken" });
    throw e;
  }
}

/** Load full session detail. Authz: must be able to view the round. */
export async function getExamSession(
  actorUserId: string,
  sessionId: string,
  db: PrismaClient = prisma,
): Promise<ExamSessionDetail> {
  const s = await db.examSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      roundId: true,
      code: true,
      title: true,
      status: true,
      opensAt: true,
      closesAt: true,
      durationOverrideMin: true,
      ipAllowlist: true,
      accessMode: true,
      openCode: true,
      createdAt: true,
      updatedAt: true,
      round: { select: { code: true, title: true } },
      exam: {
        select: {
          id: true,
          title: true,
          accessMode: true,
          status: true,
          openCode: true,
          assignedCodeSource: true,
          course: { select: { id: true, title: true } },
        },
      },
      _count: { select: { rooms: true } },
    },
  });
  if (!s) throw new ExamError("schedule_not_found");
  await assertCanView(actorUserId, s.roundId, db);
  return {
    id: s.id,
    roundId: s.roundId,
    roundCode: s.round.code,
    roundTitle: s.round.title,
    examId: s.exam.id,
    examTitle: s.exam.title,
    examAccessMode: s.accessMode,
    examStatus: s.exam.status,
    // PR2.12 — Prefer per-session openCode; fallback to Exam.openCode legacy.
    examOpenCode: s.openCode ?? s.exam.openCode,
    examAssignedCodeSource: s.exam.assignedCodeSource,
    courseId: s.exam.course?.id ?? null,
    courseTitle: s.exam.course?.title ?? null,
    code: s.code,
    title: s.title,
    status: s.status,
    opensAt: s.opensAt.toISOString(),
    closesAt: s.closesAt?.toISOString() ?? null,
    durationOverrideMin: s.durationOverrideMin,
    ipAllowlist: s.ipAllowlist,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    roomCount: s._count.rooms,
  };
}

export interface ExamSessionRoomItem {
  id: string;
  orderIndex: number;
  name: string;
  locationNote: string | null;
  proctorUserId: string;
  proctorName: string;
  graders: Array<{ id: string; displayName: string }>;
  candidateCount: number;
  createdAt: string;
}

// ============================================================================
// Room candidates (PR2.4b)
// ============================================================================

export interface ExamRoomCandidateItem {
  id: string;
  displayName: string;
  accessCode: string | null;
  userId: string | null;
  email: string | null;
  mssv: string | null;
  disabledAt: string | null;
  arrivedAt: string | null;
  createdAt: string;
}

export interface ExamRoomDetail {
  id: string;
  name: string;
  orderIndex: number;
  locationNote: string | null;
  proctorUserId: string;
  proctorName: string;
  sessionId: string;
  sessionTitle: string | null;
  sessionCode: string | null;
  sessionOpensAt: string;
  /** Null khi ca chạy chế độ thủ công — không có giờ đóng. */
  sessionClosesAt: string | null;
  roundId: string;
  roundTitle: string;
  courseId: string | null;
  courseTitle: string | null;
  examId: string;
  examTitle: string;
  examAccessMode: string;
  examStatus: string;
  accessCode: string | null;
  isDefault: boolean;
}

export async function getExamRoom(
  actorUserId: string,
  roomId: string,
  db: PrismaClient = prisma,
): Promise<ExamRoomDetail> {
  const r = await db.examRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      name: true,
      orderIndex: true,
      locationNote: true,
      proctorUserId: true,
      sessionId: true,
      examId: true,
      accessCode: true,
      isDefault: true,
      proctor: { select: { displayName: true } },
      session: {
        select: {
          title: true,
          code: true,
          accessMode: true,
          opensAt: true,
          closesAt: true,
          roundId: true,
          round: { select: { title: true } },
        },
      },
      exam: {
        select: {
          title: true,
          status: true,
          course: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!r) throw new ExamError("validation_failed", { reason: "room_not_found" });
  await assertCanView(actorUserId, r.session.roundId, db);
  return {
    id: r.id,
    name: r.name,
    orderIndex: r.orderIndex,
    locationNote: r.locationNote,
    proctorUserId: r.proctorUserId,
    proctorName: r.proctor.displayName,
    sessionId: r.sessionId,
    sessionTitle: r.session.title,
    sessionCode: r.session.code,
    sessionOpensAt: r.session.opensAt.toISOString(),
    sessionClosesAt: r.session.closesAt?.toISOString() ?? null,
    roundId: r.session.roundId,
    roundTitle: r.session.round.title,
    courseId: r.exam.course?.id ?? null,
    courseTitle: r.exam.course?.title ?? null,
    examId: r.examId,
    examTitle: r.exam.title,
    examAccessMode: r.session.accessMode,
    examStatus: r.exam.status,
    accessCode: r.accessCode,
    isDefault: r.isDefault,
  };
}

export async function listExamCandidatesInRoom(
  actorUserId: string,
  roomId: string,
  db: PrismaClient = prisma,
): Promise<ExamRoomCandidateItem[]> {
  const room = await db.examRoom.findUnique({
    where: { id: roomId },
    select: { session: { select: { roundId: true } } },
  });
  if (!room)
    throw new ExamError("validation_failed", { reason: "room_not_found" });
  await assertCanView(actorUserId, room.session.roundId, db);

  const rows = await db.examCandidate.findMany({
    where: { roomId },
    orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      displayName: true,
      accessCode: true,
      userId: true,
      metadata: true,
      disabledAt: true,
      arrivedAt: true,
      createdAt: true,
    },
  });

  return rows.map((c) => {
    const meta = (c.metadata as Record<string, unknown> | null) ?? {};
    return {
      id: c.id,
      displayName: c.displayName,
      accessCode: c.accessCode,
      userId: c.userId,
      email: typeof meta.email === "string" ? meta.email : null,
      mssv:
        typeof meta.studentCode === "string"
          ? meta.studentCode
          : typeof meta.mssv === "string"
            ? meta.mssv
            : null,
      disabledAt: c.disabledAt?.toISOString() ?? null,
      arrivedAt: c.arrivedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  });
}

// A5.3 PR2.8 — Proctor authz + attendance services.
//
// Proctor of a room = user where ExamRoom.proctorUserId = userId. This is a
// per-room binding (not a platform role). Proctors get write access only to
// arrivedAt on candidates of their rooms; everything else needs edit-round.

export async function canProctorRoom(
  userId: string,
  roomId: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  const r = await db.examRoom.findUnique({
    where: { id: roomId },
    select: { proctorUserId: true, session: { select: { roundId: true } } },
  });
  if (!r) return false;
  if (r.proctorUserId === userId) return true;
  // Round admins / platform admins also count as "can proctor" so the
  // attendance UI works for instructors who oversee the room.
  return await canEditExamRound(userId, r.session.roundId, db);
}

export async function setCandidateAttendance(
  actorUserId: string,
  candidateId: string,
  present: boolean,
  db: PrismaClient = prisma,
): Promise<{ arrivedAt: string | null }> {
  const c = await db.examCandidate.findUnique({
    where: { id: candidateId },
    select: { roomId: true },
  });
  if (!c || !c.roomId)
    throw new ExamError("validation_failed", { reason: "candidate_not_found" });
  const ok = await canProctorRoom(actorUserId, c.roomId, db);
  if (!ok) throw new ExamError("forbidden");
  const updated = await db.examCandidate.update({
    where: { id: candidateId },
    data: { arrivedAt: present ? new Date() : null },
    select: { arrivedAt: true },
  });
  return { arrivedAt: updated.arrivedAt?.toISOString() ?? null };
}

// ----------------------------------------------------------------------------
// "Phòng tôi trông" — rooms where the actor is the proctor.
// ----------------------------------------------------------------------------
export interface ProctorRoomItem {
  id: string;
  name: string;
  orderIndex: number;
  locationNote: string | null;
  candidateCount: number;
  arrivedCount: number;
  // Session info denormalized for the homepage card.
  sessionId: string;
  sessionCode: string | null;
  sessionTitle: string | null;
  sessionStatus: "draft" | "open" | "closed" | "archived";
  opensAt: string;
  /** Null khi ca chạy chế độ thủ công — không có giờ đóng. */
  closesAt: string | null;
  roundId: string;
  roundTitle: string;
  examTitle: string;
  courseTitle: string | null;
}

export async function listMyProctorRooms(
  userId: string,
  db: PrismaClient = prisma,
): Promise<ProctorRoomItem[]> {
  const rows = await db.examRoom.findMany({
    where: { proctorUserId: userId },
    // Mới nhất lên đầu. Tăng dần là thứ tự của quyển sổ ghi chép, không phải
    // của màn hình dùng trong ca thi: ca hôm nay chìm xuống dưới hàng chục ca
    // đã xong từ tháng trước.
    orderBy: [{ session: { opensAt: "desc" } }, { orderIndex: "asc" }],
    select: {
      id: true,
      name: true,
      orderIndex: true,
      locationNote: true,
      session: {
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          opensAt: true,
          closesAt: true,
          round: { select: { id: true, title: true } },
        },
      },
      exam: {
        select: {
          title: true,
          course: { select: { title: true } },
        },
      },
      candidates: { select: { arrivedAt: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    orderIndex: r.orderIndex,
    locationNote: r.locationNote,
    candidateCount: r.candidates.length,
    arrivedCount: r.candidates.filter((c) => c.arrivedAt !== null).length,
    sessionId: r.session.id,
    sessionCode: r.session.code,
    sessionTitle: r.session.title,
    sessionStatus: r.session.status,
    opensAt: r.session.opensAt.toISOString(),
    closesAt: r.session.closesAt?.toISOString() ?? null,
    roundId: r.session.round.id,
    roundTitle: r.session.round.title,
    examTitle: r.exam.title,
    courseTitle: r.exam.course?.title ?? null,
  }));
}

// ============================================================================
// Proctor invite (PR2.10)
// ============================================================================

/**
 * Assign someone as proctor of a room by email. If the email doesn't yet have
 * a Limio account, create a pending user (no password) and send an invite
 * email with a password-reset link so they can set their password and log in.
 *
 * Authz: caller must have edit access on the round.
 */
export async function inviteUserAsProctor(
  actorUserId: string,
  roomId: string,
  email: string,
  displayName: string,
  baseUrl: string,
  db: PrismaClient = prisma,
): Promise<{
  invited: boolean;
  userId: string;
  resetUrl?: string;
}> {
  const room = await db.examRoom.findUnique({
    where: { id: roomId },
    select: {
      session: {
        select: {
          roundId: true,
          // For per-org email template lookup.
          round: { select: { course: { select: { organizationId: true } } } },
        },
      },
    },
  });
  if (!room)
    throw new ExamError("validation_failed", { reason: "room_not_found" });
  await assertCanEdit(actorUserId, room.session.roundId, db);
  const organizationId = room.session.round.course?.organizationId ?? null;

  const normEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail))
    throw new ExamError("validation_failed", { reason: "invalid_email" });
  const name = displayName.trim();
  if (name.length === 0)
    throw new ExamError("validation_failed", { reason: "displayName_required" });

  const existing = await db.user.findUnique({
    where: { email: normEmail },
    select: { id: true },
  });

  if (existing) {
    // Just assign — no invite needed.
    await db.examRoom.update({
      where: { id: roomId },
      data: { proctorUserId: existing.id },
    });
    return { invited: false, userId: existing.id };
  }

  // Create pending user + password-reset token + assign + send email.
  // Lazy-import auth helpers to keep this file dep-free at module-init time.
  const { issueToken } = await import("../auth/tokens");
  const { buildResetUrl } = await import("../auth/email");
  const { sendTemplatedEmail } = await import("../email/templates");
  const { RoleName } = await import("@feedbackme/shared-types");

  const learnerRole = await db.role.findUniqueOrThrow({
    where: { name: RoleName.Learner },
  });

  const { userId, raw } = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normEmail,
        // passwordHash null — will be set when they accept the invite.
        displayName: name,
        // Inherit org from the inviting exam so invitee lands in the right tenant.
        organizationId,
        locale: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        // Implicit email verification: they were invited by an authenticated
        // instructor, so we trust the email.
        emailVerifiedAt: new Date(),
      },
    });
    await tx.authProvider.create({
      data: {
        userId: user.id,
        provider: "password",
        providerUserId: normEmail,
      },
    });
    await tx.userRole.create({
      data: { userId: user.id, roleId: learnerRole.id },
    });
    await tx.examRoom.update({
      where: { id: roomId },
      data: { proctorUserId: user.id },
    });
    const issued = await issueToken(user.id, "password_reset", tx);
    return { userId: user.id, raw: issued.raw };
  });

  const resetUrl = buildResetUrl(baseUrl, raw);
  await sendTemplatedEmail({
    key: "exam.proctor_invite",
    to: normEmail,
    organizationId,
    variables: { name, resetUrl },
  });

  return { invited: true, userId, resetUrl };
}

/** True if user is proctor of any room (drives menu visibility). */
export async function userIsAnyProctor(
  userId: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  const r = await db.examRoom.findFirst({
    where: { proctorUserId: userId },
    select: { id: true },
  });
  return r !== null;
}

export const AddRoomCandidatesInput = z.object({
  candidates: z
    .array(
      z.object({
        displayName: z.string().min(1).max(200).trim(),
        email: z.string().email().max(254).optional().nullable(),
        mssv: z.string().min(1).max(60).optional().nullable(),
      }),
    )
    .min(1)
    .max(500),
});

function genAccessCode(): string {
  // 8-char alphanumeric (capital + digit, no ambiguous chars).
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++)
    out += chars[Math.floor(Math.random() * chars.length)]!;
  return out;
}

export async function addCandidatesToRoom(
  actorUserId: string,
  roomId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ added: number; skipped: number }> {
  const room = await db.examRoom.findUnique({
    where: { id: roomId },
    select: {
      examId: true,
      sessionId: true,
      session: { select: { roundId: true } },
      exam: { select: { assignedCodeSource: true, kind: true } },
    },
  });
  if (!room)
    throw new ExamError("validation_failed", { reason: "room_not_found" });
  await assertCanEdit(actorUserId, room.session.roundId, db);
  // A6.5 — cùng lý do với bulkCreateExamSessionsInRound: vấn đáp AI không có
  // mã dự thi/candidate — code-access.ts đã chặn claim, nhưng chặn sớm ở đây
  // để không sinh ra ExamCandidate "chết" (không ai claim được) trong DB.
  if (room.exam.kind === "oral") {
    throw new ExamError("exam_not_written", {
      reason: "oral_has_no_candidates",
      message: "Đề vấn đáp AI không dùng danh sách thí sinh/mã dự thi.",
    });
  }

  const parsed = AddRoomCandidatesInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());

  // PR2.13 — Khi source = student_code, mã access = MSSV. Bắt buộc mọi
  // candidate phải có mssv, và mssv không trùng nhau trong cùng exam.
  const useMssvAsCode = room.exam.assignedCodeSource === "student_code";

  // For each candidate, try to link by email to an existing User if possible.
  // Dedupe within the input by email/mssv to avoid double-inserts.
  const seen = new Set<string>();
  const toInsert: Array<{
    displayName: string;
    email: string | null;
    mssv: string | null;
    userId: string | null;
    accessCode: string;
  }> = [];

  for (const c of parsed.data.candidates) {
    const key = (c.email ?? "") + "|" + (c.mssv ?? "");
    if (seen.has(key) && key !== "|") continue;
    seen.add(key);

    let userId: string | null = null;
    if (c.email) {
      const u = await db.user.findFirst({
        where: { email: c.email },
        select: { id: true },
      });
      if (u) userId = u.id;
    }

    let accessCode: string;
    if (useMssvAsCode) {
      if (!c.mssv || c.mssv.trim().length === 0)
        throw new ExamError("validation_failed", {
          reason: "student_code_required",
          row: c.displayName,
        });
      accessCode = c.mssv.trim();
    } else {
      accessCode = genAccessCode();
    }

    toInsert.push({
      displayName: c.displayName,
      email: c.email ?? null,
      mssv: c.mssv ?? null,
      userId,
      accessCode,
    });
  }

  let added = 0;
  let skipped = 0;
  for (const c of toInsert) {
    try {
      const metadata: Record<string, string> = {};
      if (c.email) metadata.email = c.email;
      if (c.mssv) metadata.studentCode = c.mssv;
      await db.examCandidate.create({
        data: {
          examId: room.examId,
          sessionId: room.sessionId,
          roomId,
          userId: c.userId,
          displayName: c.displayName,
          accessCode: c.accessCode,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        },
      });
      added++;
    } catch (e) {
      // P2002 on (examId, accessCode) unique — extremely unlikely with random
      // 8-char code, but skip to be safe.
      if ((e as { code?: string }).code === "P2002") {
        skipped++;
        continue;
      }
      throw e;
    }
  }
  return { added, skipped };
}

/**
 * Copy all candidates from one room into another. Source and destination must
 * belong to the same session (or same exam if rooms are pre-PR1c). Duplicates
 * (matched by email if present, else by mssv) are skipped. Each copy gets a
 * freshly generated access code — we never reuse the source's code.
 */
export async function copyCandidatesFromRoom(
  actorUserId: string,
  toRoomId: string,
  fromRoomId: string,
  db: PrismaClient = prisma,
): Promise<{ copied: number; skipped: number }> {
  if (toRoomId === fromRoomId)
    throw new ExamError("validation_failed", { reason: "same_room" });

  const [toRoom, fromRoom] = await Promise.all([
    db.examRoom.findUnique({
      where: { id: toRoomId },
      select: {
        examId: true,
        sessionId: true,
        session: { select: { roundId: true } },
      },
    }),
    db.examRoom.findUnique({
      where: { id: fromRoomId },
      select: {
        examId: true,
        sessionId: true,
        session: { select: { roundId: true } },
      },
    }),
  ]);
  if (!toRoom || !fromRoom)
    throw new ExamError("validation_failed", { reason: "room_not_found" });
  await assertCanEdit(actorUserId, toRoom.session.roundId, db);
  // Soft restriction: must be same session. Cross-session copy could surprise
  // instructors by mixing exam contexts; require explicit re-import instead.
  if (toRoom.sessionId !== fromRoom.sessionId)
    throw new ExamError("validation_failed", {
      reason: "rooms_in_different_sessions",
    });

  const sourceCands = await db.examCandidate.findMany({
    where: { roomId: fromRoomId },
    select: {
      displayName: true,
      userId: true,
      metadata: true,
    },
  });
  if (sourceCands.length === 0) return { copied: 0, skipped: 0 };

  // Pull existing identifiers in dest to dedupe.
  const existing = await db.examCandidate.findMany({
    where: { roomId: toRoomId },
    select: { metadata: true, userId: true },
  });
  const existingEmails = new Set<string>();
  const existingMssv = new Set<string>();
  const existingUsers = new Set<string>();
  for (const c of existing) {
    if (c.userId) existingUsers.add(c.userId);
    const m = (c.metadata as Record<string, unknown> | null) ?? {};
    if (typeof m.email === "string") existingEmails.add(m.email);
    if (typeof m.studentCode === "string") existingMssv.add(m.studentCode);
  }

  let copied = 0;
  let skipped = 0;
  for (const src of sourceCands) {
    const meta = (src.metadata as Record<string, unknown> | null) ?? {};
    const email = typeof meta.email === "string" ? meta.email : null;
    const mssv = typeof meta.studentCode === "string" ? meta.studentCode : null;

    // Skip if any identifier matches an existing dest candidate.
    if (
      (src.userId && existingUsers.has(src.userId)) ||
      (email && existingEmails.has(email)) ||
      (mssv && existingMssv.has(mssv))
    ) {
      skipped++;
      continue;
    }

    try {
      await db.examCandidate.create({
        data: {
          examId: toRoom.examId,
          sessionId: toRoom.sessionId,
          roomId: toRoomId,
          userId: src.userId,
          displayName: src.displayName,
          accessCode: genAccessCode(),
          metadata: meta as Prisma.InputJsonValue,
        },
      });
      copied++;
      if (src.userId) existingUsers.add(src.userId);
      if (email) existingEmails.add(email);
      if (mssv) existingMssv.add(mssv);
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        skipped++;
        continue;
      }
      throw e;
    }
  }
  return { copied, skipped };
}

/**
 * Move a batch of candidates from one room to another within the same session.
 * Source room is inferred from the candidates' current `roomId`; if any
 * candidate belongs to a different session than the destination, the whole
 * call aborts (no partial moves).
 */
export async function moveCandidatesToRoom(
  actorUserId: string,
  toRoomId: string,
  candidateIds: string[],
  db: PrismaClient = prisma,
): Promise<{ moved: number }> {
  if (candidateIds.length === 0) return { moved: 0 };

  const toRoom = await db.examRoom.findUnique({
    where: { id: toRoomId },
    select: {
      sessionId: true,
      session: { select: { roundId: true } },
    },
  });
  if (!toRoom)
    throw new ExamError("validation_failed", { reason: "room_not_found" });
  await assertCanEdit(actorUserId, toRoom.session.roundId, db);

  // All candidates must already be in the dest session — guards against
  // accidentally pulling in candidates from a different ca thi.
  const mismatched = await db.examCandidate.count({
    where: {
      id: { in: candidateIds },
      NOT: { sessionId: toRoom.sessionId },
    },
  });
  if (mismatched > 0)
    throw new ExamError("validation_failed", {
      reason: "candidates_in_different_sessions",
    });

  const result = await db.examCandidate.updateMany({
    where: { id: { in: candidateIds }, sessionId: toRoom.sessionId },
    data: { roomId: toRoomId },
  });
  return { moved: result.count };
}

export async function removeCandidateFromRoom(
  actorUserId: string,
  candidateId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const c = await db.examCandidate.findUnique({
    where: { id: candidateId },
    select: {
      roomId: true,
      room: {
        select: { session: { select: { roundId: true } } },
      },
    },
  });
  if (!c || !c.roomId || !c.room)
    throw new ExamError("validation_failed", { reason: "candidate_not_found" });
  await assertCanEdit(actorUserId, c.room.session.roundId, db);
  // ExamAttempt → ExamCandidate là FK Cascade: xoá thí sinh đã có bài làm sẽ xoá
  // luôn bài làm và LearningEvent của họ. Chỉ được xoá khi chưa từng vào thi
  // (cùng guard với removeCandidate ở candidates.ts).
  const attempts = await db.examAttempt.count({ where: { candidateId } });
  if (attempts > 0) throw new ExamError("candidate_has_attempts");
  // Xoá hẳn hàng: thí sinh này sinh ra từ luồng phòng thi, bỏ gán phòng sẽ để
  // lại một mục danh sách mà người dùng không thấy được.
  await db.examCandidate.delete({ where: { id: candidateId } });
}

export async function listExamRoomsForSession(
  actorUserId: string,
  sessionId: string,
  db: PrismaClient = prisma,
): Promise<ExamSessionRoomItem[]> {
  const session = await db.examSession.findUnique({
    where: { id: sessionId },
    select: { roundId: true },
  });
  if (!session) throw new ExamError("schedule_not_found");
  await assertCanView(actorUserId, session.roundId, db);

  const rooms = await db.examRoom.findMany({
    where: { sessionId },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    include: {
      proctor: { select: { id: true, displayName: true } },
      graders: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      _count: { select: { candidates: true } },
    },
  });
  return rooms.map((r) => ({
    id: r.id,
    orderIndex: r.orderIndex,
    name: r.name,
    locationNote: r.locationNote,
    proctorUserId: r.proctorUserId,
    proctorName: r.proctor.displayName,
    graders: r.graders.map((g) => ({
      id: g.user.id,
      displayName: g.user.displayName,
    })),
    candidateCount: r._count.candidates,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Reorder rooms in a session by providing the desired ordering as an array
 * of roomIds. Rooms not listed retain their current orderIndex (relative
 * order preserved at the tail). Caller must have edit access on the round.
 */
export async function reorderSessionRooms(
  actorUserId: string,
  sessionId: string,
  orderedRoomIds: string[],
  db: PrismaClient = prisma,
): Promise<void> {
  const sess = await db.examSession.findUnique({
    where: { id: sessionId },
    select: { roundId: true },
  });
  if (!sess) throw new ExamError("schedule_not_found");
  await assertCanEdit(actorUserId, sess.roundId, db);

  // Validate all listed rooms actually belong to this session.
  if (orderedRoomIds.length > 0) {
    const rooms = await db.examRoom.count({
      where: { id: { in: orderedRoomIds }, sessionId },
    });
    if (rooms !== orderedRoomIds.length)
      throw new ExamError("validation_failed", {
        reason: "rooms_not_in_session",
      });
  }

  // Two-pass update to avoid transient orderIndex collisions when we siết
  // @@unique([sessionId, orderIndex]) later: first bump everything way out of
  // range (negative), then set final values.
  await db.$transaction(async (tx) => {
    for (let i = 0; i < orderedRoomIds.length; i++) {
      const id = orderedRoomIds[i]!;
      await tx.examRoom.update({
        where: { id },
        data: { orderIndex: -(i + 1) },
      });
    }
    for (let i = 0; i < orderedRoomIds.length; i++) {
      const id = orderedRoomIds[i]!;
      await tx.examRoom.update({
        where: { id },
        data: { orderIndex: i + 1 },
      });
    }
  });
}

export async function listExamSessionsForRound(
  actorUserId: string,
  roundId: string,
  db: PrismaClient = prisma,
): Promise<ExamRoundSessionItem[]> {
  await assertCanView(actorUserId, roundId, db);
  const rows = await db.examSession.findMany({
    where: { roundId },
    orderBy: [{ opensAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      opensAt: true,
      closesAt: true,
      accessMode: true,
      openCode: true,
      exam: {
        select: {
          id: true,
          title: true,
          course: { select: { id: true, title: true } },
        },
      },
      _count: { select: { rooms: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    status: r.status,
    opensAt: r.opensAt.toISOString(),
    closesAt: r.closesAt?.toISOString() ?? null,
    examId: r.exam.id,
    examTitle: r.exam.title,
    examAccessMode: r.accessMode,
    openCode: r.openCode,
    courseId: r.exam.course?.id ?? null,
    courseTitle: r.exam.course?.title ?? null,
    roomCount: r._count.rooms,
  }));
}

export async function deleteExamRound(
  actorUserId: string,
  roundId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEdit(actorUserId, roundId, db);
  try {
    await db.examRound.delete({ where: { id: roundId } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025")
      throw new ExamError("round_not_found");
    // FK Restrict on ExamSession.roundId — round can't be deleted while it
    // owns sessions. Surface as validation rather than crash.
    if ((e as { code?: string }).code === "P2003")
      throw new ExamError("validation_failed", {
        reason: "round_has_sessions",
      });
    throw e;
  }
}

// ============================================================================
// Round admin bridge management
// ============================================================================

export async function addAdminToRound(
  actorUserId: string,
  roundId: string,
  targetUserId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEdit(actorUserId, roundId, db);
  const u = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!u)
    throw new ExamError("validation_failed", { reason: "user_not_found" });
  try {
    await db.examRoundAdmin.create({
      data: { roundId, userId: targetUserId, grantedBy: actorUserId },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new ExamError("round_admin_already_exists");
    throw e;
  }
}

export async function removeAdminFromRound(
  actorUserId: string,
  roundId: string,
  targetUserId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEdit(actorUserId, roundId, db);
  // Refuse to leave a round adminless — at least one admin must remain (the
  // platform admin can always recover, but UI shouldn't allow this).
  const remaining = await db.examRoundAdmin.count({ where: { roundId } });
  if (remaining <= 1)
    throw new ExamError("validation_failed", {
      reason: "round_must_have_admin",
    });
  await db.examRoundAdmin.deleteMany({
    where: { roundId, userId: targetUserId },
  });
}


/**
 * Khung giờ HIỂN THỊ của một đợt thi — suy từ các ca bên trong, không đọc
 * `ExamRound.opensAt/closesAt`.
 *
 * Hai cột đó chưa bao giờ chặn ai và cũng không ràng buộc các ca, nên chúng
 * trôi khỏi thực tế mà không ai nhận ra. Suy từ ca thì không thể lệch.
 *
 * Trả null khi đợt chưa có ca nào, hoặc mọi ca đều chạy chế độ thủ công (không
 * có giờ đóng).
 */
export async function roundDisplayWindow(
  roundId: string,
  db: PrismaClient = prisma,
): Promise<{ opensAt: string | null; closesAt: string | null; sessionCount: number }> {
  const rows = await db.examSession.findMany({
    where: { roundId },
    select: { opensAt: true, closesAt: true },
  });
  if (rows.length === 0)
    return { opensAt: null, closesAt: null, sessionCount: 0 };

  const opens = rows.reduce<Date | null>(
    (m, r) => (m === null || r.opensAt < m ? r.opensAt : m),
    null,
  );
  // Ca thủ công không có giờ đóng — bỏ qua khi tính mốc muộn nhất.
  const closesCandidates = rows
    .map((r) => r.closesAt)
    .filter((d): d is Date => d !== null);
  const closes = closesCandidates.length
    ? closesCandidates.reduce((m, d) => (d > m ? d : m))
    : null;

  return {
    opensAt: opens?.toISOString() ?? null,
    closesAt: closes?.toISOString() ?? null,
    sessionCount: rows.length,
  };
}
