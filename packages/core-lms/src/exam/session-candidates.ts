/**
 * Danh sách thí sinh của CẢ CA THI — bước 1 của luồng "Thí sinh và phòng".
 *
 * Khác với luồng cũ (thêm thí sinh vào TỪNG PHÒNG, exam-rounds.ts), ở đây thí
 * sinh vào ca trước, chưa có phòng (`roomId = null`); chia phòng là bước sau.
 *
 * Ba nguồn:
 *   - dán bảng từ Excel  → importSessionCandidates (có chế độ kiểm tra thử)
 *   - gõ từng em         → cũng importSessionCandidates, một dòng
 *   - lấy từ lớp học     → addSessionCandidatesFromSection, rồi
 *                          attachStudentCodes để ghép MSSV theo email (tài khoản
 *                          học viên không có trường MSSV)
 *
 * Kiểm tra chạy ở MÁY CHỦ cho cả lần xem trước lẫn lần lưu, cùng một hàm — giao
 * diện chỉ hiển thị kết quả, không tự phán dòng nào hợp lệ. Lưu thì chỉ lưu dòng
 * hợp lệ, trong một transaction: lỗi hệ thống giữa chừng không để lại nửa danh
 * sách.
 *
 * Sự kiện: phát bằng userId của người thao tác, KHÔNG gắn candidateId — xoá thí
 * sinh cascade xoá LearningEvent có candidateId, mà LearningEvent là append-only.
 * Payload không chứa mã thi hay email (quy ước organize-events.ts).
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma, Prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { effectiveAccessMode, generateAssignedCode } from "./code-access";
import { canEditSession } from "./exam-rounds";
import { ExamError } from "./types";

const MAX_ROWS = 2000;

// ---------------------------------------------------------------------------
// Lỗi từng dòng
// ---------------------------------------------------------------------------

export type CandidateIssue =
  | { kind: "name_missing" }
  | { kind: "email_invalid" }
  | { kind: "email_missing" }
  | { kind: "mssv_missing"; requiredForCode: boolean }
  | { kind: "duplicate_in_list"; field: "mssv" | "email"; line: number }
  | { kind: "already_in_session"; name: string }
  | { kind: "mssv_used"; name: string }
  | { kind: "code_taken" }
  | { kind: "email_not_found" }
  | { kind: "code_locked" };

/** Câu hiển thị cho giáo viên. Đặt ở đây để xem trước và lưu nói cùng một câu. */
export function candidateIssueMessage(issue: CandidateIssue): string {
  switch (issue.kind) {
    case "name_missing":
      return "Thiếu họ tên";
    case "email_invalid":
      return "Email không đúng định dạng";
    case "email_missing":
      return "Thiếu email";
    case "mssv_missing":
      return issue.requiredForCode ? "Thiếu MSSV (bắt buộc vì mã thi là MSSV)" : "Thiếu MSSV";
    case "duplicate_in_list":
      return `Trùng ${issue.field === "mssv" ? "MSSV" : "email"} với dòng ${issue.line}`;
    case "already_in_session":
      return `Đã có trong ca: ${issue.name}`;
    case "mssv_used":
      return `MSSV này đã thuộc về ${issue.name}`;
    case "code_taken":
      return "MSSV này đang là mã thi của một thí sinh ở ca khác cùng đề thi";
    case "email_not_found":
      return "Không có thí sinh nào trong ca dùng email này";
    case "code_locked":
      return "Thí sinh đã vào thi nên không đổi được mã thi";
  }
}

// ---------------------------------------------------------------------------
// Chuẩn hoá
// ---------------------------------------------------------------------------

const emailSchema = z.string().email().max(254);
const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
const normName = (v: string | null | undefined) => clean(v).slice(0, 200);
const normMssv = (v: string | null | undefined) => clean(v).slice(0, 60) || null;
const normEmail = (v: string | null | undefined) => clean(v).toLowerCase() || null;
/** Mã thi so khớp theo chữ hoa: claimByAssignedCode viết hoa mã người dùng gõ. */
const asCode = (mssv: string) => mssv.toUpperCase();

function metaOf(m: unknown): { email?: string; studentCode?: string } & Record<string, unknown> {
  return m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
}

// ---------------------------------------------------------------------------
// Ngữ cảnh ca thi
// ---------------------------------------------------------------------------

interface SessionCtx {
  id: string;
  examId: string;
  courseId: string | null;
  mode: string;
  codeSource: "random" | "student_code";
}

async function loadEditableSession(
  actorUserId: string,
  sessionId: string,
  db: PrismaClient,
): Promise<SessionCtx> {
  const s = await db.examSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      roundId: true,
      examId: true,
      accessMode: true,
      exam: { select: { accessMode: true, assignedCodeSource: true, kind: true, courseId: true } },
    },
  });
  if (!s) throw new ExamError("schedule_not_found");
  if (!(await canEditSession(actorUserId, { roundId: s.roundId, examId: s.examId }, db)))
    throw new ExamError("forbidden");
  if (s.exam.kind === "oral")
    throw new ExamError("exam_not_written", {
      reason: "oral_has_no_candidates",
      message: "Đề vấn đáp AI không dùng danh sách thí sinh.",
    });
  return {
    id: s.id,
    examId: s.examId,
    courseId: s.exam.courseId,
    mode: effectiveAccessMode(s, s.exam),
    codeSource: s.exam.assignedCodeSource,
  };
}

function requireAssigned(ctx: SessionCtx): void {
  if (ctx.mode !== "assigned_code")
    throw new ExamError("validation_failed", {
      reason: "session_not_assigned_code",
      message:
        "Ca thi không ở chế độ Theo phòng. Ở chế độ Tự do, thí sinh tự nhập tên khi vào thi nên không cần danh sách.",
    });
}

interface ExistingCandidate {
  id: string;
  displayName: string;
  email: string | null;
  mssv: string | null;
  userId: string | null;
  accessCode: string | null;
  attempts: number;
}

async function loadSessionCandidates(sessionId: string, db: PrismaClient): Promise<ExistingCandidate[]> {
  const rows = await db.examCandidate.findMany({
    where: { sessionId },
    select: {
      id: true,
      displayName: true,
      metadata: true,
      userId: true,
      accessCode: true,
      linkedUser: { select: { email: true } },
      _count: { select: { attempts: true } },
    },
  });
  return rows.map((r) => {
    const md = metaOf(r.metadata);
    return {
      id: r.id,
      displayName: r.displayName,
      email: normEmail(typeof md.email === "string" ? md.email : r.linkedUser?.email),
      mssv: normMssv(typeof md.studentCode === "string" ? md.studentCode : null),
      userId: r.userId,
      accessCode: r.accessCode,
      attempts: r._count.attempts,
    };
  });
}

/** Mã thi đang dùng trong CẢ ĐỀ (unique theo examId) → id thí sinh đang giữ. */
async function loadExamCodes(examId: string, db: PrismaClient): Promise<Map<string, string>> {
  const rows = await db.examCandidate.findMany({
    where: { examId, accessCode: { not: null } },
    select: { id: true, accessCode: true },
  });
  return new Map(rows.map((r) => [r.accessCode!.toUpperCase(), r.id]));
}

function uniqueRandomCode(taken: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const c = generateAssignedCode();
    if (!taken.has(c)) {
      taken.add(c);
      return c;
    }
  }
  throw new ExamError("candidate_code_collision");
}

async function emitAudit(
  actorUserId: string,
  type: LearningEventType,
  payload: Record<string, unknown>,
  courseId: string | null,
  db: PrismaClient | Prisma.TransactionClient,
): Promise<void> {
  await emitEvent(
    actorUserId,
    type,
    payload,
    { courseId: courseId ?? undefined, eventKey: `${type}:${randomUUID()}` },
    db,
  );
}

// ---------------------------------------------------------------------------
// Dán từ Excel / gõ từng em
// ---------------------------------------------------------------------------

const DraftRow = z.object({
  line: z.number().int().min(1),
  displayName: z.string().max(1000).nullish(),
  mssv: z.string().max(1000).nullish(),
  email: z.string().max(1000).nullish(),
});
const DraftRows = z.array(DraftRow).min(1).max(MAX_ROWS);
export type CandidateDraft = z.input<typeof DraftRow>;

export interface CheckedRow {
  line: number;
  displayName: string;
  mssv: string | null;
  email: string | null;
  issue?: CandidateIssue;
}

export interface ImportCandidatesResult {
  rows: CheckedRow[];
  valid: number;
  invalid: number;
  saved: boolean;
  codeSource: "random" | "student_code";
}

export async function importSessionCandidates(
  actorUserId: string,
  sessionId: string,
  rawRows: unknown,
  opts: { dryRun?: boolean } = {},
  db: PrismaClient = prisma,
): Promise<ImportCandidatesResult> {
  const ctx = await loadEditableSession(actorUserId, sessionId, db);
  requireAssigned(ctx);
  const parsed = DraftRows.safeParse(rawRows);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());

  const mssvIsCode = ctx.codeSource === "student_code";
  const [existing, examCodes] = await Promise.all([
    loadSessionCandidates(sessionId, db),
    loadExamCodes(ctx.examId, db),
  ]);
  const inSessionByMssv = new Map(existing.filter((c) => c.mssv).map((c) => [c.mssv!.toUpperCase(), c]));
  const inSessionByEmail = new Map(existing.filter((c) => c.email).map((c) => [c.email!, c]));
  const listMssv = new Map<string, number>();
  const listEmail = new Map<string, number>();

  const rows: CheckedRow[] = parsed.data.map((r) => {
    const out: CheckedRow = {
      line: r.line,
      displayName: normName(r.displayName),
      mssv: normMssv(r.mssv),
      email: normEmail(r.email),
    };
    const mKey = out.mssv?.toUpperCase() ?? null;
    let issue: CandidateIssue | undefined;
    if (!out.displayName) issue = { kind: "name_missing" };
    else if (out.email && !emailSchema.safeParse(out.email).success) issue = { kind: "email_invalid" };
    else if (!out.mssv && mssvIsCode) issue = { kind: "mssv_missing", requiredForCode: true };
    else if (mKey && listMssv.has(mKey)) issue = { kind: "duplicate_in_list", field: "mssv", line: listMssv.get(mKey)! };
    else if (out.email && listEmail.has(out.email))
      issue = { kind: "duplicate_in_list", field: "email", line: listEmail.get(out.email)! };
    else {
      const dup = (mKey && inSessionByMssv.get(mKey)) || (out.email && inSessionByEmail.get(out.email));
      if (dup) issue = { kind: "already_in_session", name: dup.displayName };
      else if (mssvIsCode && examCodes.has(mKey!)) issue = { kind: "code_taken" };
    }
    if (issue) out.issue = issue;
    else {
      if (mKey) listMssv.set(mKey, r.line);
      if (out.email) listEmail.set(out.email, r.line);
    }
    return out;
  });

  const valid = rows.filter((r) => !r.issue);
  const result: ImportCandidatesResult = {
    rows,
    valid: valid.length,
    invalid: rows.length - valid.length,
    saved: false,
    codeSource: ctx.codeSource,
  };
  if (opts.dryRun || valid.length === 0) return result;

  // Liên kết tài khoản sẵn có theo email.
  const emails = valid.map((r) => r.email).filter((e): e is string => !!e);
  const users = emails.length
    ? await db.user.findMany({
        where: { email: { in: emails, mode: "insensitive" } },
        select: { id: true, email: true },
      })
    : [];
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

  const taken = new Set(examCodes.keys());
  const data = valid.map((r) => {
    const metadata: Record<string, string> = {};
    if (r.email) metadata.email = r.email;
    if (r.mssv) metadata.studentCode = r.mssv;
    return {
      id: randomUUID(),
      examId: ctx.examId,
      sessionId,
      displayName: r.displayName,
      userId: (r.email && userByEmail.get(r.email)) || null,
      accessCode: mssvIsCode ? asCode(r.mssv!) : uniqueRandomCode(taken),
      metadata: Object.keys(metadata).length ? metadata : undefined,
    };
  });

  await db.$transaction(async (tx) => {
    await tx.examCandidate.createMany({ data });
    await emitAudit(
      actorUserId,
      LearningEventType.ExamCandidatesAdded,
      {
        sessionId,
        added: data.length,
        skipped: result.invalid,
        source: parsed.data.length === 1 ? "manual" : "paste",
        candidateIds: data.map((d) => d.id),
      },
      ctx.courseId,
      tx,
    );
  });
  result.saved = true;
  return result;
}

// ---------------------------------------------------------------------------
// Danh sách, sửa, xoá
// ---------------------------------------------------------------------------

export interface SessionCandidateRow {
  id: string;
  displayName: string;
  mssv: string | null;
  email: string | null;
  accessCode: string | null;
  /** Mã thi là MSSV mà thí sinh chưa có MSSV ⇒ chưa vào thi được. */
  needsMssv: boolean;
  roomId: string | null;
  roomName: string | null;
  linkedAccount: boolean;
  hasAttempt: boolean;
}

export interface SessionCandidateList {
  accessMode: string;
  codeSource: "random" | "student_code";
  /** Đề gắn khoá học ⇒ có nguồn "Lấy từ lớp học". */
  hasCourse: boolean;
  rows: SessionCandidateRow[];
}

export async function listSessionCandidates(
  actorUserId: string,
  sessionId: string,
  db: PrismaClient = prisma,
): Promise<SessionCandidateList> {
  const ctx = await loadEditableSession(actorUserId, sessionId, db);
  const rows = await db.examCandidate.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      displayName: true,
      metadata: true,
      accessCode: true,
      userId: true,
      roomId: true,
      room: { select: { name: true } },
      linkedUser: { select: { email: true } },
      _count: { select: { attempts: true } },
    },
  });
  return {
    accessMode: ctx.mode,
    codeSource: ctx.codeSource,
    hasCourse: ctx.courseId !== null,
    rows: rows.map((r) => {
      const md = metaOf(r.metadata);
      return {
        id: r.id,
        displayName: r.displayName,
        mssv: typeof md.studentCode === "string" ? md.studentCode : null,
        email: normEmail(typeof md.email === "string" ? md.email : r.linkedUser?.email),
        accessCode: r.accessCode,
        needsMssv: ctx.mode === "assigned_code" && r.accessCode === null,
        roomId: r.roomId,
        roomName: r.room?.name ?? null,
        linkedAccount: r.userId !== null,
        hasAttempt: r._count.attempts > 0,
      };
    }),
  };
}

const CandidatePatch = z.object({
  displayName: z.string().max(1000).optional(),
  mssv: z.string().max(1000).nullable().optional(),
  email: z.string().max(1000).nullable().optional(),
});

async function loadCandidateForEdit(actorUserId: string, candidateId: string, db: PrismaClient) {
  const c = await db.examCandidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      examId: true,
      sessionId: true,
      roomId: true,
      displayName: true,
      metadata: true,
      accessCode: true,
      session: { select: { roundId: true, examId: true } },
      exam: { select: { courseId: true, assignedCodeSource: true } },
      _count: { select: { attempts: true } },
    },
  });
  if (!c) throw new ExamError("candidate_not_found");
  if (!(await canEditSession(actorUserId, c.session, db))) throw new ExamError("forbidden");
  return c;
}

export async function updateSessionCandidate(
  actorUserId: string,
  candidateId: string,
  rawPatch: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const c = await loadCandidateForEdit(actorUserId, candidateId, db);
  const parsed = CandidatePatch.safeParse(rawPatch);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const p = parsed.data;

  const md = { ...metaOf(c.metadata) };
  const data: { displayName?: string; accessCode?: string | null; metadata?: Prisma.InputJsonValue } = {};
  const fields: string[] = [];

  if (p.displayName !== undefined) {
    const name = normName(p.displayName);
    if (!name) throw new ExamError("candidate_name_required");
    if (name !== c.displayName) {
      data.displayName = name;
      fields.push("displayName");
    }
  }
  if (p.email !== undefined) {
    const email = normEmail(p.email);
    if (email && !emailSchema.safeParse(email).success)
      throw new ExamError("validation_failed", { reason: "email_invalid" });
    if (email) md.email = email;
    else delete md.email;
    fields.push("email");
  }
  if (p.mssv !== undefined) {
    const mssv = normMssv(p.mssv);
    if (mssv) {
      const clash = (await loadSessionCandidates(c.sessionId, db)).find(
        (x) => x.id !== c.id && x.mssv?.toUpperCase() === mssv.toUpperCase(),
      );
      if (clash) throw new ExamError("validation_failed", { reason: "mssv_used", name: clash.displayName });
      md.studentCode = mssv;
    } else delete md.studentCode;
    fields.push("studentCode");

    if (c.exam.assignedCodeSource === "student_code") {
      const nextCode = mssv ? asCode(mssv) : null;
      if (nextCode !== c.accessCode) {
        if (!nextCode) throw new ExamError("validation_failed", { reason: "student_code_required" });
        if (c._count.attempts > 0) throw new ExamError("candidate_has_attempts");
        const holder = (await loadExamCodes(c.examId, db)).get(nextCode);
        if (holder && holder !== c.id) throw new ExamError("candidate_code_collision");
        data.accessCode = nextCode;
      }
    }
  }
  if (fields.some((f) => f !== "displayName")) data.metadata = md as Prisma.InputJsonValue;
  if (Object.keys(data).length === 0) return;

  await db.$transaction(async (tx) => {
    await tx.examCandidate.update({ where: { id: candidateId }, data });
    await emitAudit(
      actorUserId,
      LearningEventType.ExamCandidateUpdated,
      { candidateId, sessionId: c.sessionId, fields },
      c.exam.courseId,
      tx,
    );
  });
}

export async function removeSessionCandidate(
  actorUserId: string,
  candidateId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const c = await loadCandidateForEdit(actorUserId, candidateId, db);
  // ExamAttempt → ExamCandidate cascade: xoá thí sinh đã làm bài là xoá luôn bài làm.
  if (c._count.attempts > 0) throw new ExamError("candidate_has_attempts");
  await db.$transaction(async (tx) => {
    await tx.examCandidate.delete({ where: { id: candidateId } });
    await emitAudit(
      actorUserId,
      LearningEventType.ExamCandidateRemoved,
      { candidateId, sessionId: c.sessionId, roomId: c.roomId },
      c.exam.courseId,
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Lấy từ lớp học
// ---------------------------------------------------------------------------

export interface SessionSectionOption {
  id: string;
  name: string;
  code: string | null;
  /** Lớp mặc định của khoá = học viên chưa được xếp lớp nào. */
  isDefault: boolean;
  studentCount: number;
}

export async function listSessionSections(
  actorUserId: string,
  sessionId: string,
  db: PrismaClient = prisma,
): Promise<SessionSectionOption[]> {
  const ctx = await loadEditableSession(actorUserId, sessionId, db);
  if (!ctx.courseId) return [];
  const sections = await db.courseSection.findMany({
    where: { courseId: ctx.courseId },
    orderBy: [{ isDefault: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      isDefault: true,
      _count: { select: { enrollments: { where: { status: "active" } } } },
    },
  });
  return sections
    .map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      isDefault: s.isDefault,
      studentCount: s._count.enrollments,
    }))
    .filter((s) => !s.isDefault || s.studentCount > 0);
}

async function assertSectionOfSession(ctx: SessionCtx, sectionId: string, db: PrismaClient) {
  const section = await db.courseSection.findUnique({ where: { id: sectionId }, select: { courseId: true } });
  if (!section || !ctx.courseId || section.courseId !== ctx.courseId)
    throw new ExamError("validation_failed", { reason: "section_not_in_course" });
}

export interface SectionStudentOption {
  userId: string;
  displayName: string;
  email: string;
  alreadyInSession: boolean;
}

export async function listSectionStudents(
  actorUserId: string,
  sessionId: string,
  sectionId: string,
  db: PrismaClient = prisma,
): Promise<SectionStudentOption[]> {
  const ctx = await loadEditableSession(actorUserId, sessionId, db);
  await assertSectionOfSession(ctx, sectionId, db);
  const [enrollments, existing] = await Promise.all([
    db.enrollment.findMany({
      where: { sectionId, status: "active" },
      select: { user: { select: { id: true, displayName: true, email: true } } },
    }),
    loadSessionCandidates(sessionId, db),
  ]);
  const ids = new Set(existing.map((c) => c.userId).filter(Boolean));
  const emails = new Set(existing.map((c) => c.email).filter(Boolean));
  return enrollments
    .map(({ user }) => ({
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      alreadyInSession: ids.has(user.id) || emails.has(user.email.toLowerCase()),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
}

export async function addSessionCandidatesFromSection(
  actorUserId: string,
  sessionId: string,
  sectionId: string,
  rawUserIds: unknown,
  db: PrismaClient = prisma,
): Promise<{ added: number; skipped: number }> {
  const ctx = await loadEditableSession(actorUserId, sessionId, db);
  requireAssigned(ctx);
  await assertSectionOfSession(ctx, sectionId, db);
  const parsed = z.array(z.string().uuid()).min(1).max(MAX_ROWS).safeParse(rawUserIds);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const userIds = [...new Set(parsed.data)];

  const [students, examCodes] = await Promise.all([
    listSectionStudents(actorUserId, sessionId, sectionId, db),
    loadExamCodes(ctx.examId, db),
  ]);
  const wanted = new Set(userIds);
  const toAdd = students.filter((s) => wanted.has(s.userId) && !s.alreadyInSession);
  const skipped = parsed.data.length - toAdd.length;
  if (toAdd.length === 0) return { added: 0, skipped };

  // Mã thi là MSSV: tài khoản không có MSSV ⇒ để trống mã, giáo viên dán cột MSSV
  // ghép theo email sau (attachStudentCodes). Danh sách hiện "Chưa có mã".
  const taken = new Set(examCodes.keys());
  const data = toAdd.map((s) => ({
    id: randomUUID(),
    examId: ctx.examId,
    sessionId,
    displayName: s.displayName,
    userId: s.userId,
    accessCode: ctx.codeSource === "student_code" ? null : uniqueRandomCode(taken),
    metadata: { email: s.email.toLowerCase() },
  }));
  await db.$transaction(async (tx) => {
    await tx.examCandidate.createMany({ data });
    await emitAudit(
      actorUserId,
      LearningEventType.ExamCandidatesAdded,
      { sessionId, sectionId, added: data.length, skipped, source: "class", candidateIds: data.map((d) => d.id) },
      ctx.courseId,
      tx,
    );
  });
  return { added: data.length, skipped };
}

// ---------------------------------------------------------------------------
// Ghép MSSV theo email
// ---------------------------------------------------------------------------

const AttachRow = z.object({
  line: z.number().int().min(1),
  email: z.string().max(1000).nullish(),
  mssv: z.string().max(1000).nullish(),
});

export interface AttachCheckedRow {
  line: number;
  email: string | null;
  mssv: string | null;
  candidateName?: string;
  issue?: CandidateIssue;
}

export interface AttachStudentCodesResult {
  rows: AttachCheckedRow[];
  matched: number;
  invalid: number;
  saved: boolean;
}

export async function attachStudentCodes(
  actorUserId: string,
  sessionId: string,
  rawRows: unknown,
  opts: { dryRun?: boolean } = {},
  db: PrismaClient = prisma,
): Promise<AttachStudentCodesResult> {
  const ctx = await loadEditableSession(actorUserId, sessionId, db);
  requireAssigned(ctx);
  const parsed = z.array(AttachRow).min(1).max(MAX_ROWS).safeParse(rawRows);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());

  const mssvIsCode = ctx.codeSource === "student_code";
  const [existing, examCodes] = await Promise.all([
    loadSessionCandidates(sessionId, db),
    loadExamCodes(ctx.examId, db),
  ]);
  const byEmail = new Map(existing.filter((c) => c.email).map((c) => [c.email!, c]));
  const seenEmail = new Map<string, number>();
  const seenMssv = new Map<string, number>();
  const updates: Array<{ c: ExistingCandidate; mssv: string }> = [];

  const rows: AttachCheckedRow[] = parsed.data.map((r) => {
    const out: AttachCheckedRow = { line: r.line, email: normEmail(r.email), mssv: normMssv(r.mssv) };
    const c = out.email ? byEmail.get(out.email) : undefined;
    if (c) out.candidateName = c.displayName;
    const mKey = out.mssv?.toUpperCase() ?? null;
    let issue: CandidateIssue | undefined;
    if (!out.email) issue = { kind: "email_missing" };
    else if (!emailSchema.safeParse(out.email).success) issue = { kind: "email_invalid" };
    else if (!out.mssv) issue = { kind: "mssv_missing", requiredForCode: false };
    else if (seenEmail.has(out.email))
      issue = { kind: "duplicate_in_list", field: "email", line: seenEmail.get(out.email)! };
    else if (seenMssv.has(mKey!)) issue = { kind: "duplicate_in_list", field: "mssv", line: seenMssv.get(mKey!)! };
    else if (!c) issue = { kind: "email_not_found" };
    else {
      const owner = existing.find((x) => x.id !== c.id && x.mssv?.toUpperCase() === mKey);
      const holder = examCodes.get(mKey!);
      if (owner) issue = { kind: "mssv_used", name: owner.displayName };
      else if (mssvIsCode && holder && holder !== c.id) issue = { kind: "code_taken" };
      else if (mssvIsCode && c.attempts > 0 && c.accessCode !== asCode(out.mssv!)) issue = { kind: "code_locked" };
    }
    if (issue) out.issue = issue;
    else {
      seenEmail.set(out.email!, r.line);
      seenMssv.set(mKey!, r.line);
      updates.push({ c: c!, mssv: out.mssv! });
    }
    return out;
  });

  const result: AttachStudentCodesResult = {
    rows,
    matched: updates.length,
    invalid: rows.length - updates.length,
    saved: false,
  };
  if (opts.dryRun || updates.length === 0) return result;

  const metas = await db.examCandidate.findMany({
    where: { id: { in: updates.map((u) => u.c.id) } },
    select: { id: true, metadata: true },
  });
  const metaById = new Map(metas.map((m) => [m.id, metaOf(m.metadata)]));
  await db.$transaction(async (tx) => {
    for (const u of updates) {
      await tx.examCandidate.update({
        where: { id: u.c.id },
        data: {
          metadata: { ...metaById.get(u.c.id), studentCode: u.mssv } as Prisma.InputJsonValue,
          ...(mssvIsCode ? { accessCode: asCode(u.mssv) } : {}),
        },
      });
    }
    await emitAudit(
      actorUserId,
      LearningEventType.ExamCandidateUpdated,
      { sessionId, updated: updates.length, fields: ["studentCode"], source: "attach" },
      ctx.courseId,
      tx,
    );
  });
  result.saved = true;
  return result;
}
